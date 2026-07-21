import type { IrTableElement } from "@denreport/core";
import { describe, expect, it } from "vitest";
import type { MmBox } from "../../state/geometry";
import {
  cellAtPoint,
  cellRectBox,
  cellRectFrom,
  visibleRowCount,
} from "./cell-selection";

function table(overrides: Partial<IrTableElement> = {}): IrTableElement {
  return {
    type: "table",
    id: "tbl1",
    x: 10,
    y: 10,
    bind: "items",
    columns: [
      { key: "a", label: "A", width: 30, align: "left" },
      { key: "b", label: "B", width: 40, align: "left" },
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

const BOX: MmBox = { x: 10, y: 20, w: 70, h: 32 }; // headerHeight 8 + 3 rows * rowHeight 8

describe("visibleRowCount", () => {
  it("computes the visible row count using the same formula as TableSketch", () => {
    expect(visibleRowCount(table(), BOX)).toBe(3);
  });
});

describe("cellAtPoint", () => {
  it('returns row: "header" for y within the header band', () => {
    expect(cellAtPoint(table(), BOX, { x: 15, y: 20 })).toEqual({
      row: "header",
      col: 0,
    });
    expect(cellAtPoint(table(), BOX, { x: 45, y: 27 })).toEqual({
      row: "header",
      col: 1,
    });
  });

  it("detail rows compute the row number with floor", () => {
    expect(cellAtPoint(table(), BOX, { x: 15, y: 31 })).toEqual({
      row: 0,
      col: 0,
    });
    expect(cellAtPoint(table(), BOX, { x: 15, y: 37 })).toEqual({
      row: 1,
      col: 0,
    });
  });

  it("exactly on a column boundary (right edge) falls into the right column", () => {
    expect(cellAtPoint(table(), BOX, { x: 40, y: 20 })).toEqual({
      row: "header",
      col: 1,
    });
  });

  it("the right/bottom edge of the box clamps to the last column/row", () => {
    expect(cellAtPoint(table(), BOX, { x: 80, y: 20 })).toEqual({
      row: "header",
      col: 1,
    });
    expect(cellAtPoint(table(), BOX, { x: 15, y: 52 })).toEqual({
      row: 2,
      col: 0,
    });
  });

  it("returns null when outside the box", () => {
    expect(cellAtPoint(table(), BOX, { x: 9, y: 20 })).toBeNull();
    expect(cellAtPoint(table(), BOX, { x: 15, y: 53 })).toBeNull();
  });

  it("returns null for a detail click when visibleRowCount is 0", () => {
    const shortBox: MmBox = { x: 10, y: 20, w: 70, h: 11 };
    expect(cellAtPoint(table(), shortBox, { x: 15, y: 29 })).toBeNull();
  });
});

describe("cellRectFrom", () => {
  it("normalizes a reverse drag with minmax", () => {
    expect(cellRectFrom({ row: 2, col: 1 }, { row: 0, col: 0 })).toEqual({
      header: false,
      rowStart: 0,
      rowEnd: 2,
      colStart: 0,
      colEnd: 1,
    });
  });

  it("fixes selection to a horizontal header-band selection when the anchor is in the header band", () => {
    expect(cellRectFrom({ row: "header", col: 0 }, { row: 2, col: 1 })).toEqual(
      {
        header: true,
        rowStart: 0,
        rowEnd: 0,
        colStart: 0,
        colEnd: 1,
      },
    );
  });

  it("treats it as row 0 when the anchor is a detail row and focus enters the header band", () => {
    expect(cellRectFrom({ row: 3, col: 0 }, { row: "header", col: 2 })).toEqual(
      {
        header: false,
        rowStart: 0,
        rowEnd: 3,
        colStart: 0,
        colEnd: 2,
      },
    );
  });
});

describe("cellRectBox", () => {
  it("the header band rectangle uses headerHeight as its height", () => {
    expect(
      cellRectBox(table(), BOX, {
        header: true,
        rowStart: 0,
        rowEnd: 0,
        colStart: 1,
        colEnd: 1,
      }),
    ).toEqual({ x: 40, y: 20, w: 40, h: 8 });
  });

  it("the detail rectangle box is derived from the cumulative sum of column widths and rowHeight", () => {
    expect(
      cellRectBox(table(), BOX, {
        header: false,
        rowStart: 1,
        rowEnd: 2,
        colStart: 0,
        colEnd: 1,
      }),
    ).toEqual({ x: 10, y: 36, w: 70, h: 16 });
  });
});
