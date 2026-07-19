import type { FontIssue } from "@denreport/targets";
import {
  detectFontFormat,
  readAscentPerEm,
  validateFont,
} from "@denreport/targets";
import type { RegisteredFont } from "../../state/fonts";
import { sanitizeFontName } from "../../state/fonts";

export {
  EMBEDDED_BOLD_FONT_NAME,
  EMBEDDED_FONT_NAME,
} from "@denreport/targets";
export type { FontIssue };

export type BuildRegisteredFontResult =
  | { readonly ok: true; readonly font: RegisteredFont }
  | { readonly ok: false; readonly issues: readonly FontIssue[] };

/** バイト列を validateFont に通し（TTF 以外は既存文言の FontIssue で拒否）、
    readAscentPerEm の計量を読み、sanitizeFontName(fullName) を名前にして RegisteredFont を組む。
    計量読取不能は書き出し器と同趣旨の FontIssue にする */
export function buildRegisteredFont(
  data: Uint8Array,
  candidate: { readonly fullName: string },
): BuildRegisteredFontResult {
  const issues = validateFont(data);
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  const ascentPerEm = readAscentPerEm(data);
  if (ascentPerEm === null) {
    return {
      ok: false,
      issues: [
        {
          format: detectFontFormat(data),
          message:
            "フォントの計量（head / hhea テーブル）を読み取れないため、テキストのベースライン位置を確定できません。別の TTF フォントを使用してください。",
        },
      ],
    };
  }
  return {
    ok: true,
    font: {
      name: sanitizeFontName(candidate.fullName),
      displayName: candidate.fullName,
      data,
      ascentPerEm,
    },
  };
}
