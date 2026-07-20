// queryLocalFonts / FontData are not yet in lib.dom.d.ts, so we handle them with a local type scoped here.
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
  /** FontData.blob() -> arrayBuffer() -> Uint8Array. Rejects on failure */
  readonly loadData: () => Promise<Uint8Array>;
}

/** Feature detection for "queryLocalFonts" in window */
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

/** Calls queryLocalFonts() and returns the candidate list sorted by fullName ascending. Must be
    called from a user-initiated action (requires transient user activation). NotAllowedError ->
    "denied", other failures -> "error" */
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
