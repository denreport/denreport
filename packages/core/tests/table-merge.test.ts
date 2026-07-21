import { describe, expect, it } from "vitest";
import type { IrTableRow } from "../src/ir/data";
import type { SkipRange, TableMergeRect } from "../src/ir/table-merge";
import { computeChunkMerges, subtractSkips } from "../src/ir/table-merge";
import type { IrColumn, IrTableElement } from "../src/ir/types";

function table(overrides: Partial<IrTableElement> = {}): IrTableElement {
  const columns: readonly IrColumn[] = [
    { key: "a", label: "A", width: 30, align: "left" },
    { key: "b", label: "B", width: 30, align: "left" },
    { key: "c", label: "C", width: 30, align: "left" },
  ];
  return {
    type: "table",
    id: "tbl",
    x: 10,
    y: 10,
    bind: "items",
    columns,
    rowHeight: 10,
    headerHeight: 10,
    fontSize: 10,
    maxY: 200,
    continuationY: 10,
    minRows: 0,
    ...overrides,
  };
}

function mergeCol(key: string, width = 30): IrColumn {
  return {
    key,
    label: key.toUpperCase(),
    width,
    align: "left",
    mergeSameValue: true,
  };
}

function rowsOf(...values: readonly (readonly string[])[]): IrTableRow[] {
  return values.map(([a, b, c]) => ({
    a: a ?? "",
    b: b ?? "",
    c: c ?? "",
  }));
}

describe("computeChunkMerges — static cellSpans", () => {
  it("header colSpan produces a rect plus covered cells and vertical rule skips in every chunk", () => {
    const t = table({ cellSpans: [{ row: "header", key: "a", colSpan: 2 }] });
    for (const rowOffset of [0, 5]) {
      const merges = computeChunkMerges(t, [], rowOffset, 3);
      expect(merges.rects).toEqual([
        { q: "header", col: 0, rowSpan: 1, colSpan: 2 },
      ]);
      expect([...merges.covered]).toEqual(["header:1"]);
      expect(merges.horizontalSkips.size).toBe(0);
      expect(merges.verticalSkips.get(1)).toEqual([{ start: -1, end: 0 }]);
    }
  });

  it("detail rowSpan × colSpan produces exactly the right covered cells and rule skips", () => {
    const t = table({
      cellSpans: [{ row: 1, key: "a", rowSpan: 2, colSpan: 2 }],
    });
    const merges = computeChunkMerges(t, rowsOf([], [], [], []), 0, 4);
    expect(merges.rects).toEqual([{ q: 1, col: 0, rowSpan: 2, colSpan: 2 }]);
    expect([...merges.covered].sort()).toEqual(["1:1", "2:0", "2:1"]);
    expect(merges.horizontalSkips.get(2)).toEqual([{ start: 0, end: 2 }]);
    expect(merges.verticalSkips.get(1)).toEqual([{ start: 1, end: 3 }]);
    expect(merges.verticalSkips.has(2)).toBe(false);
  });

  it("cut off at a chunk boundary produces an origin rect on both sides", () => {
    const t = table({ cellSpans: [{ row: 1, key: "b", rowSpan: 4 }] });
    const rows = rowsOf([], [], [], [], []);
    const first = computeChunkMerges(t, rows, 0, 3);
    expect(first.rects).toEqual([{ q: 1, col: 1, rowSpan: 2, colSpan: 1 }]);
    const second = computeChunkMerges(t, rows, 3, 3);
    expect(second.rects).toEqual([{ q: 0, col: 1, rowSpan: 2, colSpan: 1 }]);
  });

  it("a merge whose origin is outside the output range is inactive, and colSpan exceeding the range is clamped", () => {
    const t = table({
      cellSpans: [
        { row: 9, key: "a", rowSpan: 2 },
        { row: 0, key: "b", colSpan: 5 },
      ],
    });
    const merges = computeChunkMerges(t, rowsOf([], []), 0, 2);
    expect(merges.rects).toEqual([{ q: 0, col: 1, rowSpan: 1, colSpan: 2 }]);
  });

  it("ignores a merge whose key isn't in columns", () => {
    const t = table({ cellSpans: [{ row: 0, key: "zzz", rowSpan: 2 }] });
    const merges = computeChunkMerges(t, rowsOf([], []), 0, 2);
    expect(merges.rects).toEqual([]);
  });
});

