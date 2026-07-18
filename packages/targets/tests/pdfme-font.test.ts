import { describe, expect, it } from "vitest";
import { buildPdfmeFont } from "../src/pdfme/font";
import { syntheticTtf } from "./helpers/sfnt";

describe("buildPdfmeFont", () => {
  it("maps the logical name to a single fallback entry holding the data", () => {
    const data = syntheticTtf();
    const font = buildPdfmeFont("NotoSansJP", data);
    expect(Object.keys(font)).toEqual(["NotoSansJP"]);
    expect(font.NotoSansJP?.fallback).toBe(true);
    expect(font.NotoSansJP?.data).toBe(data);
    expect(font.NotoSansJP).not.toHaveProperty("subset");
  });

  it("subset: true でも subset フィールドを含まない（既定と同値）", () => {
    const data = syntheticTtf();
    const font = buildPdfmeFont("NotoSansJP", data, true);
    expect(font.NotoSansJP).not.toHaveProperty("subset");
  });

  it("subset: false では subset: false を含める", () => {
    const data = syntheticTtf();
    const font = buildPdfmeFont("NotoSansJP", data, false);
    expect(font.NotoSansJP?.subset).toBe(false);
    expect(font.NotoSansJP?.data).toBe(data);
  });
});
