import {
  getMessages,
  type MessageLocale,
  type Messages,
} from "../i18n/messages";
import type { IrError } from "./errors";
import { textTemplateKeys } from "./interpolate";
import type {
  IrDocument,
  IrElement,
  IrFlexChild,
  IrTableElement,
} from "./types";

type DataMessages = Messages["data"];

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

// Walks the tokens inside text.text and barcode.value (path suffix .text/.value, duplicate keys collapsed to one)
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

function analyzeC01(
  document: IrDocument,
  data: IrData,
  m: DataMessages,
): DataProblem[] {
  const out: DataProblem[] = [];
  for (const { path, key } of walkTextKeys(document)) {
    const value = data[key];
    if (value === undefined) {
      out.push(problem("C01", "warning", path, key, "text", m.keyMissing(key)));
    } else if (typeof value !== "string") {
      out.push(
        problem("C01", "error", path, key, "text", m.valueNotString(key)),
      );
    }
  }
  return out;
}

interface ParsedTableRows {
  readonly rows: readonly IrTableRow[];
  /** true means the table.bind key itself is absent from the data (treated as a warning / empty rows). false with
      a non-empty violations means the value/shape is invalid (hard error) */
  readonly missing: boolean;
  readonly violations: readonly string[];
}

// Overrides beyond the row count that appears in the output (max(bind row count, minRows)) stay inert in the IR
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

// Implementation shared so that C02 validation (violations) and row-data retrieval (readTableRows) use the same criteria
function parseTableRows(
  table: IrTableElement,
  data: IrData,
  m: DataMessages,
): ParsedTableRows {
  const raw = data[table.bind];
  if (raw === undefined) {
    return { rows: [], missing: true, violations: [] };
  }
  if (!Array.isArray(raw)) {
    return {
      rows: [],
      missing: false,
      violations: [m.bindNotArray(table.bind)],
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
      violations.push(m.rowNotObject(t));
      return;
    }
    const row: Record<string, string> = {};
    let rowOk = true;
    for (const column of table.columns) {
      const value = (rawRow as Record<string, unknown>)[column.key];
      if (typeof value !== "string") {
        violations.push(m.rowValueNotString(t, column.key));
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

// Returns undefined only when the type/shape is invalid; the caller excludes that table from page calculation.
// A missing table.bind key is treated as a warning, so an empty array (= minRows worth of empty rows) is returned
// The contents of violations are discarded and only the count is used, so locale doesn't matter
export function readTableRows(
  table: IrTableElement,
  data: IrData,
): readonly IrTableRow[] | undefined {
  const parsed = parseTableRows(table, data, getMessages().data);
  return parsed.violations.length === 0 ? parsed.rows : undefined;
}

function analyzeC02(
  document: IrDocument,
  data: IrData,
  m: DataMessages,
): DataProblem[] {
  const out: DataProblem[] = [];
  document.elements.forEach((element, i) => {
    if (element.type !== "table") return;
    const path = `elements[${i}].bind`;
    const parsed = parseTableRows(element, data, m);
    if (parsed.missing) {
      out.push(
        problem(
          "C02",
          "warning",
          path,
          element.bind,
          "table",
          m.keyMissing(element.bind),
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
 * `options.locale` controls the messages' language (default "ja").
 */
export function analyzeData(
  document: IrDocument,
  data: IrData,
  options?: { readonly locale?: MessageLocale },
): readonly DataProblem[] {
  const m = getMessages(options?.locale).data;
  return [...analyzeC01(document, data, m), ...analyzeC02(document, data, m)];
}

function toIrError(p: DataProblem): IrError {
  return { rule: p.rule, path: p.path, message: p.message };
}

/**
 * Maps every analyzeData problem to an IrError (`rule`, `path`, `message`),
 * discarding the `severity` and `kind` detail. For callers that only need
 * IR-style errors and don't need to distinguish warnings from errors.
 * `options.locale` controls the messages' language (default "ja").
 */
export function validateData(
  document: IrDocument,
  data: IrData,
  options?: { readonly locale?: MessageLocale },
): readonly IrError[] {
  return analyzeData(document, data, options).map(toIrError);
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
