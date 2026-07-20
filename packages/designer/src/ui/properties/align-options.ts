import type { IrAlign } from "@denreport/core";
import type { Messages } from "../../i18n/messages";

export type AlignLabels = Messages["properties"]["align"];

/** List of IrAlign options. The caller passes in locale-resolved labels. */
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
