import type { FontFormat } from "./format";
import { detectFontFormat } from "./format";

/**
 * A reason a font cannot be used for export: its detected `format` and a
 * human-readable `message` explaining the rejection and what to use instead.
 */
export interface FontIssue {
  readonly format: FontFormat;
  readonly message: string;
}

const REJECTION_MESSAGES: Readonly<Record<Exclude<FontFormat, "ttf">, string>> =
  {
    cff: "CFF（OTF）アウトラインのフォントは書き出しに使用できません。TrueType アウトラインの TTF フォントを使用してください。",
    collection:
      "フォントコレクション（TTC/OTC）は書き出しに使用できません。単一フォントの TTF フォントを使用してください。",
    woff: "WOFF 形式のフォントは書き出しに使用できません。圧縮されていない TTF フォントを使用してください。",
    woff2:
      "WOFF2 形式のフォントは書き出しに使用できません。圧縮されていない TTF フォントを使用してください。",
    unknown:
      "フォント形式を判定できませんでした。TrueType アウトラインの TTF フォントを使用してください。",
  };

/**
 * Checks that `data` is a TrueType-outline font, the only format the export
 * targets support. Returns an empty array when valid, or a single-element
 * array describing why otherwise.
 */
export function validateFont(data: Uint8Array): readonly FontIssue[] {
  const format = detectFontFormat(data);
  if (format === "ttf") return [];
  return [{ format, message: REJECTION_MESSAGES[format] }];
}
