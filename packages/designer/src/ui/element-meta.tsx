import type { IrElementType } from "@denreport/core";
import type { ReactNode } from "react";
import type { Messages } from "../i18n/messages";

const STATIC_ICONS: Readonly<
  Record<Exclude<IrElementType, "text">, ReactNode>
> = {
  line: <span className="dr-pi-line" />,
  rect: <span className="dr-pi-rect" />,
  ellipse: <span className="dr-pi-ellipse" />,
  table: <span className="dr-pi-table" />,
  image: <span className="dr-pi-image" />,
  flex: (
    <span className="dr-pi-flex">
      <i />
    </span>
  ),
  pageNumber: <span className="dr-pi-pageno">n/N</span>,
  barcode: <span className="dr-pi-barcode" />,
};

/** Palette / layer-row icon for an element type. Display names are locale-dependent, so use useMessages().elementTypes */
export function elementTypeIcon(type: IrElementType, m: Messages): ReactNode {
  // Only "text" draws a single sample glyph, so use the locale's character
  return type === "text" ? (
    <span className="dr-pi-text">{m.textIconGlyph}</span>
  ) : (
    STATIC_ICONS[type]
  );
}
