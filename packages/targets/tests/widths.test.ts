import { describe, expect, it } from "vitest";
import { readCharWidths } from "../src/fonts/widths";
import {
  buildCmapFormat4Subtable,
  buildCmapFormat12Subtable,
  buildCmapTable,
  buildHeadTable,
  buildHheaTable,
  buildHmtxTable,
  buildSfnt,
} from "./helpers/sfnt";

const UNITS_PER_EM = 1000;

// glyph0（.notdef）advance=250, glyph1=300, glyph2=400, glyph3（'A' 相当）=600
const HMTX = buildHmtxTable([
  { advanceWidth: 250, lsb: 0 },
  { advanceWidth: 300, lsb: 0 },
  { advanceWidth: 400, lsb: 0 },
  { advanceWidth: 600, lsb: 0 },
]);

function buildFont(
  cmapData: Uint8Array,
  options?: {
    readonly numberOfHMetrics?: number;
    readonly unitsPerEm?: number;
  },
): Uint8Array {
  return buildSfnt(0x00010000, [
    { tag: "head", data: buildHeadTable(options?.unitsPerEm ?? UNITS_PER_EM) },
    { tag: "hhea", data: buildHheaTable(800, options?.numberOfHMetrics ?? 4) },
    { tag: "hmtx", data: HMTX },
    { tag: "cmap", data: cmapData },
  ]);
}

const CODE_A = "A".codePointAt(0) as number;

describe("readCharWidths", () => {
  it("reads the advance width (em ratio) of a mapped codepoint from a format 4 subtable", () => {
    const cmap = buildCmapTable([
      {
        platformId: 3,
        encodingId: 1,
        data: buildCmapFormat4Subtable([{ code: CODE_A, glyphId: 3 }]),
      },
    ]);
    const charWidthEm = readCharWidths(buildFont(cmap));
    expect(charWidthEm).not.toBeNull();
    expect(charWidthEm?.(CODE_A)).toBe(600 / UNITS_PER_EM);
  });

  it("falls back to glyph 0 (.notdef) advance for a codepoint absent from cmap", () => {
    const cmap = buildCmapTable([
      {
        platformId: 3,
        encodingId: 1,
        data: buildCmapFormat4Subtable([{ code: CODE_A, glyphId: 3 }]),
      },
    ]);
    const charWidthEm = readCharWidths(buildFont(cmap));
    expect(charWidthEm?.("B".codePointAt(0) as number)).toBe(
      250 / UNITS_PER_EM,
    );
  });

  it("reads a mapped astral codepoint from a format 12 subtable", () => {
    const astral = "𠀀".codePointAt(0) as number;
    const cmap = buildCmapTable([
      {
        platformId: 3,
        encodingId: 10,
        data: buildCmapFormat12Subtable([
          { startCharCode: astral, endCharCode: astral, startGlyphId: 2 },
        ]),
      },
    ]);
    const charWidthEm = readCharWidths(buildFont(cmap));
    expect(charWidthEm?.(astral)).toBe(400 / UNITS_PER_EM);
  });

  it("falls back to a platform 0 subtable when no platform 3 subtable is present", () => {
    const cmap = buildCmapTable([
      {
        platformId: 0,
        encodingId: 4,
        data: buildCmapFormat4Subtable([{ code: CODE_A, glyphId: 3 }]),
      },
    ]);
    const charWidthEm = readCharWidths(buildFont(cmap));
    expect(charWidthEm?.(CODE_A)).toBe(600 / UNITS_PER_EM);
  });

  it("returns null when the cmap table is missing", () => {
    const font = buildSfnt(0x00010000, [
      { tag: "head", data: buildHeadTable(UNITS_PER_EM) },
      { tag: "hhea", data: buildHheaTable(800, 4) },
      { tag: "hmtx", data: HMTX },
    ]);
    expect(readCharWidths(font)).toBeNull();
  });

  it("returns null when numberOfHMetrics is 0", () => {
    const cmap = buildCmapTable([
      {
        platformId: 3,
        encodingId: 1,
        data: buildCmapFormat4Subtable([{ code: CODE_A, glyphId: 3 }]),
      },
    ]);
    expect(readCharWidths(buildFont(cmap, { numberOfHMetrics: 0 }))).toBeNull();
  });

  it("returns null when unitsPerEm is 0", () => {
    const cmap = buildCmapTable([
      {
        platformId: 3,
        encodingId: 1,
        data: buildCmapFormat4Subtable([{ code: CODE_A, glyphId: 3 }]),
      },
    ]);
    expect(readCharWidths(buildFont(cmap, { unitsPerEm: 0 }))).toBeNull();
  });

  it("returns null for a truncated/short input", () => {
    expect(readCharWidths(new Uint8Array(4))).toBeNull();
  });

  it("returns null when a cmap encoding record's subtable offset exceeds the file bounds", () => {
    const subtable = buildCmapFormat4Subtable([{ code: CODE_A, glyphId: 3 }]);
    const cmap = buildCmapTable([
      { platformId: 3, encodingId: 1, data: subtable },
    ]);
    new DataView(cmap.buffer).setUint32(8, 0xffffff); // encoding record #0's subtable offset field
    expect(readCharWidths(buildFont(cmap))).toBeNull();
  });

  it("falls back to glyph 0 without throwing when a format 4 idRangeOffset points outside the file bounds", () => {
    const subtable = buildCmapFormat4Subtable([{ code: CODE_A, glyphId: 3 }]);
    new DataView(subtable.buffer).setUint16(28, 0xfff0); // segment 0's idRangeOffset
    const cmap = buildCmapTable([
      { platformId: 3, encodingId: 1, data: subtable },
    ]);
    const charWidthEm = readCharWidths(buildFont(cmap));
    expect(charWidthEm).not.toBeNull();
    expect(() => charWidthEm?.(CODE_A)).not.toThrow();
    expect(charWidthEm?.(CODE_A)).toBe(250 / UNITS_PER_EM);
  });
});
