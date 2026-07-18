import type { IrElementType } from "@denreport/core";
import type { ReactNode } from "react";
import { ELEMENT_TYPE_LABEL } from "../state/element-labels";

export interface ElementTypeMeta {
  readonly label: string;
  readonly icon: ReactNode;
}

export const ELEMENT_TYPE_META: Readonly<
  Record<IrElementType, ElementTypeMeta>
> = {
  text: {
    label: ELEMENT_TYPE_LABEL.text,
    icon: <span className="apx-pi-text">あ</span>,
  },
  line: {
    label: ELEMENT_TYPE_LABEL.line,
    icon: <span className="apx-pi-line" />,
  },
  rect: {
    label: ELEMENT_TYPE_LABEL.rect,
    icon: <span className="apx-pi-rect" />,
  },
  ellipse: {
    label: ELEMENT_TYPE_LABEL.ellipse,
    icon: <span className="apx-pi-ellipse" />,
  },
  table: {
    label: ELEMENT_TYPE_LABEL.table,
    icon: <span className="apx-pi-table" />,
  },
  image: {
    label: ELEMENT_TYPE_LABEL.image,
    icon: <span className="apx-pi-image" />,
  },
  flex: {
    label: ELEMENT_TYPE_LABEL.flex,
    icon: (
      <span className="apx-pi-flex">
        <i />
      </span>
    ),
  },
  pageNumber: {
    label: ELEMENT_TYPE_LABEL.pageNumber,
    icon: <span className="apx-pi-pageno">n/N</span>,
  },
  barcode: {
    label: ELEMENT_TYPE_LABEL.barcode,
    icon: <span className="apx-pi-barcode" />,
  },
};
