import type { CharWidthEm } from "@denreport/core";
import { readAscentPerEm, readCharWidths } from "@denreport/targets";

export interface PreviewFont {
  readonly family: string;
  readonly ascentPerEm: number;
  readonly charWidths: CharWidthEm;
}

/** 文書のフォント組をスロット別の PreviewFont に解決したもの。regular は必須 */
export interface PreviewFontSet {
  readonly regular: PreviewFont;
  readonly bold?: PreviewFont;
  readonly italic?: PreviewFont;
  readonly boldItalic?: PreviewFont;
}

function hasRegistered(doc: Document, family: string): boolean {
  let registered = false;
  doc.fonts.forEach((face) => {
    if (face.family === family) {
      registered = true;
    }
  });
  return registered;
}

/** 同梱フォントを url から fetch し、FontFace を family（ホストページと衝突しない
    apx- 接頭辞の一意名を呼び出し側が渡す）で doc.fonts に登録して計量とともに返す。
    同一 doc に登録済みなら再登録しない（複数インスタンス・再オープンの重複防止）。
    失敗（fetch 不能・計量読取不能）は reject し、呼び出し側がフォールバック表示する */
export async function loadPreviewFont(
  doc: Document,
  url: URL,
  family: string,
): Promise<PreviewFont> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`同梱フォントを取得できません (HTTP ${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  const data = new Uint8Array(buffer);
  const ascentPerEm = readAscentPerEm(data);
  if (ascentPerEm === null) {
    throw new Error("同梱フォントの計量を読み取れません");
  }
  const charWidths = readCharWidths(data);
  if (charWidths === null) {
    throw new Error("同梱フォントの字幅を読み取れません");
  }
  if (!hasRegistered(doc, family)) {
    const face = new FontFace(family, buffer);
    await face.load();
    doc.fonts.add(face);
  }
  return { family, ascentPerEm, charWidths };
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

// name は sanitizeFontName の出力（非 ASCII 名は衝突しうる）のため、family の一致だけでは
// 別フォントへの差し替えを見逃す。登録済みバイト列を doc ごとに保持し内容一致で判定する
const registeredByDoc = new WeakMap<
  Document,
  Map<string, { readonly data: Uint8Array; readonly face: FontFace }>
>();

/** 任意バイト列を "apx-local-<name>" の family で doc.fonts に登録し family 名を返す。
    同一 family に同一バイト列が登録済みなら再登録しない。バイト列が異なる場合は
    （name の衝突であっても）差し替えて登録し直す */
export async function registerPreviewFace(
  doc: Document,
  name: string,
  data: Uint8Array,
): Promise<string> {
  const family = `apx-local-${name}`;
  let registered = registeredByDoc.get(doc);
  if (registered === undefined) {
    registered = new Map();
    registeredByDoc.set(doc, registered);
  }
  const previous = registered.get(family);
  if (previous !== undefined && bytesEqual(previous.data, data)) {
    return family;
  }
  const face = new FontFace(family, new Uint8Array(data));
  await face.load();
  doc.fonts.add(face);
  if (previous !== undefined) {
    doc.fonts.delete(previous.face);
  }
  registered.set(family, { data, face });
  return family;
}