describe("computeChunkMerges — data-driven mergeSameValue", () => {
  it("merges the maximal run of consecutive identical values into one, without merging single rows or empty strings", () => {
    const t = table({
      columns: [
        mergeCol("a"),
        { key: "b", label: "B", width: 30, align: "left" },
        { key: "c", label: "C", width: 30, align: "left" },
      ],
    });
    const rows = rowsOf(
      ["x"],
      ["x"],
      ["y"],
      ["", ""],
      ["", ""],
      ["z"],
      ["z"],
      ["z"],
    );
    const merges = computeChunkMerges(t, rows, 0, 8);
    expect(merges.rects).toEqual([
      { q: 0, col: 0, rowSpan: 2, colSpan: 1 },
      { q: 5, col: 0, rowSpan: 3, colSpan: 1 },
    ]);
    expect(merges.horizontalSkips.get(1)).toEqual([{ start: 0, end: 1 }]);
    expect(merges.horizontalSkips.has(4)).toBe(false);
  });

  it("a run boundary in the left mergeSameValue column cuts the merge in the right column", () => {
    const t = table({
      columns: [
        mergeCol("a"),
        mergeCol("b"),
        { key: "c", label: "C", width: 30, align: "left" },
      ],
    });
    const rows = rowsOf(["g1", "v"], ["g1", "v"], ["g2", "v"], ["g2", "v"]);
    const merges = computeChunkMerges(t, rows, 0, 4);
    expect(merges.rects).toEqual([
      { q: 0, col: 0, rowSpan: 2, colSpan: 1 },
      { q: 2, col: 0, rowSpan: 2, colSpan: 1 },
      { q: 0, col: 1, rowSpan: 2, colSpan: 1 },
      { q: 2, col: 1, rowSpan: 2, colSpan: 1 },
    ]);
  });

  it("boundary propagation is transitive (a boundary in the leftmost column also affects the third column)", () => {
    const t = table({
      columns: [mergeCol("a"), mergeCol("b"), mergeCol("c")],
    });
    const rows = rowsOf(
      ["g1", "v", "w"],
      ["g2", "v", "w"],
      ["g2", "u", "w"],
      ["g2", "u", "w"],
    );
    const merges = computeChunkMerges(t, rows, 0, 4);
    // a: boundary t=1. b: value boundary t=2 + boundary t=1 inherited from a → [1,2) has no merge on its own, [2,4) merges.
    // c: all rows are "w", but it's cut at boundaries t=1, t=2 from a/b, so only [2,4) merges
    expect(merges.rects).toEqual([
      { q: 1, col: 0, rowSpan: 3, colSpan: 1 },
      { q: 2, col: 1, rowSpan: 2, colSpan: 1 },
      { q: 2, col: 2, rowSpan: 2, colSpan: 1 },
    ]);
  });

  it("chunk truncation creates an origin on both sides, returning rects shaped so pagination is unaffected", () => {
    const t = table({ columns: [mergeCol("a"), mergeCol("b"), mergeCol("c")] });
    const rows = rowsOf(["x"], ["x"], ["x"], ["x"]);
    const first = computeChunkMerges(t, rows, 0, 2);
    const second = computeChunkMerges(t, rows, 2, 2);
    expect(first.rects).toEqual([{ q: 0, col: 0, rowSpan: 2, colSpan: 1 }]);
    expect(second.rects).toEqual([{ q: 0, col: 0, rowSpan: 2, colSpan: 1 }]);
  });

  it("covered and skips exactly match the internal boundaries of rects", () => {
    const t = table({
      columns: [mergeCol("a"), mergeCol("b"), mergeCol("c")],
      cellSpans: [{ row: "header", key: "b", colSpan: 2 }],
    });
    const rows = rowsOf(["x", "y"], ["x", "y"], ["x", "z"]);
    const merges = computeChunkMerges(t, rows, 0, 3);
    const expectedCovered = new Set<string>();
    const expectedH = new Map<number, SkipRange[]>();
    const expectedV = new Map<number, SkipRange[]>();
    for (const rect of merges.rects) {
      if (rect.q === "header") {
        for (let c = rect.col + 1; c < rect.col + rect.colSpan; c++) {
          expectedCovered.add(`header:${c}`);
          expectedV.set(c, [
            ...(expectedV.get(c) ?? []),
            { start: -1, end: 0 },
          ]);
        }
        continue;
      }
      for (let r = rect.q; r < rect.q + rect.rowSpan; r++) {
        for (let c = rect.col; c < rect.col + rect.colSpan; c++) {
          if (r !== rect.q || c !== rect.col) expectedCovered.add(`${r}:${c}`);
        }
      }
      for (let line = rect.q + 1; line < rect.q + rect.rowSpan; line++) {
        expectedH.set(line, [
          ...(expectedH.get(line) ?? []),
          { start: rect.col, end: rect.col + rect.colSpan },
        ]);
      }
      for (let c = rect.col + 1; c < rect.col + rect.colSpan; c++) {
        expectedV.set(c, [
          ...(expectedV.get(c) ?? []),
          { start: rect.q, end: rect.q + rect.rowSpan },
        ]);
      }
    }
    expect(new Set(merges.covered)).toEqual(expectedCovered);
    expect(new Map(merges.horizontalSkips)).toEqual(expectedH);
    expect(new Map(merges.verticalSkips)).toEqual(expectedV);
  });

  it("a table with no merges has all-empty structures", () => {
    const merges = computeChunkMerges(table(), rowsOf(["x"], ["x"]), 0, 2);
    expect(merges.rects).toEqual([]);
    expect(merges.covered.size).toBe(0);
    expect(merges.horizontalSkips.size).toBe(0);
    expect(merges.verticalSkips.size).toBe(0);
  });
});

