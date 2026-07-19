import { getMessages, type MessageLocale } from "../i18n/messages";

/**
 * Identifier of an IR validation rule. Prefixes group rules by concern: S
 * (JSON syntax, checked by parseIr), M (semantic, checked by validateIr), C
 * (data binding, checked by analyzeData/validateData), Q (qualified invoice,
 * checked by checkQualifiedInvoice), and F (footnotes, checked by validateIr).
 */
export type IrRuleId =
  | "S01"
  | "S02"
  | "S03"
  | "S04"
  | "S05"
  | "S06"
  | "S07"
  | "S08t"
  | "S08l"
  | "S08r"
  | "S08e"
  | "S08b"
  | "S08i"
  | "S08f"
  | "S08p"
  | "S08c"
  | "S09"
  | "S10"
  | "S12"
  | "S13"
  | "S14"
  | "S15"
  | "M01"
  | "M02"
  | "M03"
  | "M04"
  | "M05"
  | "M06"
  | "M07"
  | "M08"
  | "M09"
  | "M10"
  | "M11"
  | "M12"
  | "M13"
  | "M14"
  | "M15"
  | "M16"
  | "M17"
  | "M18"
  | "M19"
  | "M20"
  | "C01"
  | "C02"
  | "C03"
  | "C04"
  | "Q01"
  | "F01"
  | "F02"
  | "F03"
  | "F04"
  | "F05"
  | "F06";

/**
 * A single validation failure: which rule was violated, a JSON-pointer-like
 * `path` into the document where it occurred, and a human-readable `message`.
 */
export interface IrError {
  readonly rule: IrRuleId;
  readonly path: string;
  readonly message: string;
}

/**
 * Human-readable description of what `rule` checks, for `options.locale`
 * (default "ja").
 */
export function ruleDescription(
  rule: IrRuleId,
  options?: { readonly locale?: MessageLocale },
): string {
  return getMessages(options?.locale).rules[rule];
}
