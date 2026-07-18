import type { IrError } from "./errors";
import { textTemplateKeys } from "./interpolate";
import type {
  IrDocument,
  IrElement,
  IrFlexChild,
  IrTableElement,
} from "./types";

/**
 * Data bound to a document by key. Text and barcode `{key}` tokens look up
 * string values here; a table's `bind` key looks up an array of row objects.
 * Any other shape at a bound key is reported as a DataProblem rather than
 * thrown.
 */
export type IrData = Readonly<Record<string, unknown>>;

export type IrTableRow = Readonly<Record<string, string>>;

/**
 * Result of checking rule C01 (text/barcode token bindings) or C02 (table row
 * bindings) against data. `severity: "warning"` means the key was missing and
 * was filled with an empty default; `"error"` means the value present had the
 * wrong type or shape.
 */
export interface DataProblem {
  readonly rule: "C01" | "C02";
  readonly severity: "error" | "warning";
  readonly path: string;
  readonly key: string;
  readonly kind: "text" | "table";
  readonly message: string;
}

function problem(
  rule: "C01" | "C02",
  severity: "error" | "warning",
  path: string,
  key: string,
  kind: "text" | "table",
  message: string,
): DataProblem {
  return { rule, severity, path, key, kind, message };
}

interface WalkedTextKey {
  readonly path: string;
  readonly key: string;
}

// text.text・barcode.value 内のトークン（path 末尾 .text/.value、重複キーは1件に集約）を走査する
function walkTextKeys(document: IrDocument): WalkedTextKey[] {
  const out: WalkedTextKey[] = [];
  function visit(element: IrElement | IrFlexChild, path: string): void {
    if (element.type === "text") {
      for (const key of new Set(textTemplateKeys(element.text))) {
        out.push({ path: `${path}.text`, key });
      }
    }
    if (element.type === "barcode") {
      for (const key of new Set(textTemplateKeys(element.value))) {
        out.push({ path: `${path}.value`, key });
      }
    }
    if (element.type === "flex") {
      element.children.forEach((child, i) => {
        visit(child, `${path}.children[${i}]`);
      });
    }
  }
  document.elements.forEach((el, i) => {
    visit(el, `elements[${i}]`);
  });
  return out;
}

function analyzeC01(document: IrDocument, data: IrData): DataProblem[] {
  const out: DataProblem[] = [];
  for (const { path, key } of walkTextKeys(document)) {
    const value = data[key];
    if (value === undefined) {
      out.push(
        problem(
          "C01",
          "warning",
          path,
          key,
          "text",
          `データにキー "${key}" がありません`,
        ),
      );
    } else if (typeof value !== "string") {
      out.push(
        problem(
          "C01",
          "error",
          path,
          key,
          "text",
          `キー "${key}" の値が string ではありません`,
        ),
      );
    }
  }
  return out;
}

interface ParsedTableRows {
  readonly rows: readonly IrTableRow[];
  /** true は table.bind キー自体がデータに存在しない（警告・空行扱い）。false かつ
      violations 非空は値・形の不正（ハードエラー） */
  readonly missing: boolean;
  readonly violations: readonly string[];
}

// 出力に現れる行数（max(bind 行数, minRows)）を超える上書きは不活性のまま IR に残す
function applyCellOverrides(
  rows: readonly IrTableRow[],
  minRows: number,
  overrides: IrTableElement["cellOverrides"],
): readonly IrTableRow[] {
  if (overrides === undefined || overrides.length === 0) {
    return rows;
  }
  const rowCount = Math.max(rows.length, minRows);
  const next = rows.map((row) => ({ ...row }));
  for (const { row, key, value } of overrides) {
    if (row >= rowCount) continue;
    while (next.length <= row) next.push({});
    next[row] = { ...next[row], [key]: value };
  }
  return next;
}

// C02 検証（violations）と行データ取得（readTableRows）が同じ判定基準を共有するための実装
function parseTableRows(table: IrTableElement, data: IrData): ParsedTableRows {
  const raw = data[table.bind];
  if (raw === undefined) {
    return { rows: [], missing: true, violations: [] };
  }
  if (!Array.isArray(raw)) {
    return {
      rows: [],
      missing: false,
      violations: [`キー "${table.bind}" の値が配列ではありません`],
    };
  }
  const violations: string[] = [];
  const rows: IrTableRow[] = [];
  raw.forEach((rawRow, t) => {
    if (
      typeof rawRow !== "object" ||
      rawRow === null ||
      Array.isArray(rawRow)
    ) {
      violations.push(`${t}行目がオブジェクトではありません`);
      return;
    }
    const row: Record<string, string> = {};
    let rowOk = true;
    for (const column of table.columns) {
      const value = (rawRow as Record<string, unknown>)[column.key];
      if (typeof value !== "string") {
        violations.push(
          `${t}行目のキー "${column.key}" の値が string ではありません`,
        );
        rowOk = false;
      } else {
        row[column.key] = value;
      }
    }
    if (rowOk) rows.push(row);
  });
  return {
    rows: applyCellOverrides(rows, table.minRows, table.cellOverrides),
    missing: false,
    violations,
  };
}

// 型・形が不正な場合のみ undefined を返す。呼び出し側はその表をページ計算から除外する。
// table.bind キーの欠落は警告扱いのため空配列（= minRows 分の空行）を返す
export function readTableRows(
  table: IrTableElement,
  data: IrData,
): readonly IrTableRow[] | undefined {
  const parsed = parseTableRows(table, data);
  return parsed.violations.length === 0 ? parsed.rows : undefined;
}

function analyzeC02(document: IrDocument, data: IrData): DataProblem[] {
  const out: DataProblem[] = [];
  document.elements.forEach((element, i) => {
    if (element.type !== "table") return;
    const path = `elements[${i}].bind`;
    const parsed = parseTableRows(element, data);
    if (parsed.missing) {
      out.push(
        problem(
          "C02",
          "warning",
          path,
          element.bind,
          "table",
          `データにキー "${element.bind}" がありません`,
        ),
      );
      return;
    }
    for (const message of parsed.violations) {
      out.push(problem("C02", "error", path, element.bind, "table", message));
    }
  });
  return out;
}

/**
 * Checks rules C01 and C02 against `data` and returns every problem found.
 * C01 (text/barcode token) problems always precede C02 (table binding)
 * problems, matching the order in which missing-key defaults are applied.
 */
export function analyzeData(
  document: IrDocument,
  data: IrData,
): readonly DataProblem[] {
  return [...analyzeC01(document, data), ...analyzeC02(document, data)];
}

function toIrError(p: DataProblem): IrError {
  return { rule: p.rule, path: p.path, message: p.message };
}

/**
 * Maps every analyzeData problem to an IrError (`rule`, `path`, `message`),
 * discarding the `severity` and `kind` detail. For callers that only need
 * IR-style errors and don't need to distinguish warnings from errors.
 */
export function validateData(
  document: IrDocument,
  data: IrData,
): readonly IrError[] {
  return analyzeData(document, data).map(toIrError);
}

/**
 * Builds a minimal IrData that satisfies every token and table bind in
 * `document`: text/barcode token keys map to `""` and table `bind` keys map
 * to `[]`. When a key is used as both a token and a table bind, the table's
 * empty array wins (table keys are applied last).
 */
export function emptyDataFor(document: IrDocument): IrData {
  const data: Record<string, unknown> = {};
  for (const { key } of walkTextKeys(document)) {
    data[key] = "";
  }
  for (const element of document.elements) {
    if (element.type === "table") {
      data[element.bind] = [];
    }
  }
  return data;
}
