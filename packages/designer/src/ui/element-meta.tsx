import type { IrElementType } from "@denreport/core";
import type { ReactNode } from "react";
import type { Messages } from "../i18n/messages";

const STATIC_ICONS: Readonly<
  Record<Exclude<IrElementType, "text">, ReactNode>
> = {
  line: <span className="apx-pi-line" />,
  rect: <span className="apx-pi-rect" />,
  ellipse: <span className="apx-pi-ellipse" />,
  table: <span className="apx-pi-table" />,
  image: <span className="apx-pi-image" />,
  flex: (
    <span className="apx-pi-flex">
      <i />
    </span>
  ),
  pageNumber: <span className="apx-pi-pageno">n/N</span>,
  barcode: <span className="apx-pi-barcode" />,
};

/** Palette / layer-row icon for an element type. Display names are locale-dependent, so use useMessages().elementTypes */
export function elementTypeIcon(type: IrElementType, m: Messages): ReactNode {
  // Only "text" draws a single sample glyph, so use the locale's character
  return type === "text" ? (
    <span className="apx-pi-text">{m.textIconGlyph}</span>
  ) : (
    STATIC_ICONS[type]
  );
}
