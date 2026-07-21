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
  it("replaces a top-level element while keeping references to unrelated elements", () => {
    const next = { ...TEXT, fontSize: 12 };
    const doc = replaceElement(BASE, "t1", next);
    expect(doc).not.toBe(BASE);
    expect(findById(doc, "t1")).toBe(next);
    expect(doc.elements[1]).toBe(BASE.elements[1]);
    expect(doc.elements[2]).toBe(BASE.elements[2]);
    expectValidIr(doc);
  });

  it("can replace a descendant inside nested flex", () => {
    const next = { ...INNER_RECT, borderWidth: 0.5 };
    const doc = replaceElement(BASE, "rc1", next);
    expect(findById(doc, "rc1")).toBe(next);
    expect(doc.elements[0]).toBe(BASE.elements[0]);
    expect(doc.elements[2]).toBe(BASE.elements[2]);
    expectValidIr(doc);
  });

  it("returns the same reference for an unknown id", () => {
    expect(replaceElement(BASE, "nope", { ...TEXT, id: "nope" })).toBe(BASE);
  });

  it("doesn't mutate the original document", () => {
    const snapshot = structuredClone(BASE);
    replaceElement(BASE, "t1", { ...TEXT, fontSize: 12 });
    setFlexDirection(BASE, "f1", "row");
    setFlexMainSize(BASE, "f2", 30);
    addTableColumn(BASE, "tbl1");
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

  it("applies the same update to multiple ids", () => {
    const doc = updateElements(BASE, ["t1", "c1"], bumpFontSize);
    expect(findById(doc, "t1")).toMatchObject({ fontSize: 12 });
    expect(findById(doc, "c1")).toMatchObject({ fontSize: 12 });
    expect(doc.elements[2]).toBe(BASE.elements[2]);
    expect(doc.elements[3]).toBe(BASE.elements[3]);
    expectValidIr(doc);
  });

  it("can apply including descendant ids inside nested flex", () => {
    const doc = updateElements(BASE, ["rc1"], (el) =>
      el.type === "rect" ? { ...el, borderWidth: 0.5 } : el,
    );
    expect(findById(doc, "rc1")).toMatchObject({ borderWidth: 0.5 });
    expectValidIr(doc);
  });

  it("returns the same document reference when no element changes", () => {
    const noop = (el: IrElement | IrFlexChild): IrElement | IrFlexChild =>
      "fontSize" in el && el.fontSize !== 10 ? { ...el, fontSize: 10 } : el;
    expect(updateElements(BASE, ["t1", "c1"], noop)).toBe(BASE);
  });

  it("ignores an id that doesn't exist", () => {
    expect(updateElements(BASE, ["nope"], bumpFontSize)).toBe(BASE);
  });
});

describe("setImageSrc", () => {
  it("replaces only src", () => {
    const doc = setImageSrc(BASE, "img1", "data:image/jpeg;base64,BB==");
    expect(findById(doc, "img1")).toEqual({
      ...IMAGE,
      src: "data:image/jpeg;base64,BB==",
    });
    expect(doc.elements[0]).toBe(BASE.elements[0]);
    expectValidIr(doc);
  });

  it("doesn't roll back a prior edit to another attribute (models applying on async load completion)", () => {
    const resized = replaceElement(BASE, "img1", { ...IMAGE, w: 50 });
    const doc = setImageSrc(resized, "img1", "data:image/jpeg;base64,BB==");
    expect(findById(doc, "img1")).toMatchObject({
      w: 50,
      src: "data:image/jpeg;base64,BB==",
    });
  });

  it("returns the same reference for an equal value, a non-image, or an unknown id", () => {
    expect(setImageSrc(BASE, "img1", IMAGE.src)).toBe(BASE);
    expect(setImageSrc(BASE, "t1", "data:image/png;base64,BB==")).toBe(BASE);
    expect(setImageSrc(BASE, "nope", "data:image/png;base64,BB==")).toBe(BASE);
  });
});

