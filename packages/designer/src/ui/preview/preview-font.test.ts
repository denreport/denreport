import { EMBEDDED_FONT_URL } from "@denreport/targets";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPreviewFont, registerPreviewFace } from "./preview-font";

// A minimal sfnt that readAscentPerEm/readCharWidths can read (only head.unitsPerEm,
// hhea.ascender/numberOfHMetrics, one hmtx entry, and an empty cmap format4 subtable have real values)
function sfntWith(unitsPerEm: number, ascender: number): ArrayBuffer {
  const headOffset = 12 + 4 * 16;
  const headLength = 20;
  const hheaOffset = headOffset + headLength;
  const hheaLength = 36;
  const hmtxOffset = hheaOffset + hheaLength;
  const hmtxLength = 4;
  const cmapOffset = hmtxOffset + hmtxLength;
  const cmapSubtableLength = 24; // format4, segCount=1 (terminal segment only)
  const cmapLength = 12 + cmapSubtableLength; // header4 + record8 + subtable
  const buffer = new ArrayBuffer(cmapOffset + cmapLength);
  const view = new DataView(buffer);
  view.setUint32(0, 0x00010000);
  view.setUint16(4, 4);
  view.setUint32(12, 0x68656164); // 'head'
  view.setUint32(12 + 8, headOffset);
  view.setUint32(12 + 12, headLength);
  view.setUint32(28, 0x68686561); // 'hhea'
  view.setUint32(28 + 8, hheaOffset);
  view.setUint32(28 + 12, hheaLength);
  view.setUint32(44, 0x686d7478); // 'hmtx'
  view.setUint32(44 + 8, hmtxOffset);
  view.setUint32(44 + 12, hmtxLength);
  view.setUint32(60, 0x636d6170); // 'cmap'
  view.setUint32(60 + 8, cmapOffset);
  view.setUint32(60 + 12, cmapLength);

  view.setUint16(headOffset + 18, unitsPerEm);
  view.setInt16(hheaOffset + 4, ascender);
  view.setUint16(hheaOffset + 34, 1); // numberOfHMetrics

  view.setUint16(hmtxOffset, 500); // advanceWidth
  view.setInt16(hmtxOffset + 2, 0); // lsb

  view.setUint16(cmapOffset + 2, 1); // numTables
  view.setUint16(cmapOffset + 4, 3); // platformId
  view.setUint16(cmapOffset + 6, 1); // encodingId
  view.setUint32(cmapOffset + 8, 12); // subtable offset (relative to the start of cmap)
  const subtableAbs = cmapOffset + 12;
  view.setUint16(subtableAbs, 4); // format
  view.setUint16(subtableAbs + 2, cmapSubtableLength);
  view.setUint16(subtableAbs + 6, 2); // segCountX2 (segCount=1)
  view.setUint16(subtableAbs + 14, 0xffff); // endCode[0]
  view.setUint16(subtableAbs + 18, 0xffff); // startCode[0]
  view.setInt16(subtableAbs + 20, 1); // idDelta[0]
  return buffer;
}

class FakeFontFace {
  readonly family: string;
  constructor(family: string, _source: ArrayBuffer) {
    this.family = family;
  }
  load(): Promise<this> {
    return Promise.resolve(this);
  }
}

interface FakeDoc {
  readonly doc: Document;
  readonly fonts: Set<{ readonly family: string }>;
}

function makeDoc(): FakeDoc {
  const fonts = new Set<{ readonly family: string }>();
  return { doc: { fonts } as unknown as Document, fonts };
}

function stubOkFetch(buffer: ArrayBuffer): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => {
    return { ok: true, arrayBuffer: async () => buffer } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("FontFace", FakeFontFace);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadPreviewFont", () => {
  it("returns ascentPerEm from actual font metrics along with family, and registers a FontFace", async () => {
    stubOkFetch(sfntWith(1000, 1160));
    const { doc, fonts } = makeDoc();

    const font = await loadPreviewFont(
      doc,
      EMBEDDED_FONT_URL,
      "dr-embedded-notosansjp",
    );
    expect(font.family).toBe("dr-embedded-notosansjp");
    expect(font.ascentPerEm).toBeCloseTo(1.16, 6);
    expect(fonts.size).toBe(1);
    expect([...fonts][0]?.family).toBe("dr-embedded-notosansjp");
  });

  it("does not re-register for the same document", async () => {
    stubOkFetch(sfntWith(1000, 1160));
    const { doc, fonts } = makeDoc();

    await loadPreviewFont(doc, EMBEDDED_FONT_URL, "dr-embedded-notosansjp");
    const second = await loadPreviewFont(
      doc,
      EMBEDDED_FONT_URL,
      "dr-embedded-notosansjp",
    );
    expect(fonts.size).toBe(1);
    expect(second.ascentPerEm).toBeCloseTo(1.16, 6);
  });

  it("rejects when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("ネットワーク不通"))),
    );
    vi.stubGlobal("FontFace", FakeFontFace);
    await expect(
      loadPreviewFont(
        makeDoc().doc,
        EMBEDDED_FONT_URL,
        "dr-embedded-notosansjp",
      ),
    ).rejects.toThrow();
  });

  it("rejects on an HTTP error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return { ok: false, status: 404 } as unknown as Response;
      }),
    );
    vi.stubGlobal("FontFace", FakeFontFace);
    await expect(
      loadPreviewFont(
        makeDoc().doc,
        EMBEDDED_FONT_URL,
        "dr-embedded-notosansjp",
      ),
    ).rejects.toThrow("404");
  });

  it("rejects on a byte sequence that metrics can't be read from, and does not register", async () => {
    stubOkFetch(new ArrayBuffer(4));
    const { doc, fonts } = makeDoc();
    await expect(
      loadPreviewFont(doc, EMBEDDED_FONT_URL, "dr-embedded-notosansjp"),
    ).rejects.toThrow();
    expect(fonts.size).toBe(0);
  });
});

describe("registerPreviewFace", () => {
  it("registers a FontFace with family dr-local-<name>", async () => {
    vi.stubGlobal("FontFace", FakeFontFace);
    const { doc, fonts } = makeDoc();

    const family = await registerPreviewFace(
      doc,
      "MyFont",
      new Uint8Array([1, 2, 3]),
    );
    expect(family).toBe("dr-local-MyFont");
    expect(fonts.size).toBe(1);
    expect([...fonts][0]?.family).toBe("dr-local-MyFont");
  });

  it("does not replace the FontFace when re-registering the same byte sequence", async () => {
    vi.stubGlobal("FontFace", FakeFontFace);
    const { doc, fonts } = makeDoc();

    await registerPreviewFace(doc, "MyFont", new Uint8Array([1, 2, 3]));
    const first = [...fonts][0];
    await registerPreviewFace(doc, "MyFont", new Uint8Array([1, 2, 3]));
    expect(fonts.size).toBe(1);
    expect([...fonts][0]).toBe(first);
  });

  it("re-registers when the byte sequence differs even for the same name", async () => {
    vi.stubGlobal("FontFace", FakeFontFace);
    const { doc, fonts } = makeDoc();

    await registerPreviewFace(doc, "MyFont", new Uint8Array([1, 2, 3]));
    const first = [...fonts][0];
    await registerPreviewFace(doc, "MyFont", new Uint8Array([4, 5, 6]));
    expect(fonts.size).toBe(1);
    expect([...fonts][0]).not.toBe(first);
  });
});
