import type { IrFont } from "@denreport/core";
import type { FontSetData } from "../fonts/set";
import { FONT_SLOTS } from "../fonts/set";

/** A single pdfme font map entry. pdfme requires exactly one fallback entry per map. */
export interface PdfmeFontEntry {
  readonly data: Uint8Array;
  // pdfme は fallback: true のエントリをちょうど1つ要求する（regular のみ true）
  readonly fallback: boolean;
  // 省略時は pdfme の既定（サブセット埋め込み）。false のときのみ出力する
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
    // 同一論理名が複数スロットに現れた場合は先勝ち（regular の fallback を上書きで失わない）
    if (name in map) continue;
    map[name] =
      subset === false
        ? { data, fallback: slot === "regular", subset: false }
        : { data, fallback: slot === "regular" };
  }
  return map;
}
