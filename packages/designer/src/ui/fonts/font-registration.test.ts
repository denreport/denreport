import { readFileSync } from "node:fs";
import { EMBEDDED_FONT_URL } from "@denreport/targets";
import { describe, expect, it } from "vitest";
import { ja } from "../../i18n/messages/ja";
import { sanitizeFontName } from "../../state/fonts";
import { buildRegisteredFont } from "./font-registration";

// Under jsdom, the URL derived from import.meta.url becomes http://localhost:3000/@fs/...
const EMBEDDED_FONT = new Uint8Array(
  readFileSync(EMBEDDED_FONT_URL.pathname.replace(/^\/@fs/, "")),
);

// A synthetic font with only an OTTO header + CFF table. Format detection only reads the directory
function syntheticCff(): Uint8Array {
  const bytes = new Uint8Array(12 + 16);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x4f54544f); // "OTTO"
  view.setUint16(4, 1);
  view.setUint32(12, 0x43464620); // "CFF "
  return bytes;
}

// A TTF that has only a glyf table and no head/hhea (reproduces unreadable metrics)
function ttfMissingMetrics(): Uint8Array {
  const bytes = new Uint8Array(12 + 16);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x00010000);
  view.setUint16(4, 1);
  view.setUint32(12, 0x676c7966); // 'glyf'
  return bytes;
}

describe("buildRegisteredFont", () => {
  it("the bundled TTF is ok and has ascentPerEm and the sanitizeFontName name", () => {
    const result = buildRegisteredFont(
      EMBEDDED_FONT,
      { fullName: "Noto Sans JP" },
      ja.fonts,
      "ja",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("成功を期待");
    expect(result.font.name).toBe(sanitizeFontName("Noto Sans JP"));
    expect(result.font.displayName).toBe("Noto Sans JP");
    expect(result.font.ascentPerEm).toBeGreaterThan(0);
    expect(result.font.data).toBe(EMBEDDED_FONT);
  });

  it("rejects CFF with the same FontIssue wording as validate.ts", () => {
    const result = buildRegisteredFont(
      syntheticCff(),
      { fullName: "Test CFF" },
      ja.fonts,
      "ja",
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("失敗を期待");
    expect(result.issues).toEqual([
      {
        format: "cff",
        message:
          "CFF（OTF）アウトラインのフォントは書き出しに使用できません。TrueType アウトラインの TTF フォントを使用してください。",
      },
    ]);
  });

  it("a TTF whose metrics can't be read becomes a FontIssue", () => {
    const result = buildRegisteredFont(
      ttfMissingMetrics(),
      { fullName: "Broken" },
      ja.fonts,
      "ja",
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("失敗を期待");
    expect(result.issues[0]?.format).toBe("ttf");
    expect(result.issues[0]?.message).toContain("計量");
  });
});
