import type {
  IrDocument,
  IrElement,
  IrFlexChild,
  IrFlexElement,
  IrImageElement,
  IrTableElement,
  IrTextElement,
} from "@denreport/core";
import { parseIr, validateIr } from "@denreport/core";
import { describe, expect, it } from "vitest";
import { ja } from "../i18n/messages/ja";
import {
  addTableCellSpan,
  addTableColumn,
  appendTableCellSpan,
  moveTableColumn,
  removeTableCellSpan,
  removeTableCellSpansAt,
  removeTableColumn,
  replaceElement,
  setDocType,
  setFlexDirection,
  setFlexMainSize,
  setFontRegular,
  setFontSlot,
  setImageSrc,
  setPage,
  setTableCellOverride,
  updateElements,
  updateTableCellSpan,
  updateTableColumn,
} from "./properties";

const TEXT: IrTextElement = {
  type: "text",
  id: "t1",
  x: 10,
  y: 10,
  pages: "first",
  w: 40,
  h: 8,
  text: "見出し",
  fontSize: 10,
  align: "left",
  lineHeight: 1.25,
};

const INNER_RECT: IrFlexChild = {
  type: "rect",
  id: "rc1",
  w: 10,
  h: 8,
  borderWidth: 0.3,
};

const INNER_FLEX: IrFlexChild = {
  type: "flex",
  id: "f2",
  direction: "row",
  gap: 1,
  justifyContent: "start",
  alignItems: "start",
  children: [INNER_RECT],
};

const CHILD_TEXT: IrFlexChild = {
  type: "text",
  id: "c1",
  w: 40,
  h: 8,
  text: "子",
  fontSize: 10,
  align: "left",
  lineHeight: 1.25,
};

const FLEX: IrFlexElement = {
  type: "flex",
  id: "f1",
  x: 10,
  y: 40,
  pages: "first",
  direction: "column",
  h: 30,
  gap: 2,
  justifyContent: "start",
  alignItems: "start",
  children: [CHILD_TEXT, INNER_FLEX],
};

const TABLE: IrTableElement = {
  type: "table",
  id: "tbl1",
  x: 10,
  y: 90,
  bind: "items",
  columns: [
    { key: "col1", label: "列1", width: 40, align: "left" },
    { key: "col3", label: "列3", width: 40, align: "right" },
  ],
  rowHeight: 8,
  headerHeight: 8,
  fontSize: 10,
  maxY: 240,
  continuationY: 20,
  minRows: 3,
};

const IMAGE: IrImageElement = {
  type: "image",
  id: "img1",
  x: 60,
  y: 10,
  pages: "first",
  w: 30,
  h: 30,
  src: "data:image/png;base64,AA==",
};

const BASE: IrDocument = {
  version: "1.0",
  page: { width: 210, height: 297 },
  font: { regular: "NotoSansJP" },
  elements: [TEXT, FLEX, TABLE, IMAGE],
};

function expectValidIr(document: IrDocument): void {
  const result = parseIr(JSON.stringify(document));
  expect(result.ok).toBe(true);
}