describe("setFlexDirection", () => {
  it("removes the explicit main-axis size on switch and keeps children", () => {
    const doc = setFlexDirection(BASE, "f1", "row");
    const el = findById(doc, "f1");
    expect(el).toMatchObject({ direction: "row" });
    expect(el !== undefined && "w" in el && el.w !== undefined).toBe(false);
    expect(el !== undefined && "h" in el && el.h !== undefined).toBe(false);
    expect(el?.type === "flex" ? el.children : undefined).toBe(FLEX.children);
    expectValidIr(doc);
  });

  it("returns the same reference for the same direction", () => {
    expect(setFlexDirection(BASE, "f1", "column")).toBe(BASE);
  });
});

describe("setFlexMainSize", () => {
  it("row's main axis is set on w with roundMm already applied", () => {
    const doc = setFlexMainSize(BASE, "f2", 30.14);
    expect(findById(doc, "f2")).toMatchObject({ w: 30.1 });
    expectValidIr(doc);
  });

  it("column's main axis is set on h", () => {
    const doc = setFlexMainSize(BASE, "f1", 40);
    expect(findById(doc, "f1")).toMatchObject({ h: 40 });
    expectValidIr(doc);
  });

  it("undefined removes the attribute, and returns the same reference when it was already absent", () => {
    const doc = setFlexMainSize(BASE, "f1", undefined);
    const el = findById(doc, "f1");
    expect(el !== undefined && "h" in el && el.h !== undefined).toBe(false);
    expectValidIr(doc);
    expect(setFlexMainSize(doc, "f1", undefined)).toBe(doc);
  });
});

