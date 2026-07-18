import { IDENTIFIER_MAX_LENGTH } from "./constants";
import type { IrData } from "./data";

// 識別子の先頭文字 + 残り (IDENTIFIER_MAX_LENGTH - 1) 文字までを1トークンとして走査する
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

/** {key} をデータ値で置換する。キー欠落・非 string 値は空文字列。1パスのみ・再展開しない */
export function interpolateText(text: string, data: IrData): string {
  return text.replace(TOKEN_PATTERN, (_, key: string) => {
    const value = data[key];
    return typeof value === "string" ? value : "";
  });
}
