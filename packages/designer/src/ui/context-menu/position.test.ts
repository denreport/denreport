import { describe, expect, it } from "vitest";
import { clampMenuPosition } from "./position";

const BASE = {
  menuWidth: 160,
  menuHeight: 150,
  viewportWidth: 1000,
  viewportHeight: 800,
};

describe("clampMenuPosition", () => {
  it("leaves the position unchanged when there's enough room", () => {
    expect(clampMenuPosition({ ...BASE, x: 100, y: 100 })).toEqual({
      x: 100,
      y: 100,
    });
  });

  it("clamps to the left when overflowing the right edge", () => {
    expect(clampMenuPosition({ ...BASE, x: 950, y: 100 })).toEqual({
      x: BASE.viewportWidth - BASE.menuWidth - 4,
      y: 100,
    });
  });

  it("clamps upward when overflowing the bottom edge", () => {
    expect(clampMenuPosition({ ...BASE, x: 100, y: 780 })).toEqual({
      x: 100,
      y: BASE.viewportHeight - BASE.menuHeight - 4,
    });
  });

  it("clamps both axes when overflowing both the right and bottom edges", () => {
    expect(clampMenuPosition({ ...BASE, x: 990, y: 790 })).toEqual({
      x: BASE.viewportWidth - BASE.menuWidth - 4,
      y: BASE.viewportHeight - BASE.menuHeight - 4,
    });
  });

  it("falls back to the minimum 4px when the menu is larger than the viewport", () => {
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
