import { describe, expect, it } from "vitest";
import { resolveFontSetData } from "../src/fonts/set";
import {
  buildSfnt,
  buildUniformWidthTtf,
  syntheticCff,
  syntheticTtf,
} from "./helpers/sfnt";

describe("resolveFontSetData", () => {
  it("resolves metrics for every provided slot", () => {
    const result = resolveFontSetData({
      regular: buildUniformWidthTtf(1, 1),
      bold: buildUniformWidthTtf(2, 1),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect([...result.slots.keys()].sort()).toEqual(["bold", "regular"]);
    expect(result.slots.get("regular")?.charWidthEm(0x41)).toBe(1);
    expect(result.slots.get("bold")?.charWidthEm(0x41)).toBe(2);
    expect(result.slots.get("regular")?.ascentPerEm).toBe(800);
  });

  it("has no entries for slots absent from the input", () => {
    const result = resolveFontSetData({ regular: syntheticTtf() });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect([...result.slots.keys()]).toEqual(["regular"]);
  });

  it("tags a non-TTF slot's issue with the slot it occurred in", () => {
    const result = resolveFontSetData({
      regular: syntheticTtf(),
      italic: syntheticCff(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.slot).toBe("italic");
    expect(result.issues[0]?.format).toBe("cff");
  });

  it("tags an unreadable-metrics slot and reports every broken slot at once", () => {
    const noMetrics = buildSfnt(0x00010000, ["glyf", "head", "loca"]);
    const result = resolveFontSetData({
      regular: noMetrics,
      bold: syntheticCff(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.issues.map((issue) => issue.slot).sort()).toEqual([
      "bold",
      "regular",
    ]);
    const regularIssue = result.issues.find((i) => i.slot === "regular");
    expect(regularIssue?.message).toContain("計量");
  });
});

describe("resolveFontSetData — locale", () => {
  it('returns English messages for locale "en"', () => {
    const noMetrics = buildSfnt(0x00010000, ["glyf", "head", "loca"]);
    const result = resolveFontSetData({ regular: noMetrics }, { locale: "en" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.issues[0]?.message).toContain("metrics");
  });
});
