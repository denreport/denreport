import { describe, expect, it } from "vitest";
import { detectFontFormat } from "../src/fonts/format";
import { buildSfnt } from "./helpers/sfnt";

describe("detectFontFormat", () => {
  it("detects a glyf table under sfntVersion 0x00010000 as ttf", () => {
    expect(detectFontFormat(buildSfnt(0x00010000, ["glyf", "head"]))).toBe(
      "ttf",
    );
  });

  it("detects a CFF table under OTTO as cff", () => {
    expect(detectFontFormat(buildSfnt("OTTO", ["CFF ", "head"]))).toBe("cff");
  });

  it("detects a CFF2 table wrapped in sfntVersion 0x00010000 as cff", () => {
    expect(detectFontFormat(buildSfnt(0x00010000, ["CFF2", "head"]))).toBe(
      "cff",
    );
  });

  it("prefers cff when both CFF and glyf tables are present", () => {
    expect(detectFontFormat(buildSfnt(0x00010000, ["glyf", "CFF "]))).toBe(
      "cff",
    );
  });

  it("detects the ttcf header as collection", () => {
    expect(detectFontFormat(buildSfnt("ttcf", []))).toBe("collection");
  });

  it("detects the wOFF header as woff", () => {
    expect(detectFontFormat(buildSfnt("wOFF", []))).toBe("woff");
  });

  it("detects the wOF2 header as woff2", () => {
    expect(detectFontFormat(buildSfnt("wOF2", []))).toBe("woff2");
  });

  it("returns unknown for data shorter than the sfnt header", () => {
    expect(detectFontFormat(new Uint8Array(0))).toBe("unknown");
    expect(detectFontFormat(new Uint8Array(11))).toBe("unknown");
  });

  it("returns unknown when the table directory exceeds the data length", () => {
    const truncated = buildSfnt(0x00010000, ["glyf"]).slice(0, 20);
    expect(detectFontFormat(truncated)).toBe("unknown");
  });

  it("returns unknown for a garbage byte sequence", () => {
    expect(detectFontFormat(new Uint8Array(64).fill(0xff))).toBe("unknown");
  });

  it("returns unknown for a directory without outline tables", () => {
    expect(detectFontFormat(buildSfnt(0x00010000, ["head", "cmap"]))).toBe(
      "unknown",
    );
  });

  it("reads from a subarray with a non-zero byteOffset", () => {
    const ttf = buildSfnt(0x00010000, ["glyf"]);
    const padded = new Uint8Array(ttf.length + 8);
    padded.set(ttf, 8);
    expect(detectFontFormat(padded.subarray(8))).toBe("ttf");
  });
});
