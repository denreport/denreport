import type { CharWidthEm, IrTableElement } from "@denreport/core";
import { layoutTextLines, subtractSkips } from "@denreport/core";
import type { CSSProperties, ReactNode } from "react";
import { useMessages } from "../../i18n/context";
import type { MmBox } from "../../state/geometry";
import type { TableCellSource } from "../../state/table-cells";
import { cellView, sketchMerges } from "../../state/table-cells";

// Spec constants for ir-v1 tables (cell padding and character offsets are not exposed as attributes)
const CELL_PADDING_X = 1.5;
const HEADER_TEXT_OFFSET_Y = 1.8;
const CELL_TEXT_OFFSET_Y = 2.0;

const EMPTY_SOURCE: TableCellSource = { rows: [], overrides: new Map() };

export function TableSketch(props: {
  readonly element: IrTableElement;
  readonly box: MmBox;
  readonly cells?: TableCellSource | undefined;
  readonly charWidths?: CharWidthEm | null | undefined;
}): ReactNode {
  const table = props.element;
  const m = useMessages();
  const rows = Math.max(
    0,
    Math.round((props.box.h - table.headerHeight) / table.rowHeight),
  );

  const colXs: number[] = [0];
  for (const col of table.columns) {
    colXs.push((colXs[colXs.length - 1] ?? 0) + col.width);
  }
  const xOf = (i: number): number => colXs[i] ?? 0;

  const merges = sketchMerges(table, props.cells ?? EMPTY_SOURCE, rows);
  const rectByOrigin = new Map(
    merges.rects.map((rect) => [`${rect.q}:${rect.col}`, rect]),
  );
  const rowEdgeY = (edge: number): number =>
    edge < 0 ? 0 : table.headerHeight + edge * table.rowHeight;

  const hlines: {
    readonly key: string;
    readonly y: number;
    readonly x: number;
    readonly w: number;
  }[] = [];
  for (let q = 0; q < rows; q += 1) {
    const y = table.headerHeight + q * table.rowHeight;
    for (const segment of subtractSkips(
      0,
      table.columns.length,
      merges.horizontalSkips.get(q),
    )) {
      hlines.push({
        key: `${q}-${segment.start}`,
        y,
        x: xOf(segment.start),
        w: xOf(segment.end) - xOf(segment.start),
      });
    }
  }

  const vlines: {
    readonly key: string;
    readonly x: number;
    readonly y: number;
    readonly h: number;
  }[] = [];
  for (let i = 1; i < table.columns.length; i += 1) {
    for (const segment of subtractSkips(
      -1,
      rows,
      merges.verticalSkips.get(i),
    )) {
      vlines.push({
        key: `${i}-${segment.start}`,
        x: xOf(i),
        y: rowEdgeY(segment.start),
        h: rowEdgeY(segment.end) - rowEdgeY(segment.start),
      });
    }
  }

  // The canvas's displayed rows always start at the top of the chunk (page-1 origin), so row index q is directly the running row number
  const stripeRows: { readonly q: number; readonly color: string }[] = [];
  if (table.stripeColor !== undefined) {
    const stripeColor = table.stripeColor;
    for (let q = 0; q < rows; q += 1) {
      if (q % 2 === 1) stripeRows.push({ q, color: stripeColor });
    }
  }

  const headers: {
    readonly col: number;
    readonly x: number;
    readonly w: number;
    readonly label: string;
  }[] = [];
  table.columns.forEach((col, i) => {
    if (merges.covered.has(`header:${i}`)) return;
    const rect = rectByOrigin.get(`header:${i}`);
    const spanWidth =
      rect === undefined ? col.width : xOf(i + rect.colSpan) - xOf(i);
    headers.push({
      col: i,
      x: xOf(i) + CELL_PADDING_X,
      w: Math.max(0, spanWidth - 2 * CELL_PADDING_X),
      label: col.label,
    });
  });

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
    readonly charSpacePt: number;
  }[] = [];
  const cells = props.cells;
  const charWidths = props.charWidths;
  if (cells !== undefined) {
    for (let q = 0; q < rows; q += 1) {
      table.columns.forEach((col, i) => {
        if (merges.covered.has(`${q}:${i}`)) return;
        const rect = rectByOrigin.get(`${q}:${i}`);
        const spanWidth =
          rect === undefined ? col.width : xOf(i + rect.colSpan) - xOf(i);
        const view = cellView(cells, q, col.key);
        const cellW = Math.max(0, spanWidth - 2 * CELL_PADDING_X);
        let charSpacePt = 0;
        if (col.align === "justify" && charWidths != null && view.text !== "") {
          const lines = layoutTextLines(
            {
              content: view.text,
              widthMm: cellW,
              fontSize: table.fontSize,
              align: "justify",
            },
            charWidths,
          );
          // Detail cells are always rendered schematically as one line. At lengths that require wrapping (measured width ≥ effective width), the spec also calls for zero character spacing
          charSpacePt = lines.length === 1 ? (lines[0]?.charSpacePt ?? 0) : 0;
        }
        dataCells.push({
          row: q,
          col: i,
          x: xOf(i) + CELL_PADDING_X,
          w: cellW,
          ty: table.headerHeight + q * table.rowHeight + CELL_TEXT_OFFSET_Y,
          align: col.align,
          text: view.text,
          overridden: view.overridden,
          charSpacePt,
        });
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
          className="dr-tbl-stripe"
          style={
            {
              "--sy": table.headerHeight + q * table.rowHeight,
              "--sh": table.rowHeight,
              "--sc": color,
            } as CSSProperties
          }
        />
      ))}
      <span className="dr-tbl-frame" />
      {hlines.map((line) => (
        <span
          key={line.key}
          className="dr-tbl-hline"
          style={
            {
              "--ly": line.y,
              left: `calc(${line.x} * var(--mm))`,
              width: `calc(${line.w} * var(--mm))`,
              right: "auto",
            } as CSSProperties
          }
        />
      ))}
      {vlines.map((line) => (
        <span
          key={line.key}
          className="dr-tbl-vline"
          style={
            {
              "--lx": line.x,
              top: `calc(${line.y} * var(--mm))`,
              height: `calc(${line.h} * var(--mm))`,
              bottom: "auto",
            } as CSSProperties
          }
        />
      ))}
      {headers.map((header) => (
        <span
          key={table.columns[header.col]?.key ?? header.col}
          className="dr-tbl-th"
          data-dr-col={header.col}
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
          className={`dr-tbl-td dr-align-${cell.align}${cell.overridden ? " is-override" : ""}`}
          data-dr-row={cell.row}
          data-dr-col={cell.col}
          title={cell.overridden ? m.canvas.overriddenCellTitle : undefined}
          style={
            {
              "--cx": cell.x,
              "--cw": cell.w,
              "--ty": cell.ty,
              "--fs": table.fontSize,
              ...(cell.charSpacePt !== 0 ? { "--cs": cell.charSpacePt } : {}),
            } as CSSProperties
          }
        >
          {cell.text}
        </span>
      ))}
      {showNote && (
        <span
          className="dr-tbl-note"
          style={{ "--ny": noteY } as CSSProperties}
        >
          bind: {table.bind} ・ minRows {table.minRows} ・ maxY {table.maxY}
        </span>
      )}
    </>
  );
}
