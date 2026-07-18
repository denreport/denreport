import type { IrAlign } from "@denreport/core";

export const ALIGN_OPTIONS: readonly {
  readonly value: IrAlign;
  readonly label: string;
}[] = [
  { value: "left", label: "左" },
  { value: "center", label: "中央" },
  { value: "right", label: "右" },
  { value: "justify", label: "均等" },
];
