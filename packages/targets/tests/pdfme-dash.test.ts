import type {
  LoweredEllipseElement,
  LoweredLineElement,
  LoweredRectElement,
  LoweredTextElement,
} from "@denreport/core";
import { describe, expect, it } from "vitest";
import { expandStrokes } from "../src/pdfme/dash";

function lineOf(
  overrides: Partial<LoweredLineElement> = {},
): LoweredLineElement {
  return {
    type: "line",
    sourceId: "l1",
    x: 0,
    y: 0,
    orientation: "horizontal",
    length: 10,
    thickness: 0.3,
    color: "#000000",
    strokeStyle: "solid",
    rotate: 0,
    ...overrides,
  };
}

function rectOf(
  overrides: Partial<LoweredRectElement> = {},
): LoweredRectElement {
  return {
    type: "rect",
    sourceId: "r1",
    x: 0,
    y: 0,
    w: 10,
    h: 6,
    borderWidth: 0.3,
    borderColor: "#000000",
    fillColor: null,
    borderStyle: "solid",
    cornerRadius: 0,
    rotate: 0,
    ...overrides,
  };
}

const ellipseEl: LoweredEllipseElement = {
  type: "ellipse",
  sourceId: "e1",
  x: 0,
  y: 0,
  w: 10,
  h: 6,
  borderWidth: 0.3,
  borderColor: "#000000",
  fillColor: null,
  rotate: 0,
};

const textEl: LoweredTextElement = {
  type: "text",
  sourceId: "t1",
  x: 0,
  y: 0,
  w: 10,
  h: 6,
  content: "hi",
  fontSize: 10,
  align: "left",
  lineHeight: 1.25,
  color: "#000000",
  rotate: 0,
};

describe("expandStrokes — pass-through", () => {
  it("returns solid lines, solid rects, ellipse and text unchanged", () => {
    const solidLine = lineOf();
    const solidRect = rectOf();
    const elements = expandStrokes([solidLine, solidRect, ellipseEl, textEl]);
    expect(elements).toEqual([solidLine, solidRect, ellipseEl, textEl]);
  });
});

describe("expandStrokes — line dash expansion", () => {
  it("expands a horizontal dashed line into on-segments with the correct total on length", () => {
    // pattern dashed = [2, 1], length 7 → on: [0,2] [3,5] [6,7] (final on segment clipped to the line length)
    const el = lineOf({
      orientation: "horizontal",
      length: 7,
      strokeStyle: "dashed",
    });
    const segments = expandStrokes([el]) as LoweredLineElement[];
    expect(segments).toHaveLength(3);
    expect(segments).toMatchObject([
      { x: 0, y: 0, length: 2, strokeStyle: "solid" },
      { x: 3, y: 0, length: 2, strokeStyle: "solid" },
      { x: 6, y: 0, length: 1, strokeStyle: "solid" },
    ]);
    const totalOn = segments.reduce((sum, seg) => sum + seg.length, 0);
    expect(totalOn).toBe(5);
    for (const seg of segments) {
      expect(seg.color).toBe(el.color);
      expect(seg.thickness).toBe(el.thickness);
      expect(seg.sourceId).toBe(el.sourceId);
    }
  });

  it("expands a vertical line along y instead of x", () => {
    const el = lineOf({
      orientation: "vertical",
      x: 5,
      y: 10,
      length: 5,
      strokeStyle: "dashed",
    });
    const segments = expandStrokes([el]) as LoweredLineElement[];
    expect(segments.map((s) => [s.x, s.y, s.length])).toEqual([
      [5, 10, 2],
      [5, 13, 2],
    ]);
  });

  it("clips a single on-segment to a line shorter than the first pattern step", () => {
    const el = lineOf({ length: 0.3, strokeStyle: "dotted" });
    const segments = expandStrokes([el]) as LoweredLineElement[];
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      x: 0,
      length: 0.3,
      strokeStyle: "solid",
    });
  });
});

describe("expandStrokes — rotated dash expansion", () => {
  it("maps rotated dashed line segments' midpoints around the line midpoint", () => {
    // pattern dashed = [2, 1], length 7 → 非回転の on 区間: [0,2] [3,5] [6,7]、線分中点 (3.5, 0)
    const el = lineOf({
      orientation: "horizontal",
      length: 7,
      strokeStyle: "dashed",
      rotate: 90,
    });
    const segments = expandStrokes([el]) as LoweredLineElement[];
    // 90° 時計回りで中点 (cx, 0) → (3.5, cx − 3.5) へ写り、x は length/2 だけ戻す
    expect(segments.map((s) => [s.x, s.y, s.length, s.rotate])).toEqual([
      [2.5, -2.5, 2, 90],
      [2.5, 0.5, 2, 90],
      [3, 3, 1, 90],
    ]);
  });

  it("maps rotated dashed rect edges around the rect center and keeps the fill in place", () => {
    const el = rectOf({
      w: 10,
      h: 6,
      fillColor: "#eeeeee",
      borderStyle: "dashed",
      rotate: 180,
    });
    const [fill, ...edges] = expandStrokes([el]);
    expect(fill).toMatchObject({ type: "rect", x: 0, y: 0, rotate: 180 });
    const lines = edges as LoweredLineElement[];
    expect(lines.every((l) => l.rotate === 180)).toBe(true);
    // 180° 回転は中心 (5, 3) の点対称: 上辺の最初の on 区間 [0,2]（中点 (1, 0)）→ 中点 (9, 6)
    expect(lines[0]).toMatchObject({
      orientation: "horizontal",
      x: 8,
      y: 6,
      length: 2,
    });
  });
});

describe("expandStrokes — rect dash expansion", () => {
  it("splits a dashed filled rect into a borderless fill and 4 dashed edges", () => {
    const el = rectOf({
      w: 10,
      h: 6,
      borderWidth: 0.3,
      fillColor: "#eeeeee",
      borderStyle: "dashed",
    });
    const elements = expandStrokes([el]);
    const [fill, ...edges] = elements;
    expect(fill).toMatchObject({
      type: "rect",
      borderWidth: 0,
      fillColor: "#eeeeee",
      borderStyle: "solid",
    });
    expect(edges.every((e) => e.type === "line")).toBe(true);
    const lines = edges as LoweredLineElement[];
    // 4辺それぞれ独立に位相リセットされる（辺ごとに新たな dashed 展開）
    const totalOnLength = lines.reduce((sum, l) => sum + l.length, 0);
    // 各辺は独立に位相0から敷かれる: w=10 → on 2+2+2+1=7（上下）、h=6 → on 2+2=4（左右）
    expect(totalOnLength).toBe(7 + 7 + 4 + 4);
  });

  it("omits the fill rect when fillColor is absent", () => {
    const el = rectOf({ borderStyle: "dotted", fillColor: null });
    const elements = expandStrokes([el]);
    expect(elements.every((e) => e.type === "line")).toBe(true);
  });

  it("passes an unstyled (solid) rect through without expansion", () => {
    const el = rectOf({ fillColor: "#eeeeee" });
    expect(expandStrokes([el])).toEqual([el]);
  });
});
