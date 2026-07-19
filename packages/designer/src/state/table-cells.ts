import type {
  IrDocument,
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
