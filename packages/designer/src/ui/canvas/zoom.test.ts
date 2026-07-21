import { describe, expect, it } from "vitest";
import {
  CANVAS_PADDING_PX,
  MM_TO_PX,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEPS,
} from "../../state/constants";
import {
  anchoredScroll,
  fitPageZoom,
  nextWheelZoom,
  zoomStepIn,
  zoomStepOut,
} from "./zoom";

describe("fitPageZoom", () => {
  it("picks the width ratio when the width constraint is stricter", () => {
    const viewportWidth = 500;
    const viewportHeight = 2000;
    const zoom = fitPageZoom({
      viewportWidth,
      viewportHeight,
      rulerWidth: 0,
      rulerHeight: 0,
      pageWidthMm: 210,
      pageHeightMm: 100,
    });
    const widthRatio =
      (viewportWidth - 2 * CANVAS_PADDING_PX) / (210 * MM_TO_PX);
    const heightRatio =
      (viewportHeight - 2 * CANVAS_PADDING_PX) / (100 * MM_TO_PX);
    expect(widthRatio).toBeLessThan(heightRatio);
    expect(zoom).toBeCloseTo(widthRatio, 10);
  });

  it("picks the height ratio when the height constraint is stricter", () => {
    const viewportWidth = 2000;
    const viewportHeight = 500;
    const zoom = fitPageZoom({
      viewportWidth,
      viewportHeight,
      rulerWidth: 0,
      rulerHeight: 0,
      pageWidthMm: 100,
      pageHeightMm: 297,
    });
    const widthRatio =
      (viewportWidth - 2 * CANVAS_PADDING_PX) / (100 * MM_TO_PX);
    const heightRatio =
      (viewportHeight - 2 * CANVAS_PADDING_PX) / (297 * MM_TO_PX);
    expect(heightRatio).toBeLessThan(widthRatio);
    expect(zoom).toBeCloseTo(heightRatio, 10);
  });

  it("clamps to ZOOM_MAX for an extremely large viewport", () => {
    const zoom = fitPageZoom({
      viewportWidth: 100_000,
      viewportHeight: 100_000,
      rulerWidth: 0,
      rulerHeight: 0,
      pageWidthMm: 210,
      pageHeightMm: 297,
    });
    expect(zoom).toBe(ZOOM_MAX);
  });

  it("clamps to ZOOM_MIN for an extremely small viewport", () => {
    const zoom = fitPageZoom({
      viewportWidth: 50,
      viewportHeight: 50,
      rulerWidth: 0,
      rulerHeight: 0,
      pageWidthMm: 210,
      pageHeightMm: 297,
    });
    expect(zoom).toBe(ZOOM_MIN);
  });

  it("returns null when the available width is 0 or less", () => {
    const zoom = fitPageZoom({
      viewportWidth: 20,
      viewportHeight: 2000,
      rulerWidth: 30,
      rulerHeight: 0,
      pageWidthMm: 210,
      pageHeightMm: 297,
    });
    expect(zoom).toBeNull();
  });

  it("returns null when the available height is 0 or less", () => {
    const zoom = fitPageZoom({
      viewportWidth: 2000,
      viewportHeight: 20,
      rulerWidth: 0,
      rulerHeight: 30,
      pageWidthMm: 210,
      pageHeightMm: 297,
    });
    expect(zoom).toBeNull();
  });

  it("fits an A4 portrait page within a representative viewport", () => {
    const viewportWidth = 1200;
    const viewportHeight = 800;
    const rulerWidth = 24;
    const rulerHeight = 24;
    const zoom = fitPageZoom({
      viewportWidth,
      viewportHeight,
      rulerWidth,
      rulerHeight,
      pageWidthMm: 210,
      pageHeightMm: 297,
    });
    expect(zoom).not.toBeNull();
    const availH = viewportHeight - rulerHeight - 2 * CANVAS_PADDING_PX;
    expect((zoom ?? 0) * 297 * MM_TO_PX).toBeLessThanOrEqual(availH);
  });
});

