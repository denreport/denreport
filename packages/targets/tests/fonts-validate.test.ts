import { describe, expect, it } from "vitest";
import { validateFont } from "../src/fonts/validate";
import { buildSfnt, syntheticTtf } from "./helpers/sfnt";

describe("validateFont", () => {
  it("accepts a glyf-outline TTF with an empty issue list", () => {
    expect(validateFont(syntheticTtf())).toEqual([]);
  });

  it.each([
    ["cff", buildSfnt("OTTO", ["CFF "])],
    ["collection", buildSfnt("ttcf", [])],
    ["woff", buildSfnt("wOFF", [])],
    ["woff2", buildSfnt("wOF2", [])],
    ["unknown", new Uint8Array(4)],
  ] as const)("rejects %s with a single FontIssue", (format, data) => {
    const issues = validateFont(data);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.format).toBe(format);
    expect(issues[0]?.message).toContain("TTF");
  });
});

describe("validateFont — locale", () => {
  it("defaults to Japanese when locale is omitted", () => {
    const issues = validateFont(buildSfnt("OTTO", ["CFF "]));
    expect(issues[0]?.message).toContain("TTF");
  });

  it('returns English messages for locale "en"', () => {
    const issues = validateFont(buildSfnt("OTTO", ["CFF "]), {
      locale: "en",
    });
    expect(issues[0]?.message).toBe(
      "CFF (OTF) outline fonts cannot be used for export. Use a TrueType-outline TTF font instead.",
    );
  });
});
