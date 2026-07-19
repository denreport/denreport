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

describe("computeChunkMerges — 静的 cellSpans", () => {
  it("ヘッダの colSpan は全チャンクで rect と被覆・垂直罫線スキップを生む", () => {
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

  it("明細の rowSpan × colSpan が被覆セルと罫線スキップを過不足なく生む", () => {
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

  it("チャンク境界で打ち切られ、前後の双方に起点 rect ができる", () => {
    const t = table({ cellSpans: [{ row: 1, key: "b", rowSpan: 4 }] });
    const rows = rowsOf([], [], [], [], []);
    const first = computeChunkMerges(t, rows, 0, 3);
    expect(first.rects).toEqual([{ q: 1, col: 1, rowSpan: 2, colSpan: 1 }]);
    const second = computeChunkMerges(t, rows, 3, 3);
    expect(second.rects).toEqual([{ q: 0, col: 1, rowSpan: 2, colSpan: 1 }]);
  });

  it("起点が出力範囲外の結合は不活性、colSpan の範囲超過は切り詰める", () => {
    const t = table({
      cellSpans: [
        { row: 9, key: "a", rowSpan: 2 },
        { row: 0, key: "b", colSpan: 5 },
      ],
    });
    const merges = computeChunkMerges(t, rowsOf([], []), 0, 2);
    expect(merges.rects).toEqual([{ q: 0, col: 1, rowSpan: 1, colSpan: 2 }]);
  });

  it("columns に無い key の結合は無視する", () => {
    const t = table({ cellSpans: [{ row: 0, key: "zzz", rowSpan: 2 }] });
    const merges = computeChunkMerges(t, rowsOf([], []), 0, 2);
    expect(merges.rects).toEqual([]);
  });
});

describe("computeChunkMerges — データ駆動 mergeSameValue", () => {
  it("連続する同一値の極大区間を1結合にし、単独行と空文字列は結合しない", () => {
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

  it("左の mergeSameValue 列の区間境界で右の列の結合が切れる", () => {
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

  it("境界の伝播は転移的（左端列の境界が3列目にも効く）", () => {
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
    // a: 境界 t=1。b: 値の境界 t=2 + a 由来 t=1 → [1,2) は単独で結合なし、[2,4) が結合。
    // c: 全行 "w" だが a・b の境界 t=1, t=2 で切れ、[2,4) のみ結合
    expect(merges.rects).toEqual([
      { q: 1, col: 0, rowSpan: 3, colSpan: 1 },
      { q: 2, col: 1, rowSpan: 2, colSpan: 1 },
      { q: 2, col: 2, rowSpan: 2, colSpan: 1 },
    ]);
  });

  it("チャンク打ち切りで双方に起点ができ、ページ割りには影響しない形の rect を返す", () => {
    const t = table({ columns: [mergeCol("a"), mergeCol("b"), mergeCol("c")] });
    const rows = rowsOf(["x"], ["x"], ["x"], ["x"]);
    const first = computeChunkMerges(t, rows, 0, 2);
    const second = computeChunkMerges(t, rows, 2, 2);
    expect(first.rects).toEqual([{ q: 0, col: 0, rowSpan: 2, colSpan: 1 }]);
    expect(second.rects).toEqual([{ q: 0, col: 0, rowSpan: 2, colSpan: 1 }]);
  });

  it("covered・skips が rects の内部境界と過不足なく一致する", () => {
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

  it("結合なしの表では全構造が空", () => {
    const merges = computeChunkMerges(table(), rowsOf(["x"], ["x"]), 0, 2);
    expect(merges.rects).toEqual([]);
    expect(merges.covered.size).toBe(0);
    expect(merges.horizontalSkips.size).toBe(0);
    expect(merges.verticalSkips.size).toBe(0);
  });
});

describe("subtractSkips", () => {
  it("スキップなしは全域1区間を返す", () => {
    expect(subtractSkips(-1, 5, undefined)).toEqual([{ start: -1, end: 5 }]);
    expect(subtractSkips(0, 3, [])).toEqual([{ start: 0, end: 3 }]);
  });

  it("中間・端のスキップを除いた残り区間を返す", () => {
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

  it("全域スキップは空、重なる・域外のスキップも許容する", () => {
    expect(subtractSkips(0, 2, [{ start: 0, end: 2 }])).toEqual([]);
    expect(
      subtractSkips(0, 4, [
        { start: 1, end: 3 },
        { start: 2, end: 5 },
      ]),
    ).toEqual([{ start: 0, end: 1 }]);
  });
});

describe("computeChunkMerges — rect 型", () => {
  it("rects の q は number または 'header' を持つ", () => {
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
