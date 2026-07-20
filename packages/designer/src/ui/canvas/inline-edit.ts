import type { IrTableElement } from "@denreport/core";
import type { MmBox, PlacedElementView } from "../../state/geometry.js";
import { visibleInContext } from "../../state/geometry.js";
import type { PageContext } from "../../state/types.js";

export type InlineEditTarget =
  | { readonly kind: "text"; readonly id: string }
  | {
      readonly kind: "tableHeader";
      readonly id: string;
      readonly columnIndex: number;
    }
  | {
      readonly kind: "tableCell";
      readonly id: string;
      readonly columnIndex: number;
      readonly rowIndex: number;
    };

/** Determines the edit target from the double-click's resolved DOM data (data-dr-id / data-dr-col / data-dr-row) */
export function resolveInlineEditTarget(args: {
  readonly layout: readonly PlacedElementView[];
  readonly selection: readonly string[];
  readonly pageContext: PageContext;
  readonly elementId: string | null;
  readonly columnIndex: number | null;
  readonly rowIndex: number | null;
}): InlineEditTarget | null {
  const { layout, selection, pageContext, elementId, columnIndex, rowIndex } =
    args;
  if (elementId === null) {
    return null;
  }
  const view = layout.find((v) => v.id === elementId);
  if (view === undefined || !visibleInContext(view.pages, pageContext)) {
    return null;
  }
  const el = view.element;
  if (el.type === "text") {
    if (view.parentFlexId === null) {
      return { kind: "text", id: elementId };
    }
    // To avoid interaction conflicts with progressive hierarchical selection, a flex child is only a target when it is already selected on its own
    return selection.length === 1 && selection[0] === elementId
      ? { kind: "text", id: elementId }
      : null;
  }
  if (
    el.type === "table" &&
    columnIndex !== null &&
    el.columns[columnIndex] !== undefined
  ) {
    if (rowIndex === null) {
      return { kind: "tableHeader", id: elementId, columnIndex };
    }
    // Which data row a continuation-page row corresponds to cannot be determined from the canvas, so only "first" is a target
    if (rowIndex >= 0 && pageContext === "first") {
      return { kind: "tableCell", id: elementId, columnIndex, rowIndex };
    }
    return null;
  }
  return null;
}

function columnOffsetX(
  table: IrTableElement,
  tableBox: MmBox,
  columnIndex: number,
): number {
  let x = tableBox.x;
  for (const col of table.columns.slice(0, columnIndex)) {
    x += col.width;
  }
  return x;
}

/** The column header cell's paper-coordinate mm box (x = table's x + sum of preceding column widths, h = headerHeight) */
export function tableHeaderCellBox(
  table: IrTableElement,
  tableBox: MmBox,
  columnIndex: number,
): MmBox {
  return {
    x: columnOffsetX(table, tableBox, columnIndex),
    y: tableBox.y,
    w: table.columns[columnIndex]?.width ?? 0,
    h: table.headerHeight,
  };
}

/** The data row cell's paper-coordinate mm box (y = table's y + headerHeight + rowIndex × rowHeight) */
export function tableCellBox(
  table: IrTableElement,
  tableBox: MmBox,
  columnIndex: number,
  rowIndex: number,
): MmBox {
  return {
    x: columnOffsetX(table, tableBox, columnIndex),
    y: tableBox.y + table.headerHeight + rowIndex * table.rowHeight,
    w: table.columns[columnIndex]?.width ?? 0,
    h: table.rowHeight,
  };
}
