import type { IrElementType, StyleAttrKey } from "./types";

/**
 * Style attribute keys a named style (`IrNamedStyle.attrs`) may set for each
 * element type. Element types with no styleable attributes map to an empty array.
 */
export const STYLEABLE_ATTRS: Readonly<
  Record<IrElementType, readonly StyleAttrKey[]>
> = {
  text: ["fontSize", "align", "lineHeight"],
  pageNumber: ["fontSize", "align", "lineHeight"],
  table: ["fontSize"],
  rect: ["borderWidth"],
  line: ["thickness"],
  ellipse: [],
  image: [],
  flex: [],
  barcode: [],
};

/** Returns the style attribute keys applicable to `type` (see STYLEABLE_ATTRS). */
export function applicableStyleAttrs(
  type: IrElementType,
): readonly StyleAttrKey[] {
  return STYLEABLE_ATTRS[type];
}
