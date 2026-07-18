// IR の font.name 識別子パターン（core の IDENTIFIER_PATTERN・IDENTIFIER_MAX_LENGTH と同一）を
// ここでも満たす必要があるが、この層は core にも依存しないため定数は複製する。
const IDENTIFIER_MAX_LENGTH = 64;

export interface RegisteredFont {
  /** IR 識別子（font.name との突き合わせキー。sanitizeFontName の出力） */
  readonly name: string;
  /** UI 表示用の元の名前（FontData.fullName） */
  readonly displayName: string;
  readonly data: Uint8Array;
  /** readAscentPerEm(data) の値（プレビュー規範式の入力） */
  readonly ascentPerEm: number;
}

/** フォント名を IR 識別子（^[A-Za-z_][A-Za-z0-9_]*$・64 文字以内）に落とす。
    非該当文字は除去し、先頭が数字なら "_" を前置、空になったら "LocalFont"、64 文字で切る */
export function sanitizeFontName(raw: string): string {
  let out = raw.replace(/[^A-Za-z0-9_]/g, "");
  if (/^[0-9]/.test(out)) {
    out = `_${out}`;
  }
  if (out === "") {
    out = "LocalFont";
  }
  return out.slice(0, IDENTIFIER_MAX_LENGTH);
}

export type FontResolution =
  | { readonly kind: "embedded" }
  | { readonly kind: "registered"; readonly font: RegisteredFont }
  | { readonly kind: "missing"; readonly name: string };

/** font.name → 実データの解決規則の唯一の定義点。優先順: レジストリ → 同梱名 → missing。
    embeddedName は呼び出し側（ui 層）が EMBEDDED_FONT_NAME を渡す（state は targets 非依存のため） */
export function resolveFont(
  name: string,
  registry: ReadonlyMap<string, RegisteredFont>,
  embeddedName: string,
): FontResolution {
  const font = registry.get(name);
  if (font !== undefined) {
    return { kind: "registered", font };
  }
  if (name === embeddedName) {
    return { kind: "embedded" };
  }
  return { kind: "missing", name };
}
