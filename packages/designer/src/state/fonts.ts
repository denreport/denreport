import type { IrFont, IrFontSlot } from "@denreport/core";

// IR の font 論理名の識別子パターン（core の IDENTIFIER_PATTERN・IDENTIFIER_MAX_LENGTH と同一）を
// ここでも満たす必要があるが、定数は core から公開されていないため複製する。
const IDENTIFIER_MAX_LENGTH = 64;

export interface RegisteredFont {
  /** IR 識別子（font の論理名との突き合わせキー。sanitizeFontName の出力） */
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
  | { readonly kind: "embedded"; readonly name: string }
  | { readonly kind: "registered"; readonly font: RegisteredFont }
  | { readonly kind: "missing"; readonly name: string };

/** 論理名 → 実データの解決規則の唯一の定義点。優先順: レジストリ → 同梱名 → missing。
    embeddedNames は呼び出し側（ui 層）が EMBEDDED_*_FONT_NAME を渡す（state は targets 非依存のため） */
export function resolveFont(
  name: string,
  registry: ReadonlyMap<string, RegisteredFont>,
  embeddedNames: ReadonlySet<string>,
): FontResolution {
  const font = registry.get(name);
  if (font !== undefined) {
    return { kind: "registered", font };
  }
  if (embeddedNames.has(name)) {
    return { kind: "embedded", name };
  }
  return { kind: "missing", name };
}

const FONT_SLOTS: readonly IrFontSlot[] = [
  "regular",
  "bold",
  "italic",
  "boldItalic",
];

/** 文書の宣言スロットを一括解決する（未宣言スロットはエントリなし） */
export function resolveFontSet(
  font: IrFont,
  registry: ReadonlyMap<string, RegisteredFont>,
  embeddedNames: ReadonlySet<string>,
): ReadonlyMap<IrFontSlot, FontResolution> {
  const resolutions = new Map<IrFontSlot, FontResolution>();
  for (const slot of FONT_SLOTS) {
    const name = font[slot];
    if (name === undefined) continue;
    resolutions.set(slot, resolveFont(name, registry, embeddedNames));
  }
  return resolutions;
}
