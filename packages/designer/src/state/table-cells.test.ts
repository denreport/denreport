import type { IrDocument, IrTableElement } from "@denreport/core";
import { describe, expect, it } from "vitest";
import {
  canMergeCellRect,
  cellSpanForRect,
  cellView,
  sketchMerges,
  spanIndicesIntersecting,
  type TableCellRect,
  tableCellSources,
} from "./table-cells";

function table(overrides: Partial<IrTableElement> = {}): IrTableElement {
  return {
    type: "table",
    id: "tbl1",
    x: 10,
    y: 10,
    bind: "items",
    columns: [
      { key: "name", label: "品目", width: 40, align: "left" },
      { key: "amount", label: "金額", width: 30, align: "right" },
    ],
    rowHeight: 8,
    headerHeight: 8,
    fontSize: 10,
    maxY: 200,
    continuationY: 10,
    minRows: 0,
    ...overrides,
  };
}

function docOf(
  ...elements: readonly IrDocument["elements"][number][]
): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements,
  };
}

describe("tableCellSources / cellView", () => {
  it("combines bind rows with overrides (overrides take priority)", () => {
    const doc = docOf(
      table({ cellOverrides: [{ row: 0, key: "name", value: "固定値" }] }),
    );
    const sampleJson = JSON.stringify({
      items: [
        { name: "item0", amount: "10" },
        { name: "item1", amount: "20" },
      ],
    });
    const sources = tableCellSources(doc, sampleJson);
    const source = sources.get("tbl1");
    if (source === undefined) throw new Error("expected a source");

    expect(cellView(source, 0, "name")).toEqual({
      text: "固定値",
      overridden: true,
    });
    expect(cellView(source, 0, "amount")).toEqual({
      text: "10",
      overridden: false,
    });
    expect(cellView(source, 1, "name")).toEqual({
      text: "item1",
      overridden: false,
    });
  });

  it("still displays other cells even if some bind row types are invalid", () => {
    const doc = docOf(table());
    const sampleJson = JSON.stringify({
      items: [{ name: "item0", amount: 10 }, "not an object"],
    });
    const sources = tableCellSources(doc, sampleJson);
    const source = sources.get("tbl1");
    if (source === undefined) throw new Error("expected a source");

    expect(cellView(source, 0, "name")).toEqual({
      text: "item0",
      overridden: false,
    });
    expect(cellView(source, 0, "amount")).toEqual({
      text: "",
      overridden: false,
    });
    expect(cellView(source, 1, "name")).toEqual({
      text: "",
      overridden: false,
    });
  });

  it("shows only the override even when the bind is missing", () => {
    const doc = docOf(
      table({ cellOverrides: [{ row: 0, key: "name", value: "仮値" }] }),
    );
    const sources = tableCellSources(doc, "{}");
    const source = sources.get("tbl1");
    if (source === undefined) throw new Error("expected a source");

    expect(cellView(source, 0, "name")).toEqual({
      text: "仮値",
      overridden: true,
    });
    expect(cellView(source, 0, "amount")).toEqual({
      text: "",
      overridden: false,
    });
  });

  it("treats invalid JSON or an empty string as empty rows without throwing", () => {
    const doc = docOf(table());
    expect(() => tableCellSources(doc, "{not json")).not.toThrow();
    expect(() => tableCellSources(doc, "")).not.toThrow();
    const source = tableCellSources(doc, "")?.get("tbl1");
    if (source === undefined) throw new Error("expected a source");
    expect(cellView(source, 0, "name")).toEqual({
      text: "",
      overridden: false,
    });
  });
});

