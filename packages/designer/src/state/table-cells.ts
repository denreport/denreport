import type {
  IrDocument,
  IrTableCellSpan,
  IrTableElement,
  TableChunkMerges,
} from "@denreport/core";
import { computeChunkMerges } from "@denreport/core";
import { parseSampleJson } from "./sample-data";

/** 1 表分のセル値の素材。rows は bind 由来の寛容読取行（string 値のみ採用、他は無視）、
    overrides は row → (key → value) の索引 */
export interface TableCellSource {
  readonly rows: readonly Readonly<Record<string, string>>[];
  readonly overrides: ReadonlyMap<number, ReadonlyMap<string, string>>;
}

// core の readTableRows は違反があると表ごと undefined を返すため使わない。
// キャンバスは bind 行の一部の型が不正でも他セルをそのまま表示する寛容読取に留める
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

/** 文書中の全 table について、サンプル JSON から TableCellSource を作る。
    JSON 不正・bind 欠落・型不正は空行扱い（キャンバスは寛容表示。厳格検証は書き出し側） */
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

/** キャンバス表示（先頭チャンク相当）用の結合ジオメトリ。データ駆動結合は
    上書き適用後の表示値（cellView と同じ解決）で判定する */
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

/** セルの表示値。overridden は固定値が効いているか（上書き目印の判定に使う） */
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

/** キャンバスのセル矩形選択（両端 inclusive）。header=true のとき rowStart/rowEnd は 0 固定で無視 */
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

/** M20 の先回り判定。true のときのみメニュー「セルを結合」を有効にする */
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

/** 矩形を IrTableCellSpan に変換。起点列が引けなければ null */
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

/** 矩形と交差する既存結合の index 一覧（解除対象） */
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
