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
  it("bind 行と上書きを合成する（上書きが優先）", () => {
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

  it("bind 行の一部の型が不正でも、他のセルは表示する", () => {
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

  it("bind が欠落していても上書きだけは表示する", () => {
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

  it("不正 JSON・空文字列でも空行扱いで例外を投げない", () => {
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

  it("bind 行の同一値連続を結合し、表示行数で打ち切る", () => {
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

  it("上書き適用後の値で結合を判定する（上書きで区間が切れる）", () => {
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

  it("cells が空でも静的 cellSpans は結合される", () => {
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

  it("minRows の空行（空文字列）は誤結合しない", () => {
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
  it("1×1 は拒否する", () => {
    expect(canMergeCellRect(table(), rect())).toBe(false);
  });

  it("列範囲が表の列数を超える範囲は拒否する", () => {
    expect(canMergeCellRect(table(), rect({ colStart: 0, colEnd: 2 }))).toBe(
      false,
    );
  });

  it("mergeSameValue 列を含む範囲は拒否する（起点列を含む）", () => {
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

  it("既存の明細結合と重なる範囲は拒否する", () => {
    const t = table({ cellSpans: [{ row: 0, key: "name", rowSpan: 2 }] });
    expect(
      canMergeCellRect(
        t,
        rect({ rowStart: 0, rowEnd: 1, colStart: 0, colEnd: 1 }),
      ),
    ).toBe(false);
  });

  it("既存のヘッダ結合と重なる範囲は拒否する", () => {
    const t = table({
      cellSpans: [{ row: "header", key: "name", colSpan: 2 }],
    });
    expect(
      canMergeCellRect(t, rect({ header: true, colStart: 0, colEnd: 1 })),
    ).toBe(false);
  });

  it("ヘッダの結合は明細の範囲とは重ならない", () => {
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

  it("ヘッダ横2列の結合は許可する", () => {
    expect(
      canMergeCellRect(table(), rect({ header: true, colStart: 0, colEnd: 1 })),
    ).toBe(true);
  });

  it("正常な縦2行・横2列の結合は許可する", () => {
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
  it("縦のみの結合は rowSpan のみを持つ", () => {
    const span = cellSpanForRect(
      table(),
      rect({ rowStart: 0, rowEnd: 1, colStart: 0, colEnd: 0 }),
    );
    expect(span).toEqual({ row: 0, key: "name", rowSpan: 2 });
  });

  it("横のみの結合は colSpan のみを持つ", () => {
    const span = cellSpanForRect(
      table(),
      rect({ rowStart: 0, rowEnd: 0, colStart: 0, colEnd: 1 }),
    );
    expect(span).toEqual({ row: 0, key: "name", colSpan: 2 });
  });

  it('header 矩形は row: "header" に変換し rowSpan を持たない', () => {
    const span = cellSpanForRect(
      table(),
      rect({ header: true, colStart: 0, colEnd: 1 }),
    );
    expect(span).toEqual({ row: "header", key: "name", colSpan: 2 });
  });

  it("colStart の列 key を起点にする", () => {
    const span = cellSpanForRect(
      table(),
      rect({ rowStart: 0, rowEnd: 1, colStart: 1, colEnd: 1 }),
    );
    expect(span).toEqual({ row: 0, key: "amount", rowSpan: 2 });
  });

  it("colStart の列が存在しなければ null を返す", () => {
    const span = cellSpanForRect(table(), rect({ colStart: 5, colEnd: 5 }));
    expect(span).toBeNull();
  });
});

describe("spanIndicesIntersecting", () => {
  it("交差する結合の index を列挙する", () => {
    const t = table({ cellSpans: [{ row: 0, key: "name", rowSpan: 2 }] });
    expect(
      spanIndicesIntersecting(
        t,
        rect({ rowStart: 0, rowEnd: 0, colStart: 0, colEnd: 0 }),
      ),
    ).toEqual([0]);
  });

  it("交差しない結合は含まない", () => {
    const t = table({ cellSpans: [{ row: 0, key: "name", rowSpan: 2 }] });
    expect(
      spanIndicesIntersecting(
        t,
        rect({ rowStart: 5, rowEnd: 5, colStart: 1, colEnd: 1 }),
      ),
    ).toEqual([]);
  });
});
