import type {
  IrDocument,
  IrElement,
  IrError,
  IrFlexChild,
  LoweredDocument,
  LoweredTextElement,
} from "@denreport/core";
import {
  analyzeData,
  PT_TO_MM as CORE_PT_TO_MM,
  lowerIr,
  textTemplateKeys,
} from "@denreport/core";
import type { Locale } from "../i18n/locale";
import { getMessages } from "../i18n/messages";
import { parseSampleJson } from "./sample-data";

/** A record of data completion for preview. source = "json" (unparseable) | "data" (C01/C02 completion) */
export interface PreviewWarning {
  readonly source: "json" | "data";
  readonly message: string;
}

export type PreviewResult =
  | {
      readonly ok: true;
      readonly document: LoweredDocument;
      readonly warnings: readonly PreviewWarning[];
    }
  | { readonly ok: false; readonly errors: readonly IrError[] };

/** Precondition: document is normalized and passes validateIr (the caller gates this).
    Parses sampleJson, completes C01/C02-violating keys (text -> "{keyName}", table bind ->
    an empty array), then calls lowerIr. Doesn't touch the export path's strict validation */
export function buildPreview(
  document: IrDocument,
  sampleJson: string,
  locale: Locale,
): PreviewResult {
  const warnings: PreviewWarning[] = [];
  const parsed = parseSampleJson(sampleJson);
  if (parsed.warning !== undefined) {
    warnings.push({
      source: "json",
      message: getMessages(locale).sampleJson[parsed.warning],
    });
  }
  const data = parsed.data;

  // C01 sorts before C02, so when text and table share the same key, table wins
  for (const problem of analyzeData(document, data, { locale })) {
    warnings.push({ source: "data", message: problem.message });
    data[problem.key] = problem.kind === "table" ? [] : `{${problem.key}}`;
  }

  const result = lowerIr(document, data, { locale });
  if (!result.ok) {
    return { ok: false, errors: result.errors };
  }
  return { ok: true, document: result.document, warnings };
}

const GENERATED_TABLE_ROWS = 3;

/** Generates a default sample JSON (2-space indent) from the document's bind keys.
    {key} tokens inside text/barcode -> the key name itself as the value;
    table bind -> 3 rows (cell values are "<column key> <row number>").
    Keys are in document appearance order, deduplicated. When text and table share the same key, table takes priority */
export function generateSampleData(document: IrDocument): string {
  const sample = new Map<string, unknown>();
  function visit(element: IrElement | IrFlexChild): void {
    if (element.type === "text") {
      for (const key of textTemplateKeys(element.text)) {
        if (!sample.has(key)) sample.set(key, key);
      }
    }
    if (element.type === "barcode") {
      for (const key of textTemplateKeys(element.value)) {
        if (!sample.has(key)) sample.set(key, key);
      }
    }
    if (element.type === "table" && element.bind !== "") {
      const rows = Array.from({ length: GENERATED_TABLE_ROWS }, (_, i) =>
        Object.fromEntries(
          element.columns.map((column) => [
            column.key,
            `${column.key} ${i + 1}`,
          ]),
        ),
      );
      sample.set(element.bind, rows);
    }
    if (element.type === "flex") {
      for (const child of element.children) {
        visit(child);
      }
    }
  }
  for (const element of document.elements) {
    visit(element);
  }
  return JSON.stringify(Object.fromEntries(sample), null, 2);
}

export const PT_TO_MM = CORE_PT_TO_MM;

/** The implementation point of the normative baseline formula. The baseline y (mm, page
    coordinates) of line i (a line already run through layoutTextLines) =
    el.y + (ascentPerEm + (lineHeight - 1) / 2 + i x lineHeight) x el.fontSize x PT_TO_MM */
export function textBaselinesMm(
  el: LoweredTextElement,
  ascentPerEm: number,
  lines: readonly string[],
): readonly { readonly text: string; readonly baselineY: number }[] {
  return lines.map((text, i) => ({
    text,
    baselineY:
      el.y +
      (ascentPerEm + (el.lineHeight - 1) / 2 + i * el.lineHeight) *
        el.fontSize *
        PT_TO_MM,
  }));
}
