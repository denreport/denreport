import type { FontIssue } from "@denreport/targets";
import {
  detectFontFormat,
  readAscentPerEm,
  validateFont,
} from "@denreport/targets";
import type { Locale } from "../../i18n/locale";
import type { Messages } from "../../i18n/messages";
import type { RegisteredFont } from "../../state/fonts";
import { sanitizeFontName } from "../../state/fonts";

export {
  EMBEDDED_BOLD_FONT_NAME,
  EMBEDDED_FONT_NAME,
} from "@denreport/targets";
export type { FontIssue };

export type FontsMessages = Messages["fonts"];

export type BuildRegisteredFontResult =
  | { readonly ok: true; readonly font: RegisteredFont }
  | { readonly ok: false; readonly issues: readonly FontIssue[] };

/** Runs the byte array through validateFont (non-TTF is rejected with the existing-wording
    FontIssue), reads metrics via readAscentPerEm, and assembles a RegisteredFont using
    sanitizeFontName(fullName) as the name. Unreadable metrics become a FontIssue in the
    same spirit as the writer's */
export function buildRegisteredFont(
  data: Uint8Array,
  candidate: { readonly fullName: string },
  m: FontsMessages,
  locale: Locale,
): BuildRegisteredFontResult {
  const issues = validateFont(data, { locale });
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
          message: m.metricsUnreadable,
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
