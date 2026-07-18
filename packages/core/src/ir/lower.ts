import {
  PAGE_COUNT_MAX,
  TABLE_CELL_PADDING_X,
  TABLE_CELL_TEXT_OFFSET_Y,
  TABLE_FRAME_WIDTH,
  TABLE_GRID_WIDTH,
  TABLE_HEADER_TEXT_OFFSET_Y,
} from "./constants";
import type { DataProblem, IrData, IrTableRow } from "./data";
import { analyzeData, readTableRows } from "./data";
import type { IrError, IrRuleId } from "./errors";
import type { IrPlacedElement } from "./flex";
import { resolveFlex } from "./flex";
import { resolveFootnotes } from "./footnotes";
import { interpolateText } from "./interpolate";
import {
  resolveEllipseStyle,
  resolveLineStyle,
  resolveRectStyle,
} from "./style";
import type {
  IrAlign,
  IrBarcodeSymbology,
  IrDocument,
  IrFont,
  IrOrientation,
  IrPage,
  IrPageNumberElement,
  IrPages,
  IrStrokeStyle,
  IrTableElement,
} from "./types";

/**
 * A text element after data interpolation and flex/table resolution:
 * `content` has every `{key}` token already replaced. `sourceId` is the
 * originating IR element's id and is not guaranteed unique — a table can
 * lower to several text elements (header labels, cell values) sharing one
 * sourceId.
 */
export interface LoweredTextElement {
  readonly type: "text";
  readonly sourceId: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly content: string;
  readonly fontSize: number;
  readonly align: IrAlign;
  readonly lineHeight: number;
}

/**
 * A line element after style resolution: `color` and `strokeStyle` are
 * concrete values (IR's optional, style-inherited fields already resolved).
 */
export interface LoweredLineElement {
  readonly type: "line";
  readonly sourceId: string;
  readonly x: number;
  readonly y: number;
  readonly orientation: IrOrientation;
  readonly length: number;
  readonly thickness: number;
  readonly color: string;
  readonly strokeStyle: IrStrokeStyle;
}

/**
 * A rect element after style resolution: `borderColor`, `fillColor`,
 * `borderStyle`, and `cornerRadius` are concrete values.
 */
export interface LoweredRectElement {
  readonly type: "rect";
  readonly sourceId: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly borderWidth: number;
  readonly borderColor: string;
  readonly fillColor: string | null;
  readonly borderStyle: IrStrokeStyle;
  readonly cornerRadius: number;
}

/**
 * An ellipse element after style resolution: `borderColor` and `fillColor`
 * are concrete values.
 */
export interface LoweredEllipseElement {
  readonly type: "ellipse";
  readonly sourceId: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly borderWidth: number;
  readonly borderColor: string;
  readonly fillColor: string | null;
}

/** An image element with its data URI `src` carried through unchanged. */
export interface LoweredImageElement {
  readonly type: "image";
  readonly sourceId: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly src: string;
}

/**
 * A barcode element after data interpolation: `content` has every `{key}`
 * token already replaced.
 */
export interface LoweredBarcodeElement {
  readonly type: "barcode";
  readonly sourceId: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly symbology: IrBarcodeSymbology;
  readonly content: string;
}

/** Union of every element type lowerIr can produce. */
export type LoweredElement =
  | LoweredTextElement
  | LoweredLineElement
  | LoweredRectElement
  | LoweredEllipseElement
  | LoweredImageElement
  | LoweredBarcodeElement;

/**
 * A document after lowerIr: `page` and `font` carried through unchanged, and
 * `pages` groups the renderable elements into one array per output page
 * (table pagination and flex layout already resolved).
 */
export interface LoweredDocument {
  readonly page: IrPage;
  readonly font: IrFont;
  readonly pageCount: number;
  readonly pages: readonly (readonly LoweredElement[])[];
}

/**
 * Result of lowerIr. On success, `document` holds the per-page renderable
 * elements and `warnings` holds non-fatal data problems (e.g. missing bind
 * keys filled with empty defaults). On failure, `errors` explains why
 * lowering could not proceed (invalid bound data, more than one multi-page
 * table, or too many resulting pages).
 */
