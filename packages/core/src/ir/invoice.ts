import type { IrError } from "./errors";
import { textTemplateKeys } from "./interpolate";
import type { IrDocument, IrElement, IrFlexChild } from "./types";

interface InvoiceItem {
  readonly label: string;
  readonly keys: readonly string[];
}

// 国税庁の記載必要6項目。項目4（適用税率）は税率別の対価の額の欄で代表させる
const INVOICE_ITEMS: readonly InvoiceItem[] = [
  { label: "発行者の登録番号", keys: ["registrationNumber"] },
  { label: "取引年月日", keys: ["issueDate", "transactionDate"] },
  { label: "取引内容", keys: ["description", "itemName"] },
  {
    label: "税率ごとに区分した対価の額・適用税率",
    keys: ["taxableAmount", "taxableAmount8", "taxableAmount10"],
  },
  {
    label: "税率ごとに区分した消費税額等",
    keys: ["taxAmount", "taxAmount8", "taxAmount10"],
  },
  { label: "交付を受ける事業者の氏名又は名称", keys: ["customerName"] },
];

function describeKeys(keys: readonly string[]): string {
  return keys.map((key) => `"${key}"`).join(" / ");
}

function describeTokens(keys: readonly string[]): string {
  return keys.map((key) => `{${key}}`).join(" / ");
}

function collectElementKeys(
  element: IrElement | IrFlexChild,
  keys: Set<string>,
): void {
  if (element.type === "text") {
    for (const key of textTemplateKeys(element.text)) keys.add(key);
    return;
  }
  if (element.type === "table") {
    for (const column of element.columns) keys.add(column.key);
    return;
  }
  if (element.type === "flex") {
    for (const child of element.children) collectElementKeys(child, keys);
  }
}

function placedKeys(document: IrDocument): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const element of document.elements) {
    collectElementKeys(element, keys);
  }
  return keys;
}

/**
 * Checks that a `docType: "qualifiedInvoice"` document has a data-bound field
 * (text token or table column key) for each of the six items required by
 * Japan's qualified invoice system, and returns a Q01 warning for each
 * missing item. Returns an empty array when `docType` is unset. Assumes
 * `document` is the output of parseIr and already passed validateIr.
 */
export function checkQualifiedInvoice(
  document: IrDocument,
): readonly IrError[] {
  if (document.docType !== "qualifiedInvoice") return [];
  const placed = placedKeys(document);
  const errors: IrError[] = [];
  for (const item of INVOICE_ITEMS) {
    if (item.keys.some((key) => placed.has(key))) continue;
    errors.push({
      rule: "Q01",
      path: "elements",
      message: `適格請求書の記載事項「${item.label}」の差し込み欄がありません（キー ${describeKeys(item.keys)} の ${describeTokens(item.keys)} トークンまたは表の列キーを配置してください）`,
    });
  }
  return errors;
}
