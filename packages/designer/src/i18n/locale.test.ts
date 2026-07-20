import { describe, expect, it } from "vitest";
import type { DesignerLocale, Locale } from "./locale";
import { resolveLocale } from "./locale";

const cases: readonly [DesignerLocale, readonly string[], Locale][] = [
  ["ja", [], "ja"],
  ["en", [], "en"],
  ["en", ["ja-JP"], "en"],
  ["auto", ["ja-JP", "en-US"], "ja"],
  ["auto", ["ja"], "ja"],
  ["auto", ["JA-JP"], "ja"],
  ["auto", ["en-US", "ja-JP"], "ja"],
  ["auto", ["en-US"], "en"],
  ["auto", [], "en"],
  ["auto", ["fr-FR", "de-DE"], "en"],
];

describe("resolveLocale", () => {
  it.each(cases)("pref=%s languages=%j -> %s", (pref, languages, expected) => {
    expect(resolveLocale(pref, languages)).toBe(expected);
  });
});
