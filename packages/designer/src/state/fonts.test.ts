import type { IrDocument } from "@denreport/core";
import { validateIr } from "@denreport/core";
import { describe, expect, it } from "vitest";
import type { RegisteredFont } from "./fonts";
import { resolveFont, sanitizeFontName } from "./fonts";

function documentWithFontName(name: string): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { name },
    elements: [],
  };
}

describe("sanitizeFontName", () => {
  it("空白・記号を除去する", () => {
    expect(sanitizeFontName("Noto Sans JP")).toBe("NotoSansJP");
    expect(sanitizeFontName("Yu-Gothic UI!")).toBe("YuGothicUI");
  });

  it("先頭が数字なら _ を前置する", () => {
    expect(sanitizeFontName("07 Logo")).toBe("_07Logo");
  });

  it("非該当文字しかなければ LocalFont になる", () => {
    expect(sanitizeFontName("！＠＃")).toBe("LocalFont");
    expect(sanitizeFontName("")).toBe("LocalFont");
  });

  it("64 文字を超える名前は切り詰める", () => {
    const raw = "A".repeat(80);
    const result = sanitizeFontName(raw);
    expect(result).toHaveLength(64);
    expect(result).toBe("A".repeat(64));
  });

  it("既に識別子として妥当な名前は変えない", () => {
    expect(sanitizeFontName("NotoSansJP")).toBe("NotoSansJP");
    expect(sanitizeFontName("_already_valid")).toBe("_already_valid");
  });

  it("出力は常に font.name の識別子検証（M07）を通る", () => {
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

describe("resolveFont", () => {
  it("レジストリに一致すれば registered になり、同梱名より優先される", () => {
    const registry = new Map([["NotoSansJP", font("NotoSansJP")]]);
    expect(resolveFont("NotoSansJP", registry, "NotoSansJP")).toEqual({
      kind: "registered",
      font: font("NotoSansJP"),
    });
  });

  it("レジストリに無く同梱名と一致すれば embedded になる", () => {
    const registry = new Map<string, RegisteredFont>();
    expect(resolveFont("NotoSansJP", registry, "NotoSansJP")).toEqual({
      kind: "embedded",
    });
  });

  it("どちらでもなければ missing に name が載る", () => {
    const registry = new Map<string, RegisteredFont>();
    expect(resolveFont("IPAexGothic", registry, "NotoSansJP")).toEqual({
      kind: "missing",
      name: "IPAexGothic",
    });
  });
});
