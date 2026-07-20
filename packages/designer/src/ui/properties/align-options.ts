import type { IrAlign } from "@denreport/core";
import type { Messages } from "../../i18n/messages";

export type AlignLabels = Messages["properties"]["align"];

/** IrAlign の選択肢一覧。ラベルはロケール解決済みの文言を呼び出し側が渡す */
export function alignOptions(
  labels: AlignLabels,
): readonly { readonly value: IrAlign; readonly label: string }[] {
  return [
    { value: "left", label: labels.left },
    { value: "center", label: labels.center },
    { value: "right", label: labels.right },
    { value: "justify", label: labels.justify },
  ];
}