describe("nextWheelZoom", () => {
  it("zooms out when deltaY > 0", () => {
    expect(nextWheelZoom(1, 100, 0)).toBeLessThan(1);
  });

  it("zooms in when deltaY < 0", () => {
    expect(nextWheelZoom(1, -100, 0)).toBeGreaterThan(1);
  });

  it("stays unchanged when zooming in further after reaching ZOOM_MAX", () => {
    expect(nextWheelZoom(ZOOM_MAX, -100, 0)).toBe(ZOOM_MAX);
  });

  it("stays unchanged when zooming out further after reaching ZOOM_MIN", () => {
    expect(nextWheelZoom(ZOOM_MIN, 100, 0)).toBe(ZOOM_MIN);
  });

  it("deltaMode = 1 (line) has a larger effect than pixel conversion", () => {
    const pixel = nextWheelZoom(1, 100, 0);
    const line = nextWheelZoom(1, 100, 1);
    expect(Math.abs(1 - line)).toBeGreaterThan(Math.abs(1 - pixel));
  });

  it("is identity when deltaY = 0", () => {
    expect(nextWheelZoom(1, 0, 0)).toBe(1);
  });
});

describe("zoomStepIn / zoomStepOut", () => {
  it("returns the adjacent step from a value between steps", () => {
    expect(zoomStepIn(1.13)).toBe(1.25);
    expect(zoomStepOut(1.13)).toBe(1);
  });

  it("transitions to the neighboring step from a value exactly on a step", () => {
    expect(zoomStepIn(1)).toBe(1.25);
    expect(zoomStepOut(1)).toBe(0.75);
  });

  it("zoomStepIn is null at the upper bound", () => {
    expect(zoomStepIn(ZOOM_STEPS[ZOOM_STEPS.length - 1] ?? 0)).toBeNull();
  });

  it("zoomStepOut is null at the lower bound", () => {
    expect(zoomStepOut(ZOOM_STEPS[0] ?? 0)).toBeNull();
  });
});

describe("anchoredScroll", () => {
  const base = {
    prevZoom: 1,
    nextZoom: 2,
    anchorX: 300,
    anchorY: 200,
    paperLeft: 50,
    paperTop: 40,
    scrollLeft: 100,
    scrollTop: 80,
  };

  it("preserves the paper mm coordinate directly under the anchor", () => {
    const cases = [
      base,
      { ...base, nextZoom: 0.5 },
      { ...base, anchorX: 0, anchorY: 0 },
      { ...base, prevZoom: 2, nextZoom: 0.75, scrollLeft: 400, scrollTop: 10 },
    ];
    for (const c of cases) {
      const result = anchoredScroll(c);
      const before = (c.scrollLeft + c.anchorX - c.paperLeft) / c.prevZoom;
      const afterX = (result.left + c.anchorX - c.paperLeft) / c.nextZoom;
      const beforeY = (c.scrollTop + c.anchorY - c.paperTop) / c.prevZoom;
      const afterY = (result.top + c.anchorY - c.paperTop) / c.nextZoom;
      expect(afterX).toBeCloseTo(before, 10);
      expect(afterY).toBeCloseTo(beforeY, 10);
    }
  });

  it("is identity when prevZoom === nextZoom", () => {
    const result = anchoredScroll({ ...base, nextZoom: base.prevZoom });
    expect(result.left).toBeCloseTo(base.scrollLeft, 10);
    expect(result.top).toBeCloseTo(base.scrollTop, 10);
  });

  it("matches the existing center-preserving calculation when the anchor is the center", () => {
    const viewportWidth = 600;
    const viewportHeight = 400;
    const input = {
      prevZoom: 1,
      nextZoom: 1.5,
      anchorX: viewportWidth / 2,
      anchorY: viewportHeight / 2,
      paperLeft: 20,
      paperTop: 30,
      scrollLeft: 10,
      scrollTop: 5,
    };
    const result = anchoredScroll(input);

    const centerX =
      (input.scrollLeft + viewportWidth / 2 - input.paperLeft) /
      (MM_TO_PX * input.prevZoom);
    const centerY =
      (input.scrollTop + viewportHeight / 2 - input.paperTop) /
      (MM_TO_PX * input.prevZoom);
    const expectedLeft =
      centerX * MM_TO_PX * input.nextZoom + input.paperLeft - viewportWidth / 2;
    const expectedTop =
      centerY * MM_TO_PX * input.nextZoom + input.paperTop - viewportHeight / 2;

    expect(result.left).toBeCloseTo(expectedLeft, 10);
    expect(result.top).toBeCloseTo(expectedTop, 10);
  });
});
