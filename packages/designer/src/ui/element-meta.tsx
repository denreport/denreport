import type { IrElementType } from "@denreport/core";
import type { ReactNode } from "react";

/** 要素型のパレット・レイヤー行アイコン。表示名はロケール依存のため useMessages().elementTypes を使う */
export const ELEMENT_TYPE_ICON: Readonly<Record<IrElementType, ReactNode>> = {
  text: <span className="apx-pi-text">あ</span>,
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
