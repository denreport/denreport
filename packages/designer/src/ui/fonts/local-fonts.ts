// lib.dom.d.ts に queryLocalFonts / FontData がまだ無いため、ここに閉じたローカル型で扱う。
interface LocalFontData {
  readonly postscriptName: string;
  readonly fullName: string;
  readonly family: string;
  readonly style: string;
  blob(): Promise<Blob>;
}

interface WindowWithLocalFonts {
  queryLocalFonts(): Promise<readonly LocalFontData[]>;
}

export interface LocalFontCandidate {
  readonly postscriptName: string;
  readonly fullName: string;
  readonly family: string;
  readonly style: string;
  /** FontData.blob() → arrayBuffer() → Uint8Array。失敗は reject */
  readonly loadData: () => Promise<Uint8Array>;
}

/** "queryLocalFonts" in window の機能検出 */
export function isLocalFontAccessSupported(win: Window): boolean {
  return "queryLocalFonts" in win;
}

export type ListLocalFontsResult =
  | { readonly ok: true; readonly fonts: readonly LocalFontCandidate[] }
  | { readonly ok: false; readonly reason: "unsupported" | "denied" | "error" };

function toCandidate(data: LocalFontData): LocalFontCandidate {
  return {
    postscriptName: data.postscriptName,
    fullName: data.fullName,
    family: data.family,
    style: data.style,
    loadData: async () =>
      new Uint8Array(await (await data.blob()).arrayBuffer()),
  };
}

/** queryLocalFonts() を呼び、fullName 昇順の候補列を返す。ユーザー操作起点で呼ぶこと
    （transient user activation が必要）。NotAllowedError → "denied"、その他の失敗 → "error" */
export async function listLocalFonts(
  win: Window,
): Promise<ListLocalFontsResult> {
  if (!isLocalFontAccessSupported(win)) {
    return { ok: false, reason: "unsupported" };
  }
  try {
    const data = await (
      win as unknown as WindowWithLocalFonts
    ).queryLocalFonts();
    const fonts = data
      .map(toCandidate)
      .toSorted((a, b) => a.fullName.localeCompare(b.fullName));
    return { ok: true, fonts };
  } catch (error) {
    if (error instanceof Error && error.name === "NotAllowedError") {
      return { ok: false, reason: "denied" };
    }
    return { ok: false, reason: "error" };
  }
}
