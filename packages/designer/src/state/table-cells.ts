import type {
  IrDocument,
  IrTableCellSpan,
  IrTableElement,
  TableChunkMerges,
} from "@denreport/core";
import { computeChunkMerges } from "@denreport/core";
import { parseSampleJson } from "./sample-data";

/** The raw material for one table's cell values. rows are leniently-read rows derived from
    bind (only string values are taken, others ignored); overrides is a row -> (key -> value) index */
export interface TableCellSource {
  readonly rows: readonly Readonly<Record<string, string>>[];
  readonly overrides: ReadonlyMap<number, ReadonlyMap<string, string>>;
}

// core's readTableRows returns undefined for the whole table when there's a violation, so it
// isn't used here. The canvas sticks to a lenient read that still shows other cells even if
// some bind rows have the wrong type
function readRows(
  table: IrTableElement,
  data: Record<string, unknown>,
): readonly Readonly<Record<string, string>>[] {
  const raw = data[table.bind];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((rawRow) => {
    if (
      typeof rawRow !== "object" ||
      rawRow === null ||
      Array.isArray(rawRow)
    ) {
      return {};
    }
    const row: Record<string, string> = {};
    for (const column of table.columns) {
      const value = (rawRow as Record<string, unknown>)[column.key];
      if (typeof value === "string") {
        row[column.key] = value;
      }
    }
    return row;
  });
}

function overridesOf(
  table: IrTableElement,
): ReadonlyMap<number, ReadonlyMap<string, string>> {
  const byRow = new Map<number, Map<string, string>>();
  for (const override of table.cellOverrides ?? []) {
    const row = byRow.get(override.row) ?? new Map<string, string>();
    row.set(override.key, override.value);
    byRow.set(override.row, row);
  }
  return byRow;
}

/** Builds a TableCellSource from the sample JSON for every table in the document.
    Invalid JSON, missing bind, or wrong type is treated as an empty row (the canvas displays
    leniently; strict validation is the export side's job) */
export function tableCellSources(
  document: IrDocument,
  sampleJson: string,
): ReadonlyMap<string, TableCellSource> {
  const { data } = parseSampleJson(sampleJson);
  const sources = new Map<string, TableCellSource>();
  for (const element of document.elements) {
    if (element.type !== "table") {
      continue;
    }
    sources.set(element.id, {
      rows: readRows(element, data),
      overrides: overridesOf(element),
    });
  }
  return sources;
}

/** Merge geometry for canvas display (equivalent to the first chunk). Data-driven merges are
    judged using the display value after overrides are applied (the same resolution as cellView) */
export function sketchMerges(
  table: IrTableElement,
  source: TableCellSource,
  rowCount: number,
): TableChunkMerges {
  const rows: Record<string, string>[] = [];
  for (let t = 0; t < rowCount; t++) {
    const row: Record<string, string> = { ...(source.rows[t] ?? {}) };
    const overrides = source.overrides.get(t);
    if (overrides !== undefined) {
      for (const [key, value] of overrides) row[key] = value;
    }
    rows.push(row);
  }
  return computeChunkMerges(table, rows, 0, rowCount);
}

/** A cell's display value. overridden indicates whether a fixed value is in effect (used to decide the override marker) */
export function cellView(
  source: TableCellSource,
  row: number,
  key: string,
): { readonly text: string; readonly overridden: boolean } {
  const overrideValue = source.overrides.get(row)?.get(key);
  if (overrideValue !== undefined) {
    return { text: overrideValue, overridden: true };
  }
  return { text: source.rows[row]?.[key] ?? "", overridden: false };
}

/** A canvas cell rectangle selection (both ends inclusive). When header=true, rowStart/rowEnd are fixed at 0 and ignored */
export interface TableCellRect {
  readonly header: boolean;
  readonly rowStart: number;
  readonly rowEnd: number;
  readonly colStart: number;
  readonly colEnd: number;
}

export interface SpanExtent {
  readonly row: number | "header";
  readonly rowSpan: number;
  readonly col: number;
  readonly colSpan: number;
}

export function spanExtentsOverlap(a: SpanExtent, b: SpanExtent): boolean {
  const rowsOverlap =
    a.row === "header" || b.row === "header"
      ? a.row === b.row
      : a.row < b.row + b.rowSpan && b.row < a.row + a.rowSpan;
  return rowsOverlap && a.col < b.col + b.colSpan && b.col < a.col + a.colSpan;
}

function spanExtentOf(
  table: IrTableElement,
  span: IrTableCellSpan,
): SpanExtent | null {
  const col = table.columns.findIndex((column) => column.key === span.key);
  if (col === -1) {
    return null;
  }
  return {
    row: span.row,
    rowSpan: span.rowSpan ?? 1,
    col,
    colSpan: span.colSpan ?? 1,
  };
}

function rectExtent(rect: TableCellRect): SpanExtent {
  return {
    row: rect.header ? "header" : rect.rowStart,
    rowSpan: rect.header ? 1 : rect.rowEnd - rect.rowStart + 1,
    col: rect.colStart,
    colSpan: rect.colEnd - rect.colStart + 1,
  };
}

/** M20's preemptive check. Only enables the "Merge cells" menu item when true */
export function canMergeCellRect(
  table: IrTableElement,
  rect: TableCellRect,
): boolean {
  const cols = rect.colEnd - rect.colStart + 1;
  const rows = rect.header ? 1 : rect.rowEnd - rect.rowStart + 1;
  if (cols * rows < 2) {
    return false;
  }
  if (rect.colStart < 0 || rect.colEnd >= table.columns.length) {
    return false;
  }
  if (!rect.header && rect.rowStart < 0) {
    return false;
  }
  for (let c = rect.colStart; c <= rect.colEnd; c += 1) {
    if (table.columns[c]?.mergeSameValue === true) {
      return false;
    }
  }
  const extent = rectExtent(rect);
  for (const span of table.cellSpans ?? []) {
    const existing = spanExtentOf(table, span);
    if (existing !== null && spanExtentsOverlap(existing, extent)) {
      return false;
    }
  }
  return true;
}

/** Converts a rectangle to an IrTableCellSpan. Returns null if the origin column can't be resolved */
export function cellSpanForRect(
  table: IrTableElement,
  rect: TableCellRect,
): IrTableCellSpan | null {
  const key = table.columns[rect.colStart]?.key;
  if (key === undefined) {
    return null;
  }
  const cols = rect.colEnd - rect.colStart + 1;
  const rows = rect.header ? 1 : rect.rowEnd - rect.rowStart + 1;
  return {
    row: rect.header ? "header" : rect.rowStart,
    key,
    ...(!rect.header && rows > 1 ? { rowSpan: rows } : {}),
    ...(cols > 1 ? { colSpan: cols } : {}),
  };
}

/** The list of indices of existing merges that intersect the rectangle (candidates for unmerging) */
export function spanIndicesIntersecting(
  table: IrTableElement,
  rect: TableCellRect,
): readonly number[] {
  const extent = rectExtent(rect);
  const indices: number[] = [];
  (table.cellSpans ?? []).forEach((span, i) => {
    const existing = spanExtentOf(table, span);
    if (existing !== null && spanExtentsOverlap(existing, extent)) {
      indices.push(i);
    }
  });
  return indices;
}
