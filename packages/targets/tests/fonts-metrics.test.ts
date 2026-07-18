import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EMBEDDED_FONT_URL } from "../src/fonts/embedded";
import { readAscentPerEm } from "../src/fonts/metrics";
import {
  buildHeadTable,
  buildHheaTable,
  buildSfnt,
  SYNTHETIC_TTF_ASCENT_PER_EM,
  syntheticTtf,
} from "./helpers/sfnt";

describe("readAscentPerEm", () => {
  it("returns hhea.ascender / head.unitsPerEm for a synthetic sfnt", () => {
    const font = buildSfnt(0x00010000, [
      { tag: "head", data: buildHeadTable(2048) },
      { tag: "hhea", data: buildHheaTable(1900) },
    ]);
    expect(readAscentPerEm(font)).toBe(1900 / 2048);
  });

  it("handles a negative ascender as a signed value", () => {
    const font = buildSfnt(0x00010000, [
      { tag: "head", data: buildHeadTable(1000) },
      { tag: "hhea", data: buildHheaTable(-200) },
    ]);
    expect(readAscentPerEm(font)).toBe(-0.2);
  });

  it("returns the synthetic TTF helper's known ratio", () => {
    expect(readAscentPerEm(syntheticTtf())).toBe(SYNTHETIC_TTF_ASCENT_PER_EM);
  });

  it.each([
    [
      "head",
      buildSfnt(0x00010000, [{ tag: "hhea", data: buildHheaTable(800) }]),
    ],
    [
      "hhea",
      buildSfnt(0x00010000, [{ tag: "head", data: buildHeadTable(1000) }]),
    ],
  ])("returns null when the %s table is missing", (_missing, font) => {
    expect(readAscentPerEm(font)).toBeNull();
  });

  it("returns null for truncated tables, zero unitsPerEm and short input", () => {
    const truncated = buildSfnt(0x00010000, [
      { tag: "head", data: new Uint8Array(10) },
      { tag: "hhea", data: new Uint8Array(4) },
    ]);
    expect(readAscentPerEm(truncated)).toBeNull();
    const zeroUnits = buildSfnt(0x00010000, [
      { tag: "head", data: buildHeadTable(0) },
      { tag: "hhea", data: buildHheaTable(800) },
    ]);
    expect(readAscentPerEm(zeroUnits)).toBeNull();
    expect(readAscentPerEm(new Uint8Array(4))).toBeNull();
  });

  it("reads 1.16 from the embedded Noto Sans JP asset", () => {
    const font = new Uint8Array(readFileSync(EMBEDDED_FONT_URL));
    expect(readAscentPerEm(font)).toBe(1.16);
  });
});
