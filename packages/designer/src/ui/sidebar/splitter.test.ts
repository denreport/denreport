import { describe, expect, it } from "vitest";
import {
  clampPaletteHeight,
  MIN_LAYERS_HEIGHT,
  MIN_PALETTE_HEIGHT,
} from "./splitter";

describe("clampPaletteHeight", () => {
  it("returns the requested value as-is within the normal range", () => {
    expect(clampPaletteHeight(200, 600)).toBe(200);
  });

  it("clamps up to the lower bound (MIN_PALETTE_HEIGHT) when the requested value is below it", () => {
    expect(clampPaletteHeight(10, 600)).toBe(MIN_PALETTE_HEIGHT);
  });

  it("clamps down to the upper bound (sidebarHeight - 5 - MIN_LAYERS_HEIGHT) when the requested value exceeds it", () => {
    const sidebarHeight = 600;
    const max = sidebarHeight - 5 - MIN_LAYERS_HEIGHT;
    expect(clampPaletteHeight(max + 100, sidebarHeight)).toBe(max);
  });

  it("falls back to MIN_PALETTE_HEIGHT when the sidebar is too short to satisfy both minimums", () => {
    const sidebarHeight = 100;
    expect(clampPaletteHeight(80, sidebarHeight)).toBe(MIN_PALETTE_HEIGHT);
    expect(clampPaletteHeight(10, sidebarHeight)).toBe(MIN_PALETTE_HEIGHT);
  });
});
