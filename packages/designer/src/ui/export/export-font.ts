/** Fetches the bundled font from the url and returns it as a Uint8Array. Rejects on failure
    (non-2xx or network error). Keeps no cache of its own (relies on the browser's HTTP cache) */
export async function fetchEmbeddedFontData(url: URL): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`同梱フォントを取得できません (HTTP ${response.status})`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