export type LowerIrResult =
  | {
      readonly ok: true;
      readonly document: LoweredDocument;
      readonly warnings: readonly IrError[];
    }
  | { readonly ok: false; readonly errors: readonly IrError[] };

function err(rule: IrRuleId, path: string, message: string): IrError {
  return { rule, path, message };
}

function toIrError(p: DataProblem): IrError {
  return { rule: p.rule, path: p.path, message: p.message };
}

// 欠落キー（severity: warning）のみを補完する。C01→C02 の順に代入するため
// text と table が同一キーを共有する場合は table（空配列）が後勝ちで残る
function applyMissingKeyDefaults(
  data: IrData,
  problems: readonly DataProblem[],
): IrData {
  const patched: Record<string, unknown> = { ...data };
  for (const p of problems) {
    if (p.severity !== "warning") continue;
    patched[p.key] = p.kind === "table" ? [] : "";
  }
  return patched;
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}

function pagesFor(pages: IrPages, pageCount: number): readonly number[] {
  switch (pages) {
    case "first":
      return [1];
    case "last":
      return [pageCount];
    case "rest":
      return pageCount >= 2 ? range(2, pageCount) : [];
    case "all":
      return range(1, pageCount);
  }
}

function replacePageNumberFormat(
  format: string,
  n: number,
  pageCount: number,
): string {
  return format
    .replaceAll("{n}", String(n))
    .replaceAll("{N}", String(pageCount));
}

interface TableSpan {
  readonly table: IrTableElement;
  readonly rows: readonly IrTableRow[];
  readonly pageCount: number;
  readonly chunkSizes: readonly number[];
}

function rowCapacity(
  maxY: number,
  top: number,
  headerHeight: number,
  rowHeight: number,
): number {
  return Math.floor((maxY - top - headerHeight) / rowHeight);
}

function computeTableSpan(
  table: IrTableElement,
  rows: readonly IrTableRow[],
): TableSpan {
  const m = Math.max(rows.length, table.minRows);
  const kFirst = rowCapacity(
    table.maxY,
    table.y,
    table.headerHeight,
    table.rowHeight,
  );
  const kCont = rowCapacity(
    table.maxY,
    table.continuationY,
    table.headerHeight,
    table.rowHeight,
  );
  if (m <= kFirst) {
    return { table, rows, pageCount: 1, chunkSizes: [Math.min(m, kFirst)] };
  }
  const pageCount = 1 + Math.ceil((m - kFirst) / kCont);
  const chunkSizes: number[] = [kFirst];
  let remaining = m - kFirst;
  for (let p = 1; p < pageCount; p++) {
    const size = Math.min(remaining, kCont);
    chunkSizes.push(size);
    remaining -= size;
  }
  return { table, rows, pageCount, chunkSizes };
}

const TABLE_LINE_COLOR = "#000000";
const TABLE_LINE_STYLE: IrStrokeStyle = "solid";

