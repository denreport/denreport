import { describe, expect, it } from "vitest";
import { clampMenuPosition } from "./position";

const BASE = {
  menuWidth: 160,
  menuHeight: 150,
  viewportWidth: 1000,
  viewportHeight: 800,
};

describe("clampMenuPosition", () => {
  it("余裕がある位置ではそのまま", () => {
    expect(clampMenuPosition({ ...BASE, x: 100, y: 100 })).toEqual({
      x: 100,
      y: 100,
    });
  });

  it("右端をはみ出す場合は左へクランプする", () => {
    expect(clampMenuPosition({ ...BASE, x: 950, y: 100 })).toEqual({
      x: BASE.viewportWidth - BASE.menuWidth - 4,
      y: 100,
    });
  });

  it("下端をはみ出す場合は上へクランプする", () => {
    expect(clampMenuPosition({ ...BASE, x: 100, y: 780 })).toEqual({
      x: 100,
      y: BASE.viewportHeight - BASE.menuHeight - 4,
    });
  });

  it("右下両方をはみ出す場合は両軸をクランプする", () => {
    expect(clampMenuPosition({ ...BASE, x: 990, y: 790 })).toEqual({
      x: BASE.viewportWidth - BASE.menuWidth - 4,
      y: BASE.viewportHeight - BASE.menuHeight - 4,
    });
  });

  it("メニューが viewport より大きい場合は最小 4px に落ちる", () => {
    expect(
      clampMenuPosition({
        x: 10,
        y: 10,
        menuWidth: 2000,
        menuHeight: 2000,
        viewportWidth: 500,
        viewportHeight: 400,
      }),
    ).toEqual({ x: 4, y: 4 });
  });
});
