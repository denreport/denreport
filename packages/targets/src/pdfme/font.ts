import type { IrFont } from "@denreport/core";
import type { FontSetData } from "../fonts/set.js";
import { FONT_SLOTS } from "../fonts/set.js";

/** A single pdfme font map entry. pdfme requires exactly one fallback entry per map. */
export interface PdfmeFontEntry {
  readonly data: Uint8Array;
  // pdfme requires exactly one entry with fallback: true (only regular is true)
  readonly fallback: boolean;
  // When omitted, pdfme's default (subset embedding) applies. Only emitted when false.
  readonly subset?: false;
}

/** A pdfme generator `font` option: a map from logical font name to its data, as built by buildPdfmeFontMap. */
export type PdfmeFontMap = Readonly<Record<string, PdfmeFontEntry>>;

/**
 * Builds a PdfmeFontMap registering every slot declared in `font` that has
 * data in `fonts`, keyed by the slot's logical name. Only the regular entry
 * is the fallback. Pass `subset: false` to embed the fonts without
 * subsetting.
 */
export function buildPdfmeFontMap(
  font: IrFont,
  fonts: FontSetData,
  subset?: boolean,
): PdfmeFontMap {
  const map: Record<string, PdfmeFontEntry> = {};
  for (const slot of FONT_SLOTS) {
    const name = font[slot];
    const data = fonts[slot];
    if (name === undefined || data === undefined) continue;
    // First occurrence wins when the same logical name appears in multiple
    // slots (so regular's fallback isn't lost to an overwrite).
    if (name in map) continue;
    map[name] =
      subset === false
        ? { data, fallback: slot === "regular", subset: false }
        : { data, fallback: slot === "regular" };
  }
  return map;
}
