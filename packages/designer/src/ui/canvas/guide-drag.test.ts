import { describe, expect, it } from "vitest";
import { isOnPage, pointerToGuidePositionMm } from "./guide-drag";

const PAGE = { width: 210, height: 297 };

describe("pointerToGuidePositionMm", () => {
  it("converts to a paper mm position accounting for zoom and page origin", () => {
    const geo = { paperLeftPx: 24, paperTopPx: 24, mmPx: 3.78 };
    expect(pointerToGuidePositionMm("x", 24 + 37.8, 0, geo)).toBeCloseTo(10, 1);
    expect(pointerToGuidePositionMm("y", 0, 24 + 75.6, geo)).toBeCloseTo(20, 1);
  });

  it("the mm difference changes for the same px difference when zoom changes", () => {
    const zoomed = { paperLeftPx: 0, paperTopPx: 0, mmPx: 3.78 * 2 };
    expect(pointerToGuidePositionMm("x", 75.6, 0, zoomed)).toBeCloseTo(10, 1);
  });

  it("rounds to 0.1mm units", () => {
    const geo = { paperLeftPx: 0, paperTopPx: 0, mmPx: 3.78 };
    expect(pointerToGuidePositionMm("x", 10, 0, geo)).toBe(2.6);
  });
});

describe("isOnPage", () => {
  it("0 and the page size are on-page; negative values and overflow are off-page", () => {
    expect(isOnPage("x", 0, PAGE)).toBe(true);
    expect(isOnPage("x", 210, PAGE)).toBe(true);
    expect(isOnPage("x", -0.1, PAGE)).toBe(false);
    expect(isOnPage("x", 210.1, PAGE)).toBe(false);
    expect(isOnPage("y", 0, PAGE)).toBe(true);
    expect(isOnPage("y", 297, PAGE)).toBe(true);
    expect(isOnPage("y", 297.1, PAGE)).toBe(false);
  });
});
