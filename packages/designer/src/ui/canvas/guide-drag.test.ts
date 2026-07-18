import { describe, expect, it } from "vitest";
import { isOnPage, pointerToGuidePositionMm } from "./guide-drag";

const PAGE = { width: 210, height: 297 };

describe("pointerToGuidePositionMm", () => {
  it("ズームとページ原点を織り込んで紙面 mm 位置へ変換する", () => {
    const geo = { paperLeftPx: 24, paperTopPx: 24, mmPx: 3.78 };
    expect(pointerToGuidePositionMm("x", 24 + 37.8, 0, geo)).toBeCloseTo(10, 1);
    expect(pointerToGuidePositionMm("y", 0, 24 + 75.6, geo)).toBeCloseTo(20, 1);
  });

  it("ズーム倍率が変わると同じ px 差分でも mm 差分が変わる", () => {
    const zoomed = { paperLeftPx: 0, paperTopPx: 0, mmPx: 3.78 * 2 };
    expect(pointerToGuidePositionMm("x", 75.6, 0, zoomed)).toBeCloseTo(10, 1);
  });

  it("0.1mm 単位に丸める", () => {
    const geo = { paperLeftPx: 0, paperTopPx: 0, mmPx: 3.78 };
    expect(pointerToGuidePositionMm("x", 10, 0, geo)).toBe(2.6);
  });
});

describe("isOnPage", () => {
  it("0 とページサイズはページ内、負値・超過はページ外", () => {
    expect(isOnPage("x", 0, PAGE)).toBe(true);
    expect(isOnPage("x", 210, PAGE)).toBe(true);
    expect(isOnPage("x", -0.1, PAGE)).toBe(false);
    expect(isOnPage("x", 210.1, PAGE)).toBe(false);
    expect(isOnPage("y", 0, PAGE)).toBe(true);
    expect(isOnPage("y", 297, PAGE)).toBe(true);
    expect(isOnPage("y", 297.1, PAGE)).toBe(false);
  });
});
