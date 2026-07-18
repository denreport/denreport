import type { IrTableElement } from "@denreport/core";
import type { MmBox, PlacedElementView } from "../../state/geometry";
import { visibleInContext } from "../../state/geometry";
import type { PageContext } from "../../state/types";

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

/** ダブルクリックの DOM 解決結果（data-apx-id / data-apx-col / data-apx-row）から編集対象を決める */
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
    // 段階的階層選択との操作衝突を避けるため、flex 子は単独選択済みのときだけ対象にする
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
    // 継続ページの行がデータの何行目に当たるかはキャンバスでは確定できないため first のみ対象にする
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

/** 列見出しセルの紙座標 mm 箱（x = 表の x + 先行列幅の和、h = headerHeight） */
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

/** データ行セルの紙座標 mm 箱（y = 表の y + headerHeight + rowIndex × rowHeight） */
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
