/** A single pdfme font map entry. pdfme requires exactly one fallback font, so `fallback` is always `true`. */
export interface PdfmeFontEntry {
  readonly data: Uint8Array;
  // Font マップは1エントリのみで、pdfme は fallback をちょうど1つ要求する
  readonly fallback: true;
  // 省略時は pdfme の既定（サブセット埋め込み）。false のときのみ出力する
  readonly subset?: false;
}

/** A pdfme generator `font` option: a single-entry map from font name to its data, as built by buildPdfmeFont. */
export type PdfmeFontMap = Readonly<Record<string, PdfmeFontEntry>>;

/**
 * Builds a single-entry PdfmeFontMap for `name`/`data`, suitable for pdfme's
 * generator `font` option. Pass `subset: false` to embed the font without
 * subsetting.
 */
export function buildPdfmeFont(
  name: string,
  data: Uint8Array,
  subset?: boolean,
): PdfmeFontMap {
  return {
    [name]:
      subset === false
        ? { data, fallback: true, subset: false }
        : { data, fallback: true },
  };
}
