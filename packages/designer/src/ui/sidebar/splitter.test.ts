import { describe, expect, it } from "vitest";
import {
  clampPaletteHeight,
  MIN_LAYERS_HEIGHT,
  MIN_PALETTE_HEIGHT,
} from "./splitter";

describe("clampPaletteHeight", () => {
  it("通常域では希望値をそのまま返す", () => {
    expect(clampPaletteHeight(200, 600)).toBe(200);
  });

  it("下限（MIN_PALETTE_HEIGHT）未満の希望値は下限に切り上げる", () => {
    expect(clampPaletteHeight(10, 600)).toBe(MIN_PALETTE_HEIGHT);
  });

  it("上限（sidebarHeight - 5 - MIN_LAYERS_HEIGHT）超の希望値は上限に切り下げる", () => {
    const sidebarHeight = 600;
    const max = sidebarHeight - 5 - MIN_LAYERS_HEIGHT;
    expect(clampPaletteHeight(max + 100, sidebarHeight)).toBe(max);
  });

  it("サイドバーが極端に低く両最小値を満たせない場合は MIN_PALETTE_HEIGHT に縮退する", () => {
    const sidebarHeight = 100;
    expect(clampPaletteHeight(80, sidebarHeight)).toBe(MIN_PALETTE_HEIGHT);
    expect(clampPaletteHeight(10, sidebarHeight)).toBe(MIN_PALETTE_HEIGHT);
  });
});
