import { getMessages, type MessageLocale } from "../i18n/messages";
import type { IrError } from "./errors";
import { textTemplateKeys } from "./interpolate";
import type { IrDocument, IrElement, IrFlexChild } from "./types";

type InvoiceItemId =
  | "registrationNumber"
  | "transactionDate"
  | "description"
  | "taxableAmount"
  | "taxAmount"
  | "customerName";

interface InvoiceItem {
  readonly id: InvoiceItemId;
  readonly keys: readonly string[];
}

// The 6 required items per the National Tax Agency. Item 4 (applicable tax rate) is represented by the field for the consideration amount per tax rate
const INVOICE_ITEMS: readonly InvoiceItem[] = [
  { id: "registrationNumber", keys: ["registrationNumber"] },
  { id: "transactionDate", keys: ["issueDate", "transactionDate"] },
  { id: "description", keys: ["description", "itemName"] },
  {
    id: "taxableAmount",
    keys: ["taxableAmount", "taxableAmount8", "taxableAmount10"],
  },
  {
    id: "taxAmount",
    keys: ["taxAmount", "taxAmount8", "taxAmount10"],
  },
  { id: "customerName", keys: ["customerName"] },
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
 * `options.locale` controls the warning messages' language (default "ja").
 */
export function checkQualifiedInvoice(
  document: IrDocument,
  options?: { readonly locale?: MessageLocale },
): readonly IrError[] {
  if (document.docType !== "qualifiedInvoice") return [];
  const m = getMessages(options?.locale).invoice;
  const placed = placedKeys(document);
  const errors: IrError[] = [];
  for (const item of INVOICE_ITEMS) {
    if (item.keys.some((key) => placed.has(key))) continue;
    errors.push({
      rule: "Q01",
      path: "elements",
      message: m.missingField(
        m.itemLabels[item.id],
        describeKeys(item.keys),
        describeTokens(item.keys),
      ),
    });
  }
  return errors;
}
