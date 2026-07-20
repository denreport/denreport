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

/** プレビュー用のデータ補完の記録。source = "json"（パース不能）| "data"（C01/C02 の補完） */
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

/** 前提条件: document は正規化済みで validateIr 合格（呼び出し側がゲートする）。
    sampleJson をパースし、C01/C02 違反キーを補完（text → "{キー名}"、
    table bind → 空配列）したうえで lowerIr を呼ぶ。書き出し経路の厳格検証には触れない */
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

  // C01 は C02 より先に並ぶため、text と table が同一キーを共有する場合は table が勝つ
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

/** 文書の bind キーから既定サンプル JSON（2スペースインデント）を生成する。
    text・barcode 内の {key} トークン → キー名そのものを値に、
    table bind → 3行（セル値 "<列key> <行番号>"）。
    キーは文書内の出現順・重複なし。text と table が同一キーを共有する場合は table を優先する */
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

/** 規範ベースライン式の実装点。行 i（layoutTextLines 済みの行）のベースライン y（mm・ページ座標）=
    el.y + (ascentPerEm + (lineHeight − 1) / 2 + i × lineHeight) × el.fontSize × PT_TO_MM */
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
