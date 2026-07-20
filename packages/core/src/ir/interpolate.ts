import { IDENTIFIER_MAX_LENGTH } from "./constants.js";
import type { IrData } from "./data.js";

// Scans one token as the identifier's first character plus up to (IDENTIFIER_MAX_LENGTH - 1) remaining characters
const TOKEN_PATTERN = new RegExp(
  `\\{([A-Za-z_][A-Za-z0-9_]{0,${IDENTIFIER_MAX_LENGTH - 1}})\\}`,
  "g",
);

/**
 * Returns the `{key}` token keys found in `text`, in order of first
 * occurrence, including duplicates.
 */
export function textTemplateKeys(text: string): readonly string[] {
  return [...text.matchAll(TOKEN_PATTERN)].map((match) => match[1] as string);
}

/** Replaces {key} with its data value. A missing key or non-string value becomes an empty string. Single pass only, no re-expansion */
export function interpolateText(text: string, data: IrData): string {
  return text.replace(TOKEN_PATTERN, (_, key: string) => {
    const value = data[key];
    return typeof value === "string" ? value : "";
  });
}