describe("sketchMerges", () => {
  function sourceOf(doc: IrDocument, sampleJson: string) {
    const source = tableCellSources(doc, sampleJson).get("tbl1");
    if (source === undefined) throw new Error("expected a source");
    return source;
  }

  it("merges consecutive identical values in bind rows, capped at the displayed row count", () => {
    const doc = docOf(
      table({
        columns: [
          {
            key: "name",
            label: "品目",
            width: 40,
            align: "left",
            mergeSameValue: true,
          },
          { key: "amount", label: "金額", width: 30, align: "right" },
        ],
      }),
    );
    const el = doc.elements[0];
    if (el?.type !== "table") throw new Error("expected a table");
    const sampleJson = JSON.stringify({
      items: [
        { name: "同じ", amount: "10" },
        { name: "同じ", amount: "20" },
        { name: "同じ", amount: "30" },
      ],
    });
    const merges = sketchMerges(el, sourceOf(doc, sampleJson), 2);
    expect(merges.rects).toEqual([{ q: 0, col: 0, rowSpan: 2, colSpan: 1 }]);
    expect([...merges.covered]).toEqual(["1:0"]);
  });

  it("judges merging using post-override values (an override breaks the run)", () => {
    const doc = docOf(
      table({
        columns: [
          {
            key: "name",
            label: "品目",
            width: 40,
            align: "left",
            mergeSameValue: true,
          },
          { key: "amount", label: "金額", width: 30, align: "right" },
        ],
        cellOverrides: [{ row: 1, key: "name", value: "別の値" }],
      }),
    );
    const el = doc.elements[0];
    if (el?.type !== "table") throw new Error("expected a table");
    const sampleJson = JSON.stringify({
      items: [
        { name: "同じ", amount: "10" },
        { name: "同じ", amount: "20" },
        { name: "同じ", amount: "30" },
      ],
    });
    const merges = sketchMerges(el, sourceOf(doc, sampleJson), 3);
    expect(merges.rects).toEqual([]);
  });

  it("merges static cellSpans even when cells is empty", () => {
    const doc = docOf(
      table({ cellSpans: [{ row: "header", key: "name", colSpan: 2 }] }),
    );
    const el = doc.elements[0];
    if (el?.type !== "table") throw new Error("expected a table");
    const merges = sketchMerges(el, { rows: [], overrides: new Map() }, 3);
    expect(merges.rects).toEqual([
      { q: "header", col: 0, rowSpan: 1, colSpan: 2 },
    ]);
    expect([...merges.covered]).toEqual(["header:1"]);
  });

  it("does not falsely merge minRows empty rows (empty strings)", () => {
    const doc = docOf(
      table({
        columns: [
          {
            key: "name",
            label: "品目",
            width: 40,
            align: "left",
            mergeSameValue: true,
          },
          { key: "amount", label: "金額", width: 30, align: "right" },
        ],
      }),
    );
    const el = doc.elements[0];
    if (el?.type !== "table") throw new Error("expected a table");
    const merges = sketchMerges(el, { rows: [], overrides: new Map() }, 4);
    expect(merges.rects).toEqual([]);
  });
});

function rect(patch: Partial<TableCellRect> = {}): TableCellRect {
  return {
    header: false,
    rowStart: 0,
    rowEnd: 0,
    colStart: 0,
    colEnd: 0,
    ...patch,
  };
}

