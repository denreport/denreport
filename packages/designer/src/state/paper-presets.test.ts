import { describe, expect, it } from "vitest";
import { paperPresetIdForSize, paperPresetsForLanguage } from "./paper-presets";

describe("paperPresetsForLanguage", () => {
  it("ja 系の言語タグでは日本語向けセット（A3/A4/A5/B4(JIS)/B5(JIS)/はがき/レター）を返す", () => {
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

  it("ja-JP のような地域付きタグも日本語向けセットに含める", () => {
    expect(paperPresetsForLanguage("ja-JP").map((p) => p.id)).toContain(
      "b4jis",
    );
  });

  it("ja 以外の言語タグでは国際セット（A3/A4/A5/B5(ISO)/Letter/Legal）を返す", () => {
    const ids = paperPresetsForLanguage("en-US").map((p) => p.id);
    expect(ids).toEqual(["a3", "a4", "a5", "b5iso", "letter", "legal"]);
  });

  it("Letter/Legal は規格値どおりの mm 寸法（8.5x11in / 8.5x14in）を持つ", () => {
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

  it("寸法が一致するプリセットの id を返す", () => {
    expect(paperPresetIdForSize(presets, 210, 297)).toBe("a4");
    expect(paperPresetIdForSize(presets, 182, 257)).toBe("b5jis");
  });

  it("どのプリセットとも一致しない寸法では undefined を返す", () => {
    expect(paperPresetIdForSize(presets, 210, 300)).toBeUndefined();
  });
});
