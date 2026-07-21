import { describe, expect, it } from "vitest";
import { buildPdfmeFontMap } from "../src/pdfme/font";
import { buildUniformWidthTtf, syntheticTtf } from "./helpers/sfnt";

describe("buildPdfmeFontMap", () => {
  it("maps a regular-only set to a single fallback entry holding the data", () => {
    const data = syntheticTtf();
    const map = buildPdfmeFontMap({ regular: "NotoSansJP" }, { regular: data });
    expect(Object.keys(map)).toEqual(["NotoSansJP"]);
    expect(map.NotoSansJP?.fallback).toBe(true);
    expect(map.NotoSansJP?.data).toBe(data);
    expect(map.NotoSansJP).not.toHaveProperty("subset");
  });

  it("registers every declared slot under its logical name with exactly one fallback (regular)", () => {
    const regular = syntheticTtf();
    const bold = buildUniformWidthTtf(2, 1);
    const italic = buildUniformWidthTtf(1, 1);
    const map = buildPdfmeFontMap(
      { regular: "Base", bold: "BaseBold", italic: "BaseItalic" },
      { regular, bold, italic },
    );
    expect(Object.keys(map).sort()).toEqual(["Base", "BaseBold", "BaseItalic"]);
    expect(map.Base?.fallback).toBe(true);
    expect(map.BaseBold?.fallback).toBe(false);
    expect(map.BaseItalic?.fallback).toBe(false);
    expect(map.BaseBold?.data).toBe(bold);
    expect(Object.values(map).filter((entry) => entry.fallback)).toHaveLength(
      1,
    );
  });

  it("skips a declared slot without data", () => {
    const map = buildPdfmeFontMap(
      { regular: "Base", bold: "BaseBold" },
      { regular: syntheticTtf() },
    );
    expect(Object.keys(map)).toEqual(["Base"]);
  });

  it("subset: true still omits the subset field (equivalent to the default)", () => {
    const map = buildPdfmeFontMap(
      { regular: "NotoSansJP" },
      { regular: syntheticTtf() },
      true,
    );
    expect(map.NotoSansJP).not.toHaveProperty("subset");
  });

  it("subset: false includes subset: false on every entry", () => {
    const map = buildPdfmeFontMap(
      { regular: "Base", bold: "BaseBold" },
      { regular: syntheticTtf(), bold: syntheticTtf() },
      false,
    );
    expect(map.Base?.subset).toBe(false);
    expect(map.BaseBold?.subset).toBe(false);
  });
});
