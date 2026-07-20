import type { CharWidthEm, IrFont, IrFontSlot } from "@denreport/core";
import { getMessages, type MessageLocale } from "../i18n/messages/index.js";
import { detectFontFormat } from "./format.js";
import { readAscentPerEm } from "./metrics.js";
import type { FontIssue } from "./validate.js";
import { validateFont } from "./validate.js";
import { readCharWidths } from "./widths.js";

/** Font data for a document's font set. Keys are IrFontSlot; `regular` is required. */
export interface FontSetData {
  readonly regular: Uint8Array;
  readonly bold?: Uint8Array;
  readonly italic?: Uint8Array;
  readonly boldItalic?: Uint8Array;
}

/** Metrics read from one slot's font data, shared by wrapping and baseline math. */
export interface ResolvedSlotFont {
  readonly ascentPerEm: number;
  readonly charWidthEm: CharWidthEm;
}

/**
 * Result of resolveFontSetData. On success, `slots` has an entry for every
 * slot present in the input. On failure, `issues` carries one FontIssue per
 * broken slot, each tagged with the slot it occurred in.
 */
export type ResolveFontSetDataResult =
  | {
      readonly ok: true;
      readonly slots: ReadonlyMap<IrFontSlot, ResolvedSlotFont>;
    }
  | { readonly ok: false; readonly issues: readonly FontIssue[] };

export const FONT_SLOTS: readonly IrFontSlot[] = [
  "regular",
  "bold",
  "italic",
  "boldItalic",
];

/**
 * Runs every slot of `fonts` through validateFont and metrics reading,
 * returning per-slot metrics or the FontIssues (form check first, then
 * head/hhea, then cmap/hmtx — at most one issue per slot) that prevent
 * export. `options.locale` (default "ja") selects the message language.
 */
export function resolveFontSetData(
  fonts: FontSetData,
  options?: { readonly locale?: MessageLocale },
): ResolveFontSetDataResult {
  const locale = options?.locale ?? "ja";
  const messages = getMessages(locale);
  const issues: FontIssue[] = [];
  const slots = new Map<IrFontSlot, ResolvedSlotFont>();
  for (const slot of FONT_SLOTS) {
    const data = fonts[slot];
    if (data === undefined) continue;
    const formatIssues = validateFont(data, { locale });
    if (formatIssues.length > 0) {
      issues.push(...formatIssues.map((issue) => ({ ...issue, slot })));
      continue;
    }
    const ascentPerEm = readAscentPerEm(data);
    if (ascentPerEm === null) {
      issues.push({
        format: detectFontFormat(data),
        message: messages.fontIssue.metricsUnreadable,
        slot,
      });
      continue;
    }
    const charWidthEm = readCharWidths(data);
    if (charWidthEm === null) {
      issues.push({
        format: detectFontFormat(data),
        message: messages.fontIssue.widthUnreadable,
        slot,
      });
      continue;
    }
    slots.set(slot, { ascentPerEm, charWidthEm });
  }
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, slots };
}

/**
 * Restricts the document's declared slots to those whose data is present in
 * `fonts`, so that resolveFontSlot only ever picks a renderable slot.
 */
export function effectiveFontOf(font: IrFont, fonts: FontSetData): IrFont {
  return {
    regular: font.regular,
    ...(font.bold !== undefined && fonts.bold !== undefined
      ? { bold: font.bold }
      : {}),
    ...(font.italic !== undefined && fonts.italic !== undefined
      ? { italic: font.italic }
      : {}),
    ...(font.boldItalic !== undefined && fonts.boldItalic !== undefined
      ? { boldItalic: font.boldItalic }
      : {}),
  };
}
