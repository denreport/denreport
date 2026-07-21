import type { IrDocument } from "@denreport/core";
import { validateIr } from "@denreport/core";
import { describe, expect, it } from "vitest";
import type { RegisteredFont } from "./fonts";
import { resolveFont, resolveFontSet, sanitizeFontName } from "./fonts";

function documentWithFontName(name: string): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: name },
    elements: [],
  };
}

describe("sanitizeFontName", () => {
  it("removes whitespace and symbols", () => {
    expect(sanitizeFontName("Noto Sans JP")).toBe("NotoSansJP");
    expect(sanitizeFontName("Yu-Gothic UI!")).toBe("YuGothicUI");
  });

  it("prefixes _ when the name starts with a digit", () => {
    expect(sanitizeFontName("07 Logo")).toBe("_07Logo");
  });

  it("falls back to LocalFont when no valid characters remain", () => {
    expect(sanitizeFontName("！＠＃")).toBe("LocalFont");
    expect(sanitizeFontName("")).toBe("LocalFont");
  });

  it("truncates names longer than 64 characters", () => {
    const raw = "A".repeat(80);
    const result = sanitizeFontName(raw);
    expect(result).toHaveLength(64);
    expect(result).toBe("A".repeat(64));
  });

  it("leaves names that are already valid identifiers unchanged", () => {
    expect(sanitizeFontName("NotoSansJP")).toBe("NotoSansJP");
    expect(sanitizeFontName("_already_valid")).toBe("_already_valid");
  });

  it("output always passes the font.name identifier validation (M07)", () => {
    for (const raw of [
      "IPAex ゴシック",
      "123",
      "",
      "   ",
      "-_-",
      "Ａ１２３漢字",
    ]) {
      const errors = validateIr(documentWithFontName(sanitizeFontName(raw)));
      expect(errors.some((e) => e.rule === "M07")).toBe(false);
    }
  });
});

function font(name: string): RegisteredFont {
  return { name, displayName: name, data: new Uint8Array(), ascentPerEm: 1 };
}

const EMBEDDED = new Set(["NotoSansJP", "NotoSansJPBold"]);

describe("resolveFont", () => {
  it("resolves to registered when it matches the registry, taking priority over bundled names", () => {
    const registry = new Map([["NotoSansJP", font("NotoSansJP")]]);
    expect(resolveFont("NotoSansJP", registry, EMBEDDED)).toEqual({
      kind: "registered",
      font: font("NotoSansJP"),
    });
  });

  it("resolves to embedded with the name when absent from the registry but matching a bundled name", () => {
    const registry = new Map<string, RegisteredFont>();
    expect(resolveFont("NotoSansJPBold", registry, EMBEDDED)).toEqual({
      kind: "embedded",
      name: "NotoSansJPBold",
    });
  });

  it("resolves to missing with the name when neither matches", () => {
    const registry = new Map<string, RegisteredFont>();
    expect(resolveFont("IPAexGothic", registry, EMBEDDED)).toEqual({
      kind: "missing",
      name: "IPAexGothic",
    });
  });
});

describe("resolveFontSet", () => {
  it("resolves only declared slots, allowing registered, embedded, and missing to mix", () => {
    const registry = new Map([["MyItalic", font("MyItalic")]]);
    const resolutions = resolveFontSet(
      {
        regular: "NotoSansJP",
        bold: "MissingBold",
        italic: "MyItalic",
      },
      registry,
      EMBEDDED,
    );
    expect([...resolutions.keys()]).toEqual(["regular", "bold", "italic"]);
    expect(resolutions.get("regular")).toEqual({
      kind: "embedded",
      name: "NotoSansJP",
    });
    expect(resolutions.get("bold")).toEqual({
      kind: "missing",
      name: "MissingBold",
    });
    expect(resolutions.get("italic")).toEqual({
      kind: "registered",
      font: font("MyItalic"),
    });
    expect(resolutions.has("boldItalic")).toBe(false);
  });
});
