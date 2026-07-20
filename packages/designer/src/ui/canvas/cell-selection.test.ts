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
  it("TableSketch と同じ規範式で可視行数を算出する", () => {
    expect(visibleRowCount(table(), BOX)).toBe(3);
  });
});

describe("cellAtPoint", () => {
  it('ヘッダ帯 y の範囲は row: "header" を返す', () => {
    expect(cellAtPoint(table(), BOX, { x: 15, y: 20 })).toEqual({
      row: "header",
      col: 0,
    });
    expect(cellAtPoint(table(), BOX, { x: 45, y: 27 })).toEqual({
      row: "header",
      col: 1,
    });
  });

  it("明細行は floor で行番号を求める", () => {
    expect(cellAtPoint(table(), BOX, { x: 15, y: 31 })).toEqual({
      row: 0,
      col: 0,
    });
    expect(cellAtPoint(table(), BOX, { x: 15, y: 37 })).toEqual({
      row: 1,
      col: 0,
    });
  });

  it("列境界ちょうど（列右端）は右列に入る", () => {
    expect(cellAtPoint(table(), BOX, { x: 40, y: 20 })).toEqual({
      row: "header",
      col: 1,
    });
  });

  it("箱の右端・下端は最後の列・行に clamp する", () => {
    expect(cellAtPoint(table(), BOX, { x: 80, y: 20 })).toEqual({
      row: "header",
      col: 1,
    });
    expect(cellAtPoint(table(), BOX, { x: 15, y: 52 })).toEqual({
      row: 2,
      col: 0,
    });
  });

  it("箱の外なら null を返す", () => {
    expect(cellAtPoint(table(), BOX, { x: 9, y: 20 })).toBeNull();
    expect(cellAtPoint(table(), BOX, { x: 15, y: 53 })).toBeNull();
  });

  it("visibleRowCount が 0 のときの明細クリックは null を返す", () => {
    const shortBox: MmBox = { x: 10, y: 20, w: 70, h: 11 };
    expect(cellAtPoint(table(), shortBox, { x: 15, y: 29 })).toBeNull();
  });
});

describe("cellRectFrom", () => {
  it("逆向きドラッグを minmax で正規化する", () => {
    expect(cellRectFrom({ row: 2, col: 1 }, { row: 0, col: 0 })).toEqual({
      header: false,
      rowStart: 0,
      rowEnd: 2,
      colStart: 0,
      colEnd: 1,
    });
  });

  it("アンカーがヘッダ帯ならヘッダ帯の横選択に固定する", () => {
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

  it("アンカーが明細でフォーカスがヘッダ帯に入ったら行0扱いにする", () => {
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
  it("ヘッダ帯の矩形は headerHeight を高さにする", () => {
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

  it("明細の矩形は列幅の累積和と rowHeight から箱を求める", () => {
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
