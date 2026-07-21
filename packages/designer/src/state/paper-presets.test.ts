import { describe, expect, it } from "vitest";
import { paperPresetIdForSize, paperPresetsForLanguage } from "./paper-presets";

describe("paperPresetsForLanguage", () => {
  it("returns the Japan-oriented preset set (A3/A4/A5/B4(JIS)/B5(JIS)/postcard/letter) for ja-family language tags", () => {
    const ids = paperPresetsForLanguage("ja").map((p) => p.id);
    expect(ids).toEqual([
      "a3",
      "a4",
      "a5",
      "b4jis",
      "b5jis",
      "postcard",
      "letter",
    ]);
  });

  it("includes region-qualified tags like ja-JP in the Japan-oriented set", () => {
    expect(paperPresetsForLanguage("ja-JP").map((p) => p.id)).toContain(
      "b4jis",
    );
  });

  it("returns the international preset set (A3/A4/A5/B5(ISO)/Letter/Legal) for non-ja language tags", () => {
    const ids = paperPresetsForLanguage("en-US").map((p) => p.id);
    expect(ids).toEqual(["a3", "a4", "a5", "b5iso", "letter", "legal"]);
  });

  it("Letter/Legal have mm dimensions matching the standard values (8.5x11in / 8.5x14in)", () => {
    const intl = paperPresetsForLanguage("en-US");
    const letter = intl.find((p) => p.id === "letter");
    const legal = intl.find((p) => p.id === "legal");
    expect(letter).toEqual(
      expect.objectContaining({ width: 215.9, height: 279.4 }),
    );
    expect(legal).toEqual(
      expect.objectContaining({ width: 215.9, height: 355.6 }),
    );
    const jaLetter = paperPresetsForLanguage("ja").find(
      (p) => p.id === "letter",
    );
    expect(jaLetter).toEqual(
      expect.objectContaining({ width: 215.9, height: 279.4 }),
    );
  });
});

describe("paperPresetIdForSize", () => {
  const presets = paperPresetsForLanguage("ja");

  it("returns the id of the preset matching the dimensions", () => {
    expect(paperPresetIdForSize(presets, 210, 297)).toBe("a4");
    expect(paperPresetIdForSize(presets, 182, 257)).toBe("b5jis");
  });

  it("returns undefined for dimensions that match no preset", () => {
    expect(paperPresetIdForSize(presets, 210, 300)).toBeUndefined();
  });
});