function lowerTableChunk(
  table: IrTableElement,
  rows: readonly IrTableRow[],
  chunkIndex: number,
  rowOffset: number,
  chunkSize: number,
): LoweredElement[] {
  const y0 = chunkIndex === 0 ? table.y : table.continuationY;
  const width = table.columns.reduce((total, col) => total + col.width, 0);
  const height = table.headerHeight + chunkSize * table.rowHeight;
  const xOf = (i: number): number =>
    table.x +
    table.columns.slice(0, i).reduce((total, col) => total + col.width, 0);

  const out: LoweredElement[] = [];
  const stripeColor = table.stripeColor;
  if (stripeColor !== undefined) {
    for (let q = 0; q < chunkSize; q++) {
      const t = rowOffset + q;
      if (t % 2 !== 1) continue;
      out.push({
        type: "rect",
        sourceId: table.id,
        x: table.x,
        y: y0 + table.headerHeight + q * table.rowHeight,
        w: width,
        h: table.rowHeight,
        borderWidth: 0,
        borderColor: TABLE_LINE_COLOR,
        fillColor: stripeColor,
        borderStyle: TABLE_LINE_STYLE,
        cornerRadius: 0,
      });
    }
  }
  out.push({
    type: "rect",
    sourceId: table.id,
    x: table.x,
    y: y0,
    w: width,
    h: height,
    borderWidth: TABLE_FRAME_WIDTH,
    borderColor: TABLE_LINE_COLOR,
    fillColor: null,
    borderStyle: TABLE_LINE_STYLE,
    cornerRadius: 0,
  });
  for (let q = 0; q < chunkSize; q++) {
    out.push({
      type: "line",
      sourceId: table.id,
      orientation: "horizontal",
      x: table.x,
      y: y0 + table.headerHeight + q * table.rowHeight,
      length: width,
      thickness: TABLE_GRID_WIDTH,
      color: TABLE_LINE_COLOR,
      strokeStyle: TABLE_LINE_STYLE,
    });
  }
  for (let i = 1; i < table.columns.length; i++) {
    out.push({
      type: "line",
      sourceId: table.id,
      orientation: "vertical",
      x: xOf(i),
      y: y0,
      length: height,
      thickness: TABLE_GRID_WIDTH,
      color: TABLE_LINE_COLOR,
      strokeStyle: TABLE_LINE_STYLE,
    });
  }
  table.columns.forEach((column, i) => {
    out.push({
      type: "text",
      sourceId: table.id,
      x: xOf(i) + TABLE_CELL_PADDING_X,
      y: y0 + TABLE_HEADER_TEXT_OFFSET_Y,
      w: column.width - 2 * TABLE_CELL_PADDING_X,
      h: table.headerHeight - TABLE_HEADER_TEXT_OFFSET_Y,
      content: column.label,
      fontSize: table.fontSize,
      align: "center",
      lineHeight: 1.25,
    });
  });
  for (let q = 0; q < chunkSize; q++) {
    const t = rowOffset + q;
    const row = rows[t];
    if (row === undefined) continue;
    table.columns.forEach((column, i) => {
      out.push({
        type: "text",
        sourceId: table.id,
        x: xOf(i) + TABLE_CELL_PADDING_X,
        y:
          y0 +
          table.headerHeight +
          q * table.rowHeight +
          TABLE_CELL_TEXT_OFFSET_Y,
        w: column.width - 2 * TABLE_CELL_PADDING_X,
        h: table.rowHeight - TABLE_CELL_TEXT_OFFSET_Y,
        content: row[column.key] ?? "",
        fontSize: table.fontSize,
        align: column.align,
        lineHeight: 1.25,
      });
    });
  }
  return out;
}

/**
 * Resolves footnotes, interpolates `data` into text/barcode tokens, expands
 * tables across pages, and flattens flex containers into their placed
 * children — producing the final per-page element lists a target renderer
 * consumes. Fails with C01/C02 data errors, C03 (more than one table
 * expanding to multiple pages), or C04 (total pages over PAGE_COUNT_MAX).
 * Assumes `document` is the output of parseIr and already passed validateIr;
 * the S/M rule groups are not re-checked.
 */
