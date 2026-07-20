import type { IrFontSlot } from "@denreport/core";
import { getMessages, type MessageLocale } from "../i18n/messages/index.js";
import type { FontFormat } from "./format.js";
import { detectFontFormat } from "./format.js";

/**
 * A reason a font cannot be used for export: its detected `format` and a
 * human-readable `message` explaining the rejection and what to use instead.
 */
export interface FontIssue {
  readonly format: FontFormat;
  readonly message: string;
  /** The font-set slot the issue occurred in. Set by resolveFontSetData. */
  readonly slot?: IrFontSlot;
}

/**
 * Checks that `data` is a TrueType-outline font, the only format the export
 * targets support. Returns an empty array when valid, or a single-element
 * array describing why otherwise. `options.locale` (default "ja") selects
 * the message language.
 */
export function validateFont(
  data: Uint8Array,
  options?: { readonly locale?: MessageLocale },
): readonly FontIssue[] {
  const format = detectFontFormat(data);
  if (format === "ttf") return [];
  const messages = getMessages(options?.locale ?? "ja");
  return [{ format, message: messages.fontIssue.rejection[format] }];
}