describe("canMergeCellRect", () => {
  it("rejects a 1x1 rect", () => {
    expect(canMergeCellRect(table(), rect())).toBe(false);
  });

  it("rejects a range whose columns exceed the table's column count", () => {
    expect(canMergeCellRect(table(), rect({ colStart: 0, colEnd: 2 }))).toBe(
      false,
    );
  });

  it("rejects a range that includes a mergeSameValue column (including the origin column)", () => {
    const mergeAtOrigin = table({
      columns: [
        {
          key: "name",
          label: "品目",
          width: 40,
          align: "left",
          mergeSameValue: true,
        },
        { key: "amount", label: "金額", width: 30, align: "right" },
      ],
    });
    expect(
      canMergeCellRect(mergeAtOrigin, rect({ colStart: 0, colEnd: 1 })),
    ).toBe(false);

    const mergeAtEnd = table({
      columns: [
        { key: "name", label: "品目", width: 40, align: "left" },
        {
          key: "amount",
          label: "金額",
          width: 30,
          align: "right",
          mergeSameValue: true,
        },
      ],
    });
    expect(canMergeCellRect(mergeAtEnd, rect({ colStart: 0, colEnd: 1 }))).toBe(
      false,
    );
  });

  it("rejects a range overlapping an existing detail-row merge", () => {
    const t = table({ cellSpans: [{ row: 0, key: "name", rowSpan: 2 }] });
    expect(
      canMergeCellRect(
        t,
        rect({ rowStart: 0, rowEnd: 1, colStart: 0, colEnd: 1 }),
      ),
    ).toBe(false);
  });

  it("rejects a range overlapping an existing header merge", () => {
    const t = table({
      cellSpans: [{ row: "header", key: "name", colSpan: 2 }],
    });
    expect(
      canMergeCellRect(t, rect({ header: true, colStart: 0, colEnd: 1 })),
    ).toBe(false);
  });

  it("a header merge does not overlap with the detail-row range", () => {
    const t = table({
      cellSpans: [{ row: "header", key: "name", colSpan: 2 }],
    });
    expect(
      canMergeCellRect(
        t,
        rect({ rowStart: 0, rowEnd: 1, colStart: 0, colEnd: 1 }),
      ),
    ).toBe(true);
  });

  it("allows merging 2 header columns horizontally", () => {
    expect(
      canMergeCellRect(table(), rect({ header: true, colStart: 0, colEnd: 1 })),
    ).toBe(true);
  });

  it("allows a normal 2-row-by-2-column merge", () => {
    expect(
      canMergeCellRect(
        table(),
        rect({ rowStart: 0, rowEnd: 1, colStart: 0, colEnd: 0 }),
      ),
    ).toBe(true);
    expect(
      canMergeCellRect(
        table(),
        rect({ rowStart: 0, rowEnd: 0, colStart: 0, colEnd: 1 }),
      ),
    ).toBe(true);
  });
});

describe("cellSpanForRect", () => {
  it("a vertical-only merge has only rowSpan", () => {
    const span = cellSpanForRect(
      table(),
      rect({ rowStart: 0, rowEnd: 1, colStart: 0, colEnd: 0 }),
    );
    expect(span).toEqual({ row: 0, key: "name", rowSpan: 2 });
  });

  it("a horizontal-only merge has only colSpan", () => {
    const span = cellSpanForRect(
      table(),
      rect({ rowStart: 0, rowEnd: 0, colStart: 0, colEnd: 1 }),
    );
    expect(span).toEqual({ row: 0, key: "name", colSpan: 2 });
  });

  it('converts a header rect to row: "header" with no rowSpan', () => {
    const span = cellSpanForRect(
      table(),
      rect({ header: true, colStart: 0, colEnd: 1 }),
    );
    expect(span).toEqual({ row: "header", key: "name", colSpan: 2 });
  });

  it("uses colStart's column key as the origin", () => {
    const span = cellSpanForRect(
      table(),
      rect({ rowStart: 0, rowEnd: 1, colStart: 1, colEnd: 1 }),
    );
    expect(span).toEqual({ row: 0, key: "amount", rowSpan: 2 });
  });

  it("returns null when colStart's column does not exist", () => {
    const span = cellSpanForRect(table(), rect({ colStart: 5, colEnd: 5 }));
    expect(span).toBeNull();
  });
});

describe("spanIndicesIntersecting", () => {
  it("lists indices of merges that intersect", () => {
    const t = table({ cellSpans: [{ row: 0, key: "name", rowSpan: 2 }] });
    expect(
      spanIndicesIntersecting(
        t,
        rect({ rowStart: 0, rowEnd: 0, colStart: 0, colEnd: 0 }),
      ),
    ).toEqual([0]);
  });

  it("excludes merges that don't intersect", () => {
    const t = table({ cellSpans: [{ row: 0, key: "name", rowSpan: 2 }] });
    expect(
      spanIndicesIntersecting(
        t,
        rect({ rowStart: 5, rowEnd: 5, colStart: 1, colEnd: 1 }),
      ),
    ).toEqual([]);
  });
});
