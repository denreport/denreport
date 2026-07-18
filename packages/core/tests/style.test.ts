import { describe, expect, it } from "vitest";
import {
  resolveEllipseStyle,
  resolveLineStyle,
  resolveRectStyle,
  STROKE_DASH_MM,
} from "../src/ir/style";

describe("resolveLineStyle", () => {
  it("defaults to black solid when color and strokeStyle are absent", () => {
    expect(resolveLineStyle({})).toEqual({
      color: "#000000",
      strokeStyle: "solid",
    });
  });

  it("passes explicit values through unchanged", () => {
    expect(
      resolveLineStyle({ color: "#ff00aa", strokeStyle: "dashed" }),
    ).toEqual({ color: "#ff00aa", strokeStyle: "dashed" });
  });
});

describe("resolveRectStyle", () => {
  it("defaults to a black solid border with no fill and no corner radius", () => {
    expect(resolveRectStyle({})).toEqual({
      borderColor: "#000000",
      fillColor: null,
      borderStyle: "solid",
      cornerRadius: 0,
    });
  });

  it("passes explicit values through unchanged", () => {
    expect(
      resolveRectStyle({
        borderColor: "#111111",
        fillColor: "#eeeeee",
        borderStyle: "dotted",
        cornerRadius: 3,
      }),
    ).toEqual({
      borderColor: "#111111",
      fillColor: "#eeeeee",
      borderStyle: "dotted",
      cornerRadius: 3,
    });
  });
});

describe("resolveEllipseStyle", () => {
  it("defaults to a black solid border with no fill", () => {
    expect(resolveEllipseStyle({})).toEqual({
      borderColor: "#000000",
      fillColor: null,
      borderStyle: "solid",
      cornerRadius: 0,
    });
  });

  it("passes explicit colors through but pins borderStyle to solid and cornerRadius to 0", () => {
    expect(
      resolveEllipseStyle({ borderColor: "#222222", fillColor: "#dddddd" }),
    ).toEqual({
      borderColor: "#222222",
      fillColor: "#dddddd",
      borderStyle: "solid",
      cornerRadius: 0,
    });
  });
});

describe("STROKE_DASH_MM", () => {
  it("defines a pattern for every non-solid stroke style", () => {
    expect(Object.keys(STROKE_DASH_MM).sort()).toEqual(
      ["dashdot", "dashdotdot", "dashed", "dotted"].sort(),
    );
    for (const pattern of Object.values(STROKE_DASH_MM)) {
      expect(pattern.length).toBeGreaterThan(0);
      for (const segment of pattern) {
        expect(segment).toBeGreaterThan(0);
      }
    }
  });
});
