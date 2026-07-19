/** 同梱フォントを url から fetch して Uint8Array で返す。失敗（非 2xx・ネットワーク）は reject。
    キャッシュは持たない（ブラウザの HTTP キャッシュに委ねる） */
export async function fetchEmbeddedFontData(url: URL): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`同梱フォントを取得できません (HTTP ${response.status})`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
