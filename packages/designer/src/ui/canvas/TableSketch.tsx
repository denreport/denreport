import type { IrTableElement } from "@denreport/core";
import type { CSSProperties, ReactNode } from "react";
import type { MmBox } from "../../state/geometry";
import type { TableCellSource } from "../../state/table-cells";
import { cellView } from "../../state/table-cells";

// ir-v1 の表の仕様定数（罫線・余白は属性化されない）
const CELL_PADDING_X = 1.5;
const HEADER_TEXT_OFFSET_Y = 1.8;
const CELL_TEXT_OFFSET_Y = 2.0;

export function TableSketch(props: {
  readonly element: IrTableElement;
  readonly box: MmBox;
  readonly cells?: TableCellSource | undefined;
}): ReactNode {
  const table = props.element;
  const rows = Math.max(
    0,
    Math.round((props.box.h - table.headerHeight) / table.rowHeight),
  );

  const verticalXs: number[] = [];
  let acc = 0;
  for (const col of table.columns.slice(0, -1)) {
    acc += col.width;
    verticalXs.push(acc);
  }

  const rowYs: number[] = [];
  for (let q = 0; q < rows; q += 1) {
    rowYs.push(table.headerHeight + q * table.rowHeight);
  }

  // キャンバスの表示行は常にチャンク先頭（1ページ目起点）のため、行インデックス q がそのまま通し行番号
  const stripeRows: { readonly q: number; readonly color: string }[] = [];
  if (table.stripeColor !== undefined) {
    const stripeColor = table.stripeColor;
    for (let q = 0; q < rows; q += 1) {
      if (q % 2 === 1) stripeRows.push({ q, color: stripeColor });
    }
  }

  const headers: {
    readonly x: number;
    readonly w: number;
    readonly label: string;
  }[] = [];
  let colX = 0;
  for (const col of table.columns) {
    headers.push({
      x: colX + CELL_PADDING_X,
      w: Math.max(0, col.width - 2 * CELL_PADDING_X),
      label: col.label,
    });
    colX += col.width;
  }

  const noteY = table.headerHeight + (props.box.h - table.headerHeight) / 2;

  const dataCells: {
    readonly row: number;
    readonly col: number;
    readonly x: number;
    readonly w: number;
    readonly ty: number;
    readonly align: string;
    readonly text: string;
    readonly overridden: boolean;
  }[] = [];
  const cells = props.cells;
  if (cells !== undefined) {
    for (let q = 0; q < rows; q += 1) {
      let cellX = 0;
      table.columns.forEach((col, i) => {
        const view = cellView(cells, q, col.key);
        dataCells.push({
          row: q,
          col: i,
          x: cellX + CELL_PADDING_X,
          w: Math.max(0, col.width - 2 * CELL_PADDING_X),
          ty: table.headerHeight + q * table.rowHeight + CELL_TEXT_OFFSET_Y,
          align: col.align,
          text: view.text,
          overridden: view.overridden,
        });
        cellX += col.width;
      });
    }
  }
  const showNote =
    cells === undefined || dataCells.every((cell) => cell.text === "");

  return (
    <>
      {stripeRows.map(({ q, color }) => (
        <span
          key={q}
          className="apx-tbl-stripe"
          style={
            {
              "--sy": table.headerHeight + q * table.rowHeight,
              "--sh": table.rowHeight,
              "--sc": color,
            } as CSSProperties
          }
        />
      ))}
      {rowYs.map((y) => (
        <span
          key={y}
          className="apx-tbl-hline"
          style={{ "--ly": y } as CSSProperties}
        />
      ))}
      {verticalXs.map((x) => (
        <span
          key={x}
          className="apx-tbl-vline"
          style={{ "--lx": x } as CSSProperties}
        />
      ))}
      {headers.map((header, i) => (
        <span
          key={table.columns[i]?.key ?? i}
          className="apx-tbl-th"
          data-apx-col={i}
          style={
            {
              "--cx": header.x,
              "--cw": header.w,
              "--ty": HEADER_TEXT_OFFSET_Y,
              "--fs": table.fontSize,
            } as CSSProperties
          }
        >
          {header.label}
        </span>
      ))}
      {dataCells.map((cell) => (
        <span
          key={`${cell.row}-${cell.col}`}
          className={`apx-tbl-td apx-align-${cell.align}${cell.overridden ? " is-override" : ""}`}
          data-apx-row={cell.row}
          data-apx-col={cell.col}
          title={cell.overridden ? "固定値" : undefined}
          style={
            {
              "--cx": cell.x,
              "--cw": cell.w,
              "--ty": cell.ty,
              "--fs": table.fontSize,
            } as CSSProperties
          }
        >
          {cell.text}
        </span>
      ))}
      {showNote && (
        <span
          className="apx-tbl-note"
          style={{ "--ny": noteY } as CSSProperties}
        >
          bind: {table.bind} ・ minRows {table.minRows} ・ maxY {table.maxY}
        </span>
      )}
    </>
  );
}