describe("subtractSkips", () => {
  it("with no skips, returns the whole range as one segment", () => {
    expect(subtractSkips(-1, 5, undefined)).toEqual([{ start: -1, end: 5 }]);
    expect(subtractSkips(0, 3, [])).toEqual([{ start: 0, end: 3 }]);
  });

  it("returns the remaining segments after removing skips in the middle and at the ends", () => {
    expect(
      subtractSkips(0, 6, [
        { start: 4, end: 5 },
        { start: 1, end: 2 },
      ]),
    ).toEqual([
      { start: 0, end: 1 },
      { start: 2, end: 4 },
      { start: 5, end: 6 },
    ]);
    expect(subtractSkips(-1, 3, [{ start: -1, end: 0 }])).toEqual([
      { start: 0, end: 3 },
    ]);
  });

  it("a full-range skip yields empty, and overlapping/out-of-range skips are tolerated", () => {
    expect(subtractSkips(0, 2, [{ start: 0, end: 2 }])).toEqual([]);
    expect(
      subtractSkips(0, 4, [
        { start: 1, end: 3 },
        { start: 2, end: 5 },
      ]),
    ).toEqual([{ start: 0, end: 1 }]);
  });
});

describe("computeChunkMerges — rect type", () => {
  it("rects' q holds either a number or 'header'", () => {
    const t = table({
      columns: [mergeCol("a"), mergeCol("b"), mergeCol("c")],
      cellSpans: [{ row: "header", key: "b", colSpan: 2 }],
    });
    const merges = computeChunkMerges(t, rowsOf(["x"], ["x"]), 0, 2);
    const qs = merges.rects.map((rect: TableMergeRect) => rect.q);
    expect(qs).toContain("header");
    expect(qs).toContain(0);
  });
});
