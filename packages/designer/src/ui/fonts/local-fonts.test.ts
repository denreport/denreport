import { describe, expect, it } from "vitest";
import { isLocalFontAccessSupported, listLocalFonts } from "./local-fonts";

interface FakeFontData {
  readonly postscriptName: string;
  readonly fullName: string;
  readonly family: string;
  readonly style: string;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

function fakeWindow(handler: () => Promise<readonly FakeFontData[]>): Window {
  return {
    queryLocalFonts: () =>
      handler().then((list) =>
        list.map((font) => ({
          ...font,
          blob: async () => new Blob([font.bytes]),
        })),
      ),
  } as unknown as Window;
}

describe("isLocalFontAccessSupported", () => {
  it("returns true when queryLocalFonts exists", () => {
    expect(isLocalFontAccessSupported(fakeWindow(async () => []))).toBe(true);
  });

  it("returns false when absent", () => {
    expect(isLocalFontAccessSupported({} as unknown as Window)).toBe(false);
  });
});

describe("listLocalFonts", () => {
  it("returns unsupported for an unsupported window", async () => {
    const result = await listLocalFonts({} as unknown as Window);
    expect(result).toEqual({ ok: false, reason: "unsupported" });
  });

  it("returns the candidate list sorted by fullName ascending, and loadData converts the blob to a Uint8Array", async () => {
    const bBytes = new Uint8Array([1, 2, 3]);
    const win = fakeWindow(async () => [
      {
        postscriptName: "B-Regular",
        fullName: "B Font",
        family: "B",
        style: "Regular",
        bytes: bBytes,
      },
      {
        postscriptName: "A-Regular",
        fullName: "A Font",
        family: "A",
        style: "Regular",
        bytes: new Uint8Array([4, 5]),
      },
    ]);

    const result = await listLocalFonts(win);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("成功を期待");
    expect(result.fonts.map((f) => f.fullName)).toEqual(["A Font", "B Font"]);

    const secondFont = result.fonts[1];
    if (secondFont === undefined) throw new Error("候補がない");
    await expect(secondFont.loadData()).resolves.toEqual(bBytes);
  });

  it("returns denied on NotAllowedError", async () => {
    const win = {
      queryLocalFonts: () =>
        Promise.reject(
          Object.assign(new Error("denied"), { name: "NotAllowedError" }),
        ),
    } as unknown as Window;
    expect(await listLocalFonts(win)).toEqual({ ok: false, reason: "denied" });
  });

  it("returns error on other exceptions", async () => {
    const win = {
      queryLocalFonts: () => Promise.reject(new Error("boom")),
    } as unknown as Window;
    expect(await listLocalFonts(win)).toEqual({ ok: false, reason: "error" });
  });
});
