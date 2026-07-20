import type { IrFont, IrFontSlot, IrFontStyle, IrFontWeight } from "./types.js";

/**
 * Resolves a requested (weight, style) pair to a slot defined in `font`.
 * Degradation prefers keeping the style over the weight: (bold, italic)
 * falls back boldItalic → italic → bold → regular, (bold, normal) falls back
 * bold → regular, and (normal, italic) falls back italic → regular. An
 * undefined slot is never a validation error — this degradation is the spec.
 */
export function resolveFontSlot(
  font: IrFont,
  weight: IrFontWeight,
  style: IrFontStyle,
): IrFontSlot {
  const candidates: readonly IrFontSlot[] =
    weight === "bold" && style === "italic"
      ? ["boldItalic", "italic", "bold"]
      : weight === "bold"
        ? ["bold"]
        : style === "italic"
          ? ["italic"]
          : [];
  for (const slot of candidates) {
    if (font[slot] !== undefined) return slot;
  }
  return "regular";
}
