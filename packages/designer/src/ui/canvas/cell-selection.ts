import type { IrTableElement } from "@denreport/core";
import type { MmBox } from "../../state/geometry.js";
import type { TableCellRect } from "../../state/table-cells.js";
import type { MmPoint } from "./interaction.js";

export interface CellAddress {
  readonly row: number | "header";
  readonly col: number;
}

/** Same canonical formula as TableSketch (the integer row count from the height minus headerHeight, divided by rowHeight) */
export function visibleRowCount(table: IrTableElement, box: MmBox): number {
  return Math.max(
    0,
    Math.round((box.h - table.headerHeight) / table.rowHeight),
  );
}

/** Paper coordinates mm → cell address. null if outside box (the table's bounding box) */
export function cellAtPoint(
  table: IrTableElement,
  box: MmBox,
  at: MmPoint,
): CellAddress | null {
  if (
    at.x < box.x ||
    at.x > box.x + box.w ||
    at.y < box.y ||
    at.y > box.y + box.h
  ) {
    return null;
  }
  let col = table.columns.length - 1;
  let x = box.x;
  for (let i = 0; i < table.columns.length; i += 1) {
    x += table.columns[i]?.width ?? 0;
    if (at.x < x) {
      col = i;
      break;
    }
  }
  if (at.y < box.y + table.headerHeight) {
    return { row: "header", col };
  }
  const rows = visibleRowCount(table, box);
  if (rows === 0) {
    return null;
  }
  const row = Math.min(
    rows - 1,
    Math.floor((at.y - box.y - table.headerHeight) / table.rowHeight),
  );
  return { row, col };
}

/**
 * Builds a normalized rectangle from the anchor (fixed point) and focus. If the anchor is in the
 * header band, it is fixed to a horizontal selection within the header band (the focus's row is
 * ignored). If the anchor is in the detail rows and the focus enters the header band, it is treated as row 0.
 */
export function cellRectFrom(
  anchor: CellAddress,
  focus: CellAddress,
): TableCellRect {
  const colStart = Math.min(anchor.col, focus.col);
  const colEnd = Math.max(anchor.col, focus.col);
  if (anchor.row === "header") {
    return { header: true, rowStart: 0, rowEnd: 0, colStart, colEnd };
  }
  const fRow = focus.row === "header" ? 0 : focus.row;
  return {
    header: false,
    rowStart: Math.min(anchor.row, fRow),
    rowEnd: Math.max(anchor.row, fRow),
    colStart,
    colEnd,
  };
}

/** The selection rectangle's paper-coordinate mm box (for highlight rendering) */
export function cellRectBox(
  table: IrTableElement,
  box: MmBox,
  rect: TableCellRect,
): MmBox {
  let x = box.x;
  for (let i = 0; i < rect.colStart; i += 1) {
    x += table.columns[i]?.width ?? 0;
  }
  let w = 0;
  for (let i = rect.colStart; i <= rect.colEnd; i += 1) {
    w += table.columns[i]?.width ?? 0;
  }
  if (rect.header) {
    return { x, y: box.y, w, h: table.headerHeight };
  }
  return {
    x,
    y: box.y + table.headerHeight + rect.rowStart * table.rowHeight,
    w,
    h: (rect.rowEnd - rect.rowStart + 1) * table.rowHeight,
  };
}