export function lowerIr(document: IrDocument, data: IrData): LowerIrResult {
  const resolved = resolveFootnotes(document);
  const problems = analyzeData(resolved, data);
  const dataErrors = problems
    .filter((p) => p.severity === "error")
    .map(toIrError);
  const dataWarnings = problems
    .filter((p) => p.severity === "warning")
    .map(toIrError);
  const workingData = applyMissingKeyDefaults(data, problems);

  const tableEntries = resolved.elements.flatMap((element, index) => {
    if (element.type !== "table") return [];
    const rows = readTableRows(element, workingData);
    return rows === undefined
      ? []
      : [{ index, span: computeTableSpan(element, rows) }];
  });

  const multiPageEntries = tableEntries.filter(
    (entry) => entry.span.pageCount >= 2,
  );
  const c03Errors = multiPageEntries
    .slice(1)
    .map((entry) =>
      err(
        "C03",
        `elements[${entry.index}]`,
        "2ページ以上に展開される表が複数あります",
      ),
    );

  const pageCount = Math.max(
    1,
    ...tableEntries.map((entry) => entry.span.pageCount),
  );
  const c04Errors =
    pageCount > PAGE_COUNT_MAX
      ? [
          err(
            "C04",
            "",
            `展開後の総ページ数 ${pageCount} が上限 ${PAGE_COUNT_MAX} を超えています`,
          ),
        ]
      : [];

  const errors = [...dataErrors, ...c03Errors, ...c04Errors];
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const spanById = new Map(
    tableEntries.map((entry) => [entry.span.table.id, entry.span]),
  );
  const pages: LoweredElement[][] = Array.from({ length: pageCount }, () => []);

  for (const element of resolveFlex(resolved)) {
    switch (element.type) {
      case "table": {
        const span = spanById.get(element.id);
        if (!span) continue;
        let rowOffset = 0;
        span.chunkSizes.forEach((chunkSize, chunkIndex) => {
          pages[chunkIndex]?.push(
            ...lowerTableChunk(
              element,
              span.rows,
              chunkIndex,
              rowOffset,
              chunkSize,
            ),
          );
          rowOffset += chunkSize;
        });
        break;
      }
      case "pageNumber":
        for (const p of pagesFor(element.pages, pageCount)) {
          pages[p - 1]?.push({
            type: "text",
            sourceId: element.id,
            x: element.x,
            y: element.y,
            w: element.w,
            h: element.h,
            content: replacePageNumberFormat(element.format, p, pageCount),
            fontSize: element.fontSize,
            align: element.align,
            lineHeight: element.lineHeight,
          });
        }
        break;
      case "text":
      case "line":
      case "rect":
      case "ellipse":
      case "image":
      case "barcode": {
        const lowered = lowerPlacedElement(element, workingData);
        for (const p of pagesFor(element.pages, pageCount)) {
          pages[p - 1]?.push(lowered);
        }
        break;
      }
    }
  }

  return {
    ok: true,
    document: { page: resolved.page, font: resolved.font, pageCount, pages },
    warnings: dataWarnings,
  };
}

type SimplePlacedElement = Exclude<
  IrPlacedElement,
  IrTableElement | IrPageNumberElement
>;

function lowerPlacedElement(
  element: SimplePlacedElement,
  data: IrData,
): LoweredElement {
  switch (element.type) {
    case "text":
      return {
        type: "text",
        sourceId: element.id,
        x: element.x,
        y: element.y,
        w: element.w,
        h: element.h,
        content: interpolateText(element.text, data),
        fontSize: element.fontSize,
        align: element.align,
        lineHeight: element.lineHeight,
      };
    case "line": {
      const style = resolveLineStyle(element);
      return {
        type: "line",
        sourceId: element.id,
        x: element.x,
        y: element.y,
        orientation: element.orientation,
        length: element.length,
        thickness: element.thickness,
        color: style.color,
        strokeStyle: style.strokeStyle,
      };
    }
    case "rect": {
      const style = resolveRectStyle(element);
      return {
        type: "rect",
        sourceId: element.id,
        x: element.x,
        y: element.y,
        w: element.w,
        h: element.h,
        borderWidth: element.borderWidth,
        borderColor: style.borderColor,
        fillColor: style.fillColor,
        borderStyle: style.borderStyle,
        cornerRadius: style.cornerRadius,
      };
    }
    case "ellipse": {
      const style = resolveEllipseStyle(element);
      return {
        type: "ellipse",
        sourceId: element.id,
        x: element.x,
        y: element.y,
        w: element.w,
        h: element.h,
        borderWidth: element.borderWidth,
        borderColor: style.borderColor,
        fillColor: style.fillColor,
      };
    }
    case "image":
      return {
        type: "image",
        sourceId: element.id,
        x: element.x,
        y: element.y,
        w: element.w,
        h: element.h,
        src: element.src,
      };
    case "barcode":
      return {
        type: "barcode",
        sourceId: element.id,
        x: element.x,
        y: element.y,
        w: element.w,
        h: element.h,
        symbology: element.symbology,
        content: interpolateText(element.value, data),
      };
  }
}
