import type { CharWidthEm, IrFont, IrFontSlot } from "@denreport/core";
import { detectFontFormat } from "./format";
import { readAscentPerEm } from "./metrics";
import type { FontIssue } from "./validate";
import { validateFont } from "./validate";
import { readCharWidths } from "./widths";

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

export const FONT_METRICS_ISSUE_MESSAGE =
  "フォントの計量（head / hhea テーブル）を読み取れないため、テキストのベースライン位置を確定できません。別の TTF フォントを使用してください。";
export const FONT_WIDTH_ISSUE_MESSAGE =
  "フォントの字幅（cmap / hmtx テーブル）を読み取れないため、テキストの折り返し・均等割付を計算できません。別の TTF フォントを使用してください。";

/**
 * Runs every slot of `fonts` through validateFont and metrics reading,
 * returning per-slot metrics or the FontIssues (form check first, then
 * head/hhea, then cmap/hmtx — at most one issue per slot) that prevent export.
 */
export function resolveFontSetData(
  fonts: FontSetData,
): ResolveFontSetDataResult {
  const issues: FontIssue[] = [];
  const slots = new Map<IrFontSlot, ResolvedSlotFont>();
  for (const slot of FONT_SLOTS) {
    const data = fonts[slot];
    if (data === undefined) continue;
    const formatIssues = validateFont(data);
    if (formatIssues.length > 0) {
      issues.push(...formatIssues.map((issue) => ({ ...issue, slot })));
      continue;
    }
    const ascentPerEm = readAscentPerEm(data);
    if (ascentPerEm === null) {
      issues.push({
        format: detectFontFormat(data),
        message: FONT_METRICS_ISSUE_MESSAGE,
        slot,
      });
      continue;
    }
    const charWidthEm = readCharWidths(data);
    if (charWidthEm === null) {
      issues.push({
        format: detectFontFormat(data),
        message: FONT_WIDTH_ISSUE_MESSAGE,
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
