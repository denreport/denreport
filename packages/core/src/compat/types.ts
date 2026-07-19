import type { IrElement, IrElementType } from "../ir/types";

/** Support level of an IR element or attribute for a given export target. */
export type CompatLevel = "supported" | "approximated" | "unsupported";

/**
 * Compatibility level for a single element or attribute. For every level
 * except "supported", both a `note` (developer-facing, technical) and a
 * `userMessage` (plain-language, shown in the UI) are required.
 */
export type CompatEntry =
  | { readonly level: "supported" }
  | {
      readonly level: "approximated";
      readonly note: string;
      readonly userMessage: string;
    }
  | {
      readonly level: "unsupported";
      readonly note: string;
      readonly userMessage: string;
    };

type CompatAttributeOf<K extends IrElementType> = Exclude<
  keyof Extract<IrElement, { readonly type: K }>,
  "type" | "id" | "name"
>;

/**
 * Compatibility levels for one IR element type: the element itself and,
 * optionally, individually-tracked attributes of that element type.
 */
export interface ElementCompat<K extends IrElementType = IrElementType> {
  readonly element: CompatEntry;
  readonly attributes?: {
    readonly [A in CompatAttributeOf<K>]?: CompatEntry;
  };
}

/** Identifier of a supported export target. */
export type CompatTargetId = "pdfme" | "reportlab";

/** Full compatibility matrix for one export target, covering every IR element type. */
export interface TargetCompatMatrix {
  readonly target: CompatTargetId;
  readonly displayName: string;
  readonly elements: { readonly [K in IrElementType]: ElementCompat<K> };
}
