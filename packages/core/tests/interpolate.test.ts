import { describe, expect, it } from "vitest";
import type { IrData } from "../src/ir/data";
import { interpolateText, textTemplateKeys } from "../src/ir/interpolate";

describe("textTemplateKeys", () => {
  it("returns a single token key", () => {
    expect(textTemplateKeys("合計: {total} 円")).toEqual(["total"]);
  });

  it("returns multiple, adjacent and repeated keys in order with duplicates", () => {
    expect(textTemplateKeys("{a}{b} {a}")).toEqual(["a", "b", "a"]);
  });

  it("ignores non-identifier braces as literal text", () => {
    expect(textTemplateKeys("{total price} {123} { } {")).toEqual([]);
  });

  it("ignores identifiers of 65 characters or more", () => {
    const key64 = "a".repeat(64);
    const key65 = "a".repeat(65);
    expect(textTemplateKeys(`{${key64}}`)).toEqual([key64]);
    expect(textTemplateKeys(`{${key65}}`)).toEqual([]);
  });

  it("treats {{key}} as a literal brace around a resolved token", () => {
    expect(textTemplateKeys("{{total}}")).toEqual(["total"]);
  });

  it("returns no keys for plain text", () => {
    expect(textTemplateKeys("合計金額")).toEqual([]);
  });
});

describe("interpolateText", () => {
  it("substitutes a single token with its data value", () => {
    const data: IrData = { total: "12,000" };
    expect(interpolateText("合計: {total} 円", data)).toBe("合計: 12,000 円");
  });

  it("substitutes multiple tokens independently", () => {
    const data: IrData = { a: "A", b: "B" };
    expect(interpolateText("{a}-{b}", data)).toBe("A-B");
  });

  it("keeps {{key}} as a literal brace wrapping the resolved value", () => {
    const data: IrData = { total: "12,000" };
    expect(interpolateText("{{total}}", data)).toBe("{12,000}");
  });

  it("replaces a missing key with an empty string", () => {
    expect(interpolateText("合計: {total} 円", {})).toBe("合計:  円");
  });

  it("replaces a non-string value with an empty string", () => {
    const data: IrData = { total: 12000 };
    expect(interpolateText("{total}", data)).toBe("");
  });

  it("does not re-expand a token-shaped string found inside a data value", () => {
    const data: IrData = { a: "{b}", b: "B" };
    expect(interpolateText("{a}", data)).toBe("{b}");
  });

  it("leaves non-token braces untouched", () => {
    expect(interpolateText("{total price} {123}", {})).toBe(
      "{total price} {123}",
    );
  });
});
