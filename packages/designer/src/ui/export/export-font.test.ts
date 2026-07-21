import { EMBEDDED_FONT_URL } from "@denreport/targets";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchEmbeddedFontData } from "./export-font";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchEmbeddedFontData", () => {
  it("returns the response byte sequence as a Uint8Array", async () => {
    const bytes = new Uint8Array([0, 1, 0, 0, 42]);
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        arrayBuffer: async () => bytes.buffer,
      } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchEmbeddedFontData(EMBEDDED_FONT_URL)).resolves.toEqual(
      bytes,
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return { ok: false, status: 404 } as unknown as Response;
      }),
    );
    await expect(fetchEmbeddedFontData(EMBEDDED_FONT_URL)).rejects.toThrow(
      "404",
    );
  });

  it("rejects on a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("ネットワーク不通"))),
    );
    await expect(fetchEmbeddedFontData(EMBEDDED_FONT_URL)).rejects.toThrow(
      "ネットワーク不通",
    );
  });
});