function findById(
  document: IrDocument,
  id: string,
): IrElement | IrFlexChild | undefined {
  function visit(
    el: IrElement | IrFlexChild,
  ): IrElement | IrFlexChild | undefined {
    if (el.id === id) {
      return el;
    }
    if (el.type === "flex") {
      for (const child of el.children) {
        const found = visit(child);
        if (found !== undefined) {
          return found;
        }
      }
    }
    return undefined;
  }
  for (const el of document.elements) {
    const found = visit(el);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

describe("replaceElement", () => {
  it("トップレベル要素を置換し、無関係要素の参照を維持する", () => {
    const next = { ...TEXT, fontSize: 12 };
    const doc = replaceElement(BASE, "t1", next);
    expect(doc).not.toBe(BASE);
    expect(findById(doc, "t1")).toBe(next);
    expect(doc.elements[1]).toBe(BASE.elements[1]);
    expect(doc.elements[2]).toBe(BASE.elements[2]);
    expectValidIr(doc);
  });

  it("入れ子 flex の子孫を置換できる", () => {
    const next = { ...INNER_RECT, borderWidth: 0.5 };
    const doc = replaceElement(BASE, "rc1", next);
    expect(findById(doc, "rc1")).toBe(next);
    expect(doc.elements[0]).toBe(BASE.elements[0]);
    expect(doc.elements[2]).toBe(BASE.elements[2]);
    expectValidIr(doc);
  });

  it("未知 id は同一参照を返す", () => {
    expect(replaceElement(BASE, "nope", { ...TEXT, id: "nope" })).toBe(BASE);
  });

  it("元の文書を変更しない", () => {
    const snapshot = structuredClone(BASE);
    replaceElement(BASE, "t1", { ...TEXT, fontSize: 12 });
    setFlexDirection(BASE, "f1", "row");
    setFlexMainSize(BASE, "f2", 30);
    addTableColumn(BASE, "tbl1", ja.defaults);
    removeTableColumn(BASE, "tbl1", 0);
    moveTableColumn(BASE, "tbl1", 0, 1);
    updateTableColumn(BASE, "tbl1", 0, { width: 50 });
    setTableCellOverride(BASE, "tbl1", 0, "col1", "固定値");
    setImageSrc(BASE, "img1", "data:image/png;base64,BB==");
    setPage(BASE, { width: 297, height: 420 });
    setFontRegular(BASE, "IPAexGothic");
    setFontSlot(BASE, "bold", "IPAexGothicBold");
    expect(BASE).toEqual(snapshot);
  });
});

describe("updateElements", () => {
  function bumpFontSize(el: IrElement | IrFlexChild): IrElement | IrFlexChild {
    return "fontSize" in el ? { ...el, fontSize: el.fontSize + 2 } : el;
  }

  it("複数 id へ同一 update を適用する", () => {
    const doc = updateElements(BASE, ["t1", "c1"], bumpFontSize);
    expect(findById(doc, "t1")).toMatchObject({ fontSize: 12 });
    expect(findById(doc, "c1")).toMatchObject({ fontSize: 12 });
    expect(doc.elements[2]).toBe(BASE.elements[2]);
    expect(doc.elements[3]).toBe(BASE.elements[3]);
    expectValidIr(doc);
  });

  it("入れ子 flex の子孫 id を含めて適用できる", () => {
    const doc = updateElements(BASE, ["rc1"], (el) =>
      el.type === "rect" ? { ...el, borderWidth: 0.5 } : el,
    );
    expect(findById(doc, "rc1")).toMatchObject({ borderWidth: 0.5 });
    expectValidIr(doc);
  });

  it("全要素が無変化なら同一参照の document を返す", () => {
    const noop = (el: IrElement | IrFlexChild): IrElement | IrFlexChild =>
      "fontSize" in el && el.fontSize !== 10 ? { ...el, fontSize: 10 } : el;
    expect(updateElements(BASE, ["t1", "c1"], noop)).toBe(BASE);
  });

  it("存在しない id は無視する", () => {
    expect(updateElements(BASE, ["nope"], bumpFontSize)).toBe(BASE);
  });
});

describe("setImageSrc", () => {
  it("src のみを差し替える", () => {
    const doc = setImageSrc(BASE, "img1", "data:image/jpeg;base64,BB==");
    expect(findById(doc, "img1")).toEqual({
      ...IMAGE,
      src: "data:image/jpeg;base64,BB==",
    });
    expect(doc.elements[0]).toBe(BASE.elements[0]);
    expectValidIr(doc);
  });

  it("先行する別属性の編集を巻き戻さない（非同期読込完了時の適用を想定）", () => {
    const resized = replaceElement(BASE, "img1", { ...IMAGE, w: 50 });
    const doc = setImageSrc(resized, "img1", "data:image/jpeg;base64,BB==");
    expect(findById(doc, "img1")).toMatchObject({
      w: 50,
      src: "data:image/jpeg;base64,BB==",
    });
  });

  it("同値・非 image・未知 id では同一参照を返す", () => {
    expect(setImageSrc(BASE, "img1", IMAGE.src)).toBe(BASE);
    expect(setImageSrc(BASE, "t1", "data:image/png;base64,BB==")).toBe(BASE);
    expect(setImageSrc(BASE, "nope", "data:image/png;base64,BB==")).toBe(BASE);
  });
});

describe("setFlexDirection", () => {
  it("切替時に明示主軸寸法を除去し、children を維持する", () => {
    const doc = setFlexDirection(BASE, "f1", "row");
    const el = findById(doc, "f1");
    expect(el).toMatchObject({ direction: "row" });
    expect(el !== undefined && "w" in el && el.w !== undefined).toBe(false);
    expect(el !== undefined && "h" in el && el.h !== undefined).toBe(false);
    expect(el?.type === "flex" ? el.children : undefined).toBe(FLEX.children);
    expectValidIr(doc);
  });

  it("同じ direction は同一参照を返す", () => {
    expect(setFlexDirection(BASE, "f1", "column")).toBe(BASE);
  });
});

describe("setFlexMainSize", () => {
  it("row の主軸は w に roundMm 適用済みで入る", () => {
    const doc = setFlexMainSize(BASE, "f2", 30.14);
    expect(findById(doc, "f2")).toMatchObject({ w: 30.1 });
    expectValidIr(doc);
  });

  it("column の主軸は h に入る", () => {
    const doc = setFlexMainSize(BASE, "f1", 40);
    expect(findById(doc, "f1")).toMatchObject({ h: 40 });
    expectValidIr(doc);
  });

  it("undefined で属性を除去し、元々ないときは同一参照", () => {
    const doc = setFlexMainSize(BASE, "f1", undefined);
    const el = findById(doc, "f1");
    expect(el !== undefined && "h" in el && el.h !== undefined).toBe(false);
    expectValidIr(doc);
    expect(setFlexMainSize(doc, "f1", undefined)).toBe(doc);
  });
});

describe("列操作", () => {
  function columnsOf(document: IrDocument): IrTableElement["columns"] {
    const el = findById(document, "tbl1");
    if (el?.type !== "table") {
      throw new Error("table がない");
    }
    return el.columns;
  }

  it("addTableColumn は table 内の最小空き番号で末尾に追加する", () => {
    const doc = addTableColumn(BASE, "tbl1", ja.defaults);
    expect(columnsOf(doc).at(-1)).toEqual({
      key: "col2",
      label: "列2",
      width: 40,
      align: "left",
    });
    expectValidIr(doc);
  });

  it("removeTableColumn は指定列を消し、最後の1列では何もしない", () => {
    const doc = removeTableColumn(BASE, "tbl1", 0);
    expect(columnsOf(doc).map((c) => c.key)).toEqual(["col3"]);
    expect(removeTableColumn(doc, "tbl1", 0)).toBe(doc);
    expect(removeTableColumn(BASE, "tbl1", 9)).toBe(BASE);
    expectValidIr(doc);
  });

  it("removeTableColumn は削除した列を指す上書きも破棄する", () => {
    const withOverride = setTableCellOverride(
      BASE,
      "tbl1",
      0,
      "col1",
      "固定値",
    );
    const doc = removeTableColumn(withOverride, "tbl1", 0);
    const table = findById(doc, "tbl1");
    expect(table?.type === "table" ? table.cellOverrides : undefined).toBe(
      undefined,
    );
    expectValidIr(doc);
  });

  it("moveTableColumn は隣と入れ替え、端では何もしない", () => {
    const doc = moveTableColumn(BASE, "tbl1", 0, 1);
    expect(columnsOf(doc).map((c) => c.key)).toEqual(["col3", "col1"]);
    expect(moveTableColumn(BASE, "tbl1", 0, -1)).toBe(BASE);
    expect(moveTableColumn(BASE, "tbl1", 1, 1)).toBe(BASE);
    expectValidIr(doc);
  });

  it("updateTableColumn は patch を適用し、変化がなければ同一参照", () => {
    const doc = updateTableColumn(BASE, "tbl1", 1, { width: 55, key: "qty" });
    expect(columnsOf(doc)[1]).toEqual({
      key: "qty",
      label: "列3",
      width: 55,
      align: "right",
    });
    expect(updateTableColumn(BASE, "tbl1", 1, { width: 40 })).toBe(BASE);
    expect(updateTableColumn(BASE, "tbl1", 9, { width: 1 })).toBe(BASE);
    expectValidIr(doc);
  });

  it("updateTableColumn は key 変更時に上書きの key を付け替える", () => {
    const withOverride = setTableCellOverride(
      BASE,
      "tbl1",
      0,
      "col3",
      "固定値",
    );
    const doc = updateTableColumn(withOverride, "tbl1", 1, { key: "qty" });
    const table = findById(doc, "tbl1");
    expect(table?.type === "table" ? table.cellOverrides : undefined).toEqual([
      { row: 0, key: "qty", value: "固定値" },
    ]);
    expectValidIr(doc);
  });

  it("updateTableColumn は mergeSameValue を設定し、false で属性ごと除去する", () => {
    const on = updateTableColumn(BASE, "tbl1", 0, { mergeSameValue: true });
    expect(columnsOf(on)[0]).toEqual({
      key: "col1",
      label: "列1",
      width: 40,
      align: "left",
      mergeSameValue: true,
    });
    const off = updateTableColumn(on, "tbl1", 0, { mergeSameValue: false });
    expect(columnsOf(off)[0]).not.toHaveProperty("mergeSameValue");
    expect(updateTableColumn(BASE, "tbl1", 0, { mergeSameValue: false })).toBe(
      BASE,
    );
    expectValidIr(on);
  });
});

describe("セル結合の操作", () => {
  function spansOf(document: IrDocument): IrTableElement["cellSpans"] {
    const el = findById(document, "tbl1");
    if (el?.type !== "table") {
      throw new Error("table がない");
    }
    return el.cellSpans;
  }

  it("addTableCellSpan は先頭列・行0・縦2行の結合を末尾に追加する", () => {
    const doc = addTableCellSpan(BASE, "tbl1");
    expect(spansOf(doc)).toEqual([{ row: 0, key: "col1", rowSpan: 2 }]);
    expectValidIr(doc);
  });

  it("updateTableCellSpan は patch を適用し、rowSpan/colSpan の 1 は属性を持たせない", () => {
    const base = addTableCellSpan(BASE, "tbl1");
    const doc = updateTableCellSpan(base, "tbl1", 0, {
      key: "col3",
      rowSpan: 1,
      colSpan: 2,
    });
    expect(spansOf(doc)).toEqual([{ row: 0, key: "col3", colSpan: 2 }]);
    expect(spansOf(doc)?.[0]).not.toHaveProperty("rowSpan");
    expectValidIr(doc);
  });

  it("updateTableCellSpan は header 行への切替で rowSpan を除去する", () => {
    const base = addTableCellSpan(BASE, "tbl1");
    const doc = updateTableCellSpan(base, "tbl1", 0, {
      row: "header",
      colSpan: 2,
    });
    expect(spansOf(doc)).toEqual([{ row: "header", key: "col1", colSpan: 2 }]);
    expectValidIr(doc);
  });

  it("updateTableCellSpan は無変化・不在 index で同一参照を返す", () => {
    const base = addTableCellSpan(BASE, "tbl1");
    expect(updateTableCellSpan(base, "tbl1", 0, { rowSpan: 2 })).toBe(base);
    expect(updateTableCellSpan(base, "tbl1", 9, { rowSpan: 3 })).toBe(base);
  });

  it("removeTableCellSpan は指定 index を消し、0件になれば属性ごと除去する", () => {
    const one = addTableCellSpan(BASE, "tbl1");
    const two = addTableCellSpan(one, "tbl1");
    const doc = removeTableCellSpan(two, "tbl1", 1);
    expect(spansOf(doc)).toEqual([{ row: 0, key: "col1", rowSpan: 2 }]);
    const none = removeTableCellSpan(doc, "tbl1", 0);
    const table = findById(none, "tbl1");
    expect(
      table !== undefined && "cellSpans" in table ? table.cellSpans : undefined,
    ).toBe(undefined);
    expect(removeTableCellSpan(BASE, "tbl1", 0)).toBe(BASE);
    expectValidIr(none);
  });

  it("appendTableCellSpan は cellSpans 未定義の表に追加する", () => {
    const span = { row: "header" as const, key: "col1", colSpan: 2 };
    const doc = appendTableCellSpan(BASE, "tbl1", span);
    expect(spansOf(doc)).toEqual([span]);
    expectValidIr(doc);
  });

  it("appendTableCellSpan は既存の cellSpans に追記する", () => {
    const base = addTableCellSpan(BASE, "tbl1");
    const span = { row: "header" as const, key: "col3", colSpan: 2 };
    const doc = appendTableCellSpan(base, "tbl1", span);
    expect(spansOf(doc)).toEqual([{ row: 0, key: "col1", rowSpan: 2 }, span]);
    expectValidIr(doc);
  });

  it("removeTableCellSpansAt は複数 index をまとめて削除する", () => {
    const one = addTableCellSpan(BASE, "tbl1");
    const two = addTableCellSpan(one, "tbl1");
    const three = addTableCellSpan(two, "tbl1");
    const doc = removeTableCellSpansAt(three, "tbl1", [0, 2]);
    expect(spansOf(doc)).toEqual([{ row: 0, key: "col1", rowSpan: 2 }]);
    expectValidIr(doc);
  });

  it("removeTableCellSpansAt は 0件になれば cellSpans 属性ごと除去する", () => {
    const one = addTableCellSpan(BASE, "tbl1");
    const two = addTableCellSpan(one, "tbl1");
    const doc = removeTableCellSpansAt(two, "tbl1", [0, 1]);
    const table = findById(doc, "tbl1");
    expect(
      table !== undefined && "cellSpans" in table ? table.cellSpans : undefined,
    ).toBe(undefined);
    expectValidIr(doc);
  });

  it("removeTableCellSpansAt は該当なしなら同一参照を返す", () => {
    const one = addTableCellSpan(BASE, "tbl1");
    expect(removeTableCellSpansAt(one, "tbl1", [9])).toBe(one);
    expect(removeTableCellSpansAt(BASE, "tbl1", [0])).toBe(BASE);
  });

  it("removeTableColumn は削除した列を起点に指す結合も破棄する", () => {
    const withSpan = addTableCellSpan(BASE, "tbl1");
    const doc = removeTableColumn(withSpan, "tbl1", 0);
    const table = findById(doc, "tbl1");
    expect(
      table !== undefined && "cellSpans" in table ? table.cellSpans : undefined,
    ).toBe(undefined);
    expectValidIr(doc);
  });

  it("updateTableColumn の key 変更に結合の key が追随する", () => {
    const withSpan = addTableCellSpan(BASE, "tbl1");
    const doc = updateTableColumn(withSpan, "tbl1", 0, { key: "renamed" });
    expect(spansOf(doc)).toEqual([{ row: 0, key: "renamed", rowSpan: 2 }]);
    expectValidIr(doc);
  });

  it("moveTableColumn では結合は key 起点のまま列と一緒に動く", () => {
    const withSpan = addTableCellSpan(BASE, "tbl1");
    const doc = moveTableColumn(withSpan, "tbl1", 0, 1);
    expect(spansOf(doc)).toEqual([{ row: 0, key: "col1", rowSpan: 2 }]);
    expectValidIr(doc);
  });

  it("removeTableColumn は被覆列の削除で colSpan を切り詰める", () => {
    const three = addTableColumn(BASE, "tbl1", ja.defaults);
    const withSpan = updateTableCellSpan(
      addTableCellSpan(three, "tbl1"),
      "tbl1",
      0,
      { rowSpan: 1, colSpan: 3 },
    );
    const doc = removeTableColumn(withSpan, "tbl1", 1);
    expect(spansOf(doc)).toEqual([{ row: 0, key: "col1", colSpan: 2 }]);
    expect(validateIr(doc)).toEqual([]);
  });

  it("removeTableColumn で 1×1 になる結合は破棄する", () => {
    const withSpan = updateTableCellSpan(
      addTableCellSpan(BASE, "tbl1"),
      "tbl1",
      0,
      { rowSpan: 1, colSpan: 2 },
    );
    const doc = removeTableColumn(withSpan, "tbl1", 1);
    const table = findById(doc, "tbl1");
    expect(
      table !== undefined && "cellSpans" in table ? table.cellSpans : undefined,
    ).toBe(undefined);
    expect(validateIr(doc)).toEqual([]);
  });

  it("removeTableColumn の切り詰めで縦結合は維持される", () => {
    const withSpan = updateTableCellSpan(
      addTableCellSpan(BASE, "tbl1"),
      "tbl1",
      0,
      { rowSpan: 2, colSpan: 2 },
    );
    const doc = removeTableColumn(withSpan, "tbl1", 1);
    expect(spansOf(doc)).toEqual([{ row: 0, key: "col1", rowSpan: 2 }]);
    expect(validateIr(doc)).toEqual([]);
  });

  it("moveTableColumn で列範囲からはみ出す結合は切り詰め、1×1 なら破棄する", () => {
    const withSpan = updateTableCellSpan(
      addTableCellSpan(BASE, "tbl1"),
      "tbl1",
      0,
      { rowSpan: 1, colSpan: 2 },
    );
    const doc = moveTableColumn(withSpan, "tbl1", 0, 1);
    const table = findById(doc, "tbl1");
    expect(
      table !== undefined && "cellSpans" in table ? table.cellSpans : undefined,
    ).toBe(undefined);
    expect(validateIr(doc)).toEqual([]);
  });

  it("moveTableColumn の切り詰めで縦結合は維持される", () => {
    const withSpan = updateTableCellSpan(
      addTableCellSpan(BASE, "tbl1"),
      "tbl1",
      0,
      { rowSpan: 2, colSpan: 2 },
    );
    const doc = moveTableColumn(withSpan, "tbl1", 0, 1);
    expect(spansOf(doc)).toEqual([{ row: 0, key: "col1", rowSpan: 2 }]);
    expect(validateIr(doc)).toEqual([]);
  });

  it("moveTableColumn で mergeSameValue 列に掛かる結合は切り詰める", () => {
    const three = addTableColumn(BASE, "tbl1", ja.defaults);
    const merged = updateTableColumn(three, "tbl1", 2, {
      mergeSameValue: true,
    });
    const withSpan = updateTableCellSpan(
      addTableCellSpan(merged, "tbl1"),
      "tbl1",
      0,
      { rowSpan: 2, colSpan: 2 },
    );
    expect(validateIr(withSpan)).toEqual([]);
    const doc = moveTableColumn(withSpan, "tbl1", 1, 1);
    expect(spansOf(doc)).toEqual([{ row: 0, key: "col1", rowSpan: 2 }]);
    expect(validateIr(doc)).toEqual([]);
  });

  it("moveTableColumn で先行する結合に重なった結合は破棄する", () => {
    const three = addTableColumn(BASE, "tbl1", ja.defaults);
    const first = updateTableCellSpan(
      addTableCellSpan(three, "tbl1"),
      "tbl1",
      0,
      { rowSpan: 1, colSpan: 2 },
    );
    const second = updateTableCellSpan(
      addTableCellSpan(first, "tbl1"),
      "tbl1",
      1,
      { key: "col2", rowSpan: 2 },
    );
    expect(validateIr(second)).toEqual([]);
    const doc = moveTableColumn(second, "tbl1", 1, 1);
    expect(spansOf(doc)).toEqual([{ row: 0, key: "col1", colSpan: 2 }]);
    expect(validateIr(doc)).toEqual([]);
  });
});

describe("setTableCellOverride", () => {
  it("新規の (row, key) は末尾に追加される", () => {
    const doc = setTableCellOverride(BASE, "tbl1", 0, "col1", "固定値");
    const table = findById(doc, "tbl1");
    expect(table?.type === "table" ? table.cellOverrides : undefined).toEqual([
      { row: 0, key: "col1", value: "固定値" },
    ]);
    expectValidIr(doc);
  });

  it("既存の (row, key) は置換される", () => {
    const once = setTableCellOverride(BASE, "tbl1", 0, "col1", "旧値");
    const doc = setTableCellOverride(once, "tbl1", 0, "col1", "新値");
    const table = findById(doc, "tbl1");
    expect(table?.type === "table" ? table.cellOverrides : undefined).toEqual([
      { row: 0, key: "col1", value: "新値" },
    ]);
  });

  it("空文字列は上書きを削除し、0件になれば cellOverrides 属性ごと除去する", () => {
    const withOverride = setTableCellOverride(
      BASE,
      "tbl1",
      0,
      "col1",
      "固定値",
    );
    const doc = setTableCellOverride(withOverride, "tbl1", 0, "col1", "");
    const table = findById(doc, "tbl1");
    expect(
      table !== undefined && "cellOverrides" in table
        ? table.cellOverrides
        : undefined,
    ).toBe(undefined);
    expectValidIr(doc);
  });

  it("削除対象が無ければ同一参照、同値への再設定も同一参照", () => {
    expect(setTableCellOverride(BASE, "tbl1", 0, "col1", "")).toBe(BASE);
    const once = setTableCellOverride(BASE, "tbl1", 0, "col1", "固定値");
    expect(setTableCellOverride(once, "tbl1", 0, "col1", "固定値")).toBe(once);
  });
});

describe("文書設定", () => {
  it("setPage は page を置換し、同値なら同一参照", () => {
    const doc = setPage(BASE, { width: 297, height: 420 });
    expect(doc.page).toEqual({ width: 297, height: 420 });
    expect(doc.elements).toBe(BASE.elements);
    expect(setPage(BASE, { width: 210, height: 297 })).toBe(BASE);
    expectValidIr(doc);
  });

  it("setFontRegular は regular を置換し、同値なら同一参照", () => {
    const doc = setFontRegular(BASE, "IPAexGothic");
    expect(doc.font.regular).toBe("IPAexGothic");
    expect(setFontRegular(BASE, "NotoSansJP")).toBe(BASE);
    expectValidIr(doc);
  });

  it("setFontSlot はスロットを設定し、他スロットを保持する", () => {
    const doc = setFontSlot(BASE, "bold", "NotoSansJPBold");
    expect(doc.font).toEqual({
      regular: "NotoSansJP",
      bold: "NotoSansJPBold",
    });
    expect(setFontSlot(doc, "bold", "NotoSansJPBold")).toBe(doc);
    expectValidIr(doc);
  });

  it("setFontSlot(undefined) はスロット属性を除去し、未設定なら同一参照", () => {
    const withBold = setFontSlot(BASE, "bold", "NotoSansJPBold");
    const cleared = setFontSlot(withBold, "bold", undefined);
    expect(cleared.font).toEqual({ regular: "NotoSansJP" });
    expect(cleared.font).not.toHaveProperty("bold");
    expect(setFontSlot(BASE, "italic", undefined)).toBe(BASE);
    expectValidIr(cleared);
  });

  it("setDocType(true) は docType を付与し、既に付与済みなら同一参照", () => {
    const doc = setDocType(BASE, true);
    expect(doc.docType).toBe("qualifiedInvoice");
    expect(setDocType(doc, true)).toBe(doc);
    expectValidIr(doc);
  });

  it("setDocType(false) は docType をキーごと除去し、未付与なら同一参照", () => {
    const withType = setDocType(BASE, true);
    const doc = setDocType(withType, false);
    expect("docType" in doc).toBe(false);
    expect(setDocType(BASE, false)).toBe(BASE);
    expectValidIr(doc);
  });
});
