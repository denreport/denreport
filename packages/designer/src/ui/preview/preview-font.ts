import type { CharWidthEm } from "@denreport/core";
import { readAscentPerEm, readCharWidths } from "@denreport/targets";

export interface PreviewFont {
  readonly family: string;
  readonly ascentPerEm: number;
  readonly charWidths: CharWidthEm;
}

/** A document's font set resolved into a per-slot PreviewFont. regular is required */
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

/** Fetches the bundled font from the url, registers a FontFace to doc.fonts under family (the
    caller passes a unique dr- prefixed name that won't collide with the host page), and returns
    it together with its metrics. Does not re-register if already registered on the same doc
    (prevents duplication across multiple instances / reopens). Failures (fetch failure, unreadable
    metrics) reject, and the caller shows a fallback display */
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

// Since name is the output of sanitizeFontName (non-ASCII names can collide), matching on family
// alone would miss a swap to a different font. Keep the registered byte array per doc and decide by content match
const registeredByDoc = new WeakMap<
  Document,
  Map<string, { readonly data: Uint8Array; readonly face: FontFace }>
>();

/** Registers an arbitrary byte array to doc.fonts under the family "dr-local-<name>" and
    returns the family name. Does not re-register if the same byte array is already registered
    under the same family. If the byte array differs (even on a name collision), swaps it and
    registers anew */
export async function registerPreviewFace(
  doc: Document,
  name: string,
  data: Uint8Array,
): Promise<string> {
  const family = `dr-local-${name}`;
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
