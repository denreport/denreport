import { readFileSync } from "node:fs";
import { EMBEDDED_FONT_URL } from "@denreport/targets";
import { describe, expect, it } from "vitest";
import { sanitizeFontName } from "../../state/fonts";
import { buildRegisteredFont } from "./font-registration";

// jsdom 下では import.meta.url 由来の URL が http://localhost:3000/@fs/... になる
const EMBEDDED_FONT = new Uint8Array(
  readFileSync(EMBEDDED_FONT_URL.pathname.replace(/^\/@fs/, "")),
);

// OTTO ヘッダ + CFF テーブルだけの合成フォント。形式判定はディレクトリしか読まない
function syntheticCff(): Uint8Array {
  const bytes = new Uint8Array(12 + 16);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x4f54544f); // "OTTO"
  view.setUint16(4, 1);
  view.setUint32(12, 0x43464620); // "CFF "
  return bytes;
}

// glyf テーブルのみ持ち head/hhea を持たない TTF（計量読取不能を再現する）
function ttfMissingMetrics(): Uint8Array {
  const bytes = new Uint8Array(12 + 16);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x00010000);
  view.setUint16(4, 1);
  view.setUint32(12, 0x676c7966); // 'glyf'
  return bytes;
}

describe("buildRegisteredFont", () => {
  it("同梱 TTF は ok になり ascentPerEm と sanitizeFontName の名前を持つ", () => {
    const result = buildRegisteredFont(EMBEDDED_FONT, {
      fullName: "Noto Sans JP",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("成功を期待");
    expect(result.font.name).toBe(sanitizeFontName("Noto Sans JP"));
    expect(result.font.displayName).toBe("Noto Sans JP");
    expect(result.font.ascentPerEm).toBeGreaterThan(0);
    expect(result.font.data).toBe(EMBEDDED_FONT);
  });

  it("CFF は validate.ts と同じ文言の FontIssue で拒否する", () => {
    const result = buildRegisteredFont(syntheticCff(), {
      fullName: "Test CFF",
    });
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

  it("計量を読み取れない TTF は FontIssue になる", () => {
    const result = buildRegisteredFont(ttfMissingMetrics(), {
      fullName: "Broken",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("失敗を期待");
    expect(result.issues[0]?.format).toBe("ttf");
    expect(result.issues[0]?.message).toContain("計量");
  });
});