describe("Column operations", () => {
  function columnsOf(document: IrDocument): IrTableElement["columns"] {
    const el = findById(document, "tbl1");
    if (el?.type !== "table") {
      throw new Error("table がない");
    }
    return el.columns;
  }

  it("addTableColumn appends using the table's smallest free number", () => {
    const doc = addTableColumn(BASE, "tbl1");
    expect(columnsOf(doc).at(-1)).toEqual({
      key: "col2",
      label: "column2",
      width: 40,
      align: "left",
    });
    expectValidIr(doc);
  });

  it("removeTableColumn deletes the given column and does nothing on the last remaining column", () => {
    const doc = removeTableColumn(BASE, "tbl1", 0);
    expect(columnsOf(doc).map((c) => c.key)).toEqual(["col3"]);
    expect(removeTableColumn(doc, "tbl1", 0)).toBe(doc);
    expect(removeTableColumn(BASE, "tbl1", 9)).toBe(BASE);
    expectValidIr(doc);
  });

  it("removeTableColumn also discards overrides pointing at the removed column", () => {
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

  it("moveTableColumn swaps with the neighbor and does nothing at the ends", () => {
    const doc = moveTableColumn(BASE, "tbl1", 0, 1);
    expect(columnsOf(doc).map((c) => c.key)).toEqual(["col3", "col1"]);
    expect(moveTableColumn(BASE, "tbl1", 0, -1)).toBe(BASE);
    expect(moveTableColumn(BASE, "tbl1", 1, 1)).toBe(BASE);
    expectValidIr(doc);
  });

  it("updateTableColumn applies the patch, returning the same reference if unchanged", () => {
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

  it("updateTableColumn re-keys overrides when the key changes", () => {
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

  it("updateTableColumn sets mergeSameValue, and false removes the attribute entirely", () => {
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

describe("Cell-span operations", () => {
  function spansOf(document: IrDocument): IrTableElement["cellSpans"] {
    const el = findById(document, "tbl1");
    if (el?.type !== "table") {
      throw new Error("table がない");
    }
    return el.cellSpans;
  }

  it("addTableCellSpan appends a first-column, row-0, 2-row vertical span", () => {
    const doc = addTableCellSpan(BASE, "tbl1");
    expect(spansOf(doc)).toEqual([{ row: 0, key: "col1", rowSpan: 2 }]);
    expectValidIr(doc);
  });

  it("updateTableCellSpan applies the patch, and a rowSpan/colSpan of 1 gets no attribute", () => {
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

  it("updateTableCellSpan removes rowSpan when switching to the header row", () => {
    const base = addTableCellSpan(BASE, "tbl1");
    const doc = updateTableCellSpan(base, "tbl1", 0, {
      row: "header",
      colSpan: 2,
    });
    expect(spansOf(doc)).toEqual([{ row: "header", key: "col1", colSpan: 2 }]);
    expectValidIr(doc);
  });

  it("updateTableCellSpan returns the same reference for no change or a missing index", () => {
    const base = addTableCellSpan(BASE, "tbl1");
    expect(updateTableCellSpan(base, "tbl1", 0, { rowSpan: 2 })).toBe(base);
    expect(updateTableCellSpan(base, "tbl1", 9, { rowSpan: 3 })).toBe(base);
  });

  it("removeTableCellSpan deletes the given index and removes the attribute entirely once empty", () => {
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

  it("appendTableCellSpan adds to a table with cellSpans undefined", () => {
    const span = { row: "header" as const, key: "col1", colSpan: 2 };
    const doc = appendTableCellSpan(BASE, "tbl1", span);
    expect(spansOf(doc)).toEqual([span]);
    expectValidIr(doc);
  });

  it("appendTableCellSpan appends to existing cellSpans", () => {
    const base = addTableCellSpan(BASE, "tbl1");
    const span = { row: "header" as const, key: "col3", colSpan: 2 };
    const doc = appendTableCellSpan(base, "tbl1", span);
    expect(spansOf(doc)).toEqual([{ row: 0, key: "col1", rowSpan: 2 }, span]);
    expectValidIr(doc);
  });

  it("removeTableCellSpansAt deletes multiple indexes at once", () => {
    const one = addTableCellSpan(BASE, "tbl1");
    const two = addTableCellSpan(one, "tbl1");
    const three = addTableCellSpan(two, "tbl1");
    const doc = removeTableCellSpansAt(three, "tbl1", [0, 2]);
    expect(spansOf(doc)).toEqual([{ row: 0, key: "col1", rowSpan: 2 }]);
    expectValidIr(doc);
  });

  it("removeTableCellSpansAt removes the cellSpans attribute entirely once empty", () => {
    const one = addTableCellSpan(BASE, "tbl1");
    const two = addTableCellSpan(one, "tbl1");
    const doc = removeTableCellSpansAt(two, "tbl1", [0, 1]);
    const table = findById(doc, "tbl1");
    expect(
      table !== undefined && "cellSpans" in table ? table.cellSpans : undefined,
    ).toBe(undefined);
    expectValidIr(doc);
  });

  it("removeTableCellSpansAt returns the same reference when nothing matches", () => {
    const one = addTableCellSpan(BASE, "tbl1");
    expect(removeTableCellSpansAt(one, "tbl1", [9])).toBe(one);
    expect(removeTableCellSpansAt(BASE, "tbl1", [0])).toBe(BASE);
  });

  it("removeTableColumn also discards spans anchored on the removed column", () => {
    const withSpan = addTableCellSpan(BASE, "tbl1");
    const doc = removeTableColumn(withSpan, "tbl1", 0);
    const table = findById(doc, "tbl1");
    expect(
      table !== undefined && "cellSpans" in table ? table.cellSpans : undefined,
    ).toBe(undefined);
    expectValidIr(doc);
  });

  it("a span's key follows updateTableColumn's key change", () => {
    const withSpan = addTableCellSpan(BASE, "tbl1");
    const doc = updateTableColumn(withSpan, "tbl1", 0, { key: "renamed" });
    expect(spansOf(doc)).toEqual([{ row: 0, key: "renamed", rowSpan: 2 }]);
    expectValidIr(doc);
  });

  it("moveTableColumn moves spans along with the column, staying anchored by key", () => {
    const withSpan = addTableCellSpan(BASE, "tbl1");
    const doc = moveTableColumn(withSpan, "tbl1", 0, 1);
    expect(spansOf(doc)).toEqual([{ row: 0, key: "col1", rowSpan: 2 }]);
    expectValidIr(doc);
  });

  it("removeTableColumn truncates colSpan when a covered column is removed", () => {
    const three = addTableColumn(BASE, "tbl1");
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

  it("removeTableColumn discards a span that becomes 1x1", () => {
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

  it("removeTableColumn's truncation preserves a vertical span", () => {
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

  it("moveTableColumn truncates a span that overflows the column range, discarding it if it becomes 1x1", () => {
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

  it("moveTableColumn's truncation preserves a vertical span", () => {
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

  it("moveTableColumn truncates a span overlapping a mergeSameValue column", () => {
    const three = addTableColumn(BASE, "tbl1");
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

  it("moveTableColumn discards a span that overlaps a preceding span", () => {
    const three = addTableColumn(BASE, "tbl1");
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
  it("a new (row, key) is appended", () => {
    const doc = setTableCellOverride(BASE, "tbl1", 0, "col1", "固定値");
    const table = findById(doc, "tbl1");
    expect(table?.type === "table" ? table.cellOverrides : undefined).toEqual([
      { row: 0, key: "col1", value: "固定値" },
    ]);
    expectValidIr(doc);
  });

  it("an existing (row, key) is replaced", () => {
    const once = setTableCellOverride(BASE, "tbl1", 0, "col1", "旧値");
    const doc = setTableCellOverride(once, "tbl1", 0, "col1", "新値");
    const table = findById(doc, "tbl1");
    expect(table?.type === "table" ? table.cellOverrides : undefined).toEqual([
      { row: 0, key: "col1", value: "新値" },
    ]);
  });

  it("an empty string deletes the override and removes the cellOverrides attribute entirely once empty", () => {
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

  it("returns the same reference when there's nothing to delete, and when re-setting to the same value", () => {
    expect(setTableCellOverride(BASE, "tbl1", 0, "col1", "")).toBe(BASE);
    const once = setTableCellOverride(BASE, "tbl1", 0, "col1", "固定値");
    expect(setTableCellOverride(once, "tbl1", 0, "col1", "固定値")).toBe(once);
  });
});

describe("Document settings", () => {
  it("setPage replaces page, returning the same reference for an equal value", () => {
    const doc = setPage(BASE, { width: 297, height: 420 });
    expect(doc.page).toEqual({ width: 297, height: 420 });
    expect(doc.elements).toBe(BASE.elements);
    expect(setPage(BASE, { width: 210, height: 297 })).toBe(BASE);
    expectValidIr(doc);
  });

  it("setFontRegular replaces regular, returning the same reference for an equal value", () => {
    const doc = setFontRegular(BASE, "IPAexGothic");
    expect(doc.font.regular).toBe("IPAexGothic");
    expect(setFontRegular(BASE, "NotoSansJP")).toBe(BASE);
    expectValidIr(doc);
  });

  it("setFontSlot sets the slot and preserves other slots", () => {
    const doc = setFontSlot(BASE, "bold", "NotoSansJPBold");
    expect(doc.font).toEqual({
      regular: "NotoSansJP",
      bold: "NotoSansJPBold",
    });
    expect(setFontSlot(doc, "bold", "NotoSansJPBold")).toBe(doc);
    expectValidIr(doc);
  });

  it("setFontSlot(undefined) removes the slot attribute, returning the same reference when already unset", () => {
    const withBold = setFontSlot(BASE, "bold", "NotoSansJPBold");
    const cleared = setFontSlot(withBold, "bold", undefined);
    expect(cleared.font).toEqual({ regular: "NotoSansJP" });
    expect(cleared.font).not.toHaveProperty("bold");
    expect(setFontSlot(BASE, "italic", undefined)).toBe(BASE);
    expectValidIr(cleared);
  });

  it("setDocType(true) sets docType, returning the same reference when already set", () => {
    const doc = setDocType(BASE, true);
    expect(doc.docType).toBe("qualifiedInvoice");
    expect(setDocType(doc, true)).toBe(doc);
    expectValidIr(doc);
  });

  it("setDocType(false) removes the docType key entirely, returning the same reference when unset", () => {
    const withType = setDocType(BASE, true);
    const doc = setDocType(withType, false);
    expect("docType" in doc).toBe(false);
    expect(setDocType(BASE, false)).toBe(BASE);
    expectValidIr(doc);
  });
});
