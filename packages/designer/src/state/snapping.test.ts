import { describe, expect, it } from "vitest";
import type { MmBox } from "./geometry";
import type { SnapContext } from "./snapping";
import { gridArrowTarget, snapForMove, snapForResize } from "./snapping";

function ctx(overrides: Partial<SnapContext> = {}): SnapContext {
  return {
    page: { width: 210, height: 297 },
    otherBoxes: [],
    toleranceMm: 2,
    gridEnabled: true,
    guideLines: [],
    ...overrides,
  };
}

function box(x: number, y: number, w: number, h: number): MmBox {
  return { x, y, w, h };
}

describe("snapForMove", () => {
  it("snaps to the nearest candidate independently per axis", () => {
    // x snaps to another element's left edge 30 (distance 1); y snaps to grid 20 (distance 0.5)
    const result = snapForMove(box(29, 20.5, 10, 10), {
      ...ctx(),
      otherBoxes: [box(30, 100, 20, 10)],
    });
    expect(result.box.x).toBeCloseTo(30, 10);
    expect(result.box.y).toBeCloseTo(20, 10);
    expect(result.guides).toEqual([{ axis: "x", positionMm: 30 }]);
  });

  it("snaps exactly at the tolerance distance and not beyond it", () => {
    const within = snapForMove(
      box(28, 100.3, 10, 10),
      ctx({ otherBoxes: [box(30, 200, 10, 10)], gridEnabled: false }),
    );
    expect(within.box.x).toBeCloseTo(30, 10);

    const beyond = snapForMove(
      box(27.9, 100.3, 10, 10),
      ctx({ otherBoxes: [box(30, 200, 10, 10)], gridEnabled: false }),
    );
    expect(beyond.box.x).toBeCloseTo(27.9, 10);
    expect(beyond.guides).toEqual([]);
  });

  it("prefers an element edge over the grid at equal distance, and returns a guide", () => {
    // Candidate: another element's left edge 30 (same position and distance as grid line 30)
    const result = snapForMove(
      box(29, 150.3, 10, 10),
      ctx({ otherBoxes: [box(30, 200, 10, 10)] }),
    );
    expect(result.box.x).toBeCloseTo(30, 10);
    expect(result.guides).toContainEqual({ axis: "x", positionMm: 30 });
  });

  it("grid snapping does not return a guide", () => {
    const result = snapForMove(box(24.4, 150.3, 10, 10), ctx());
    expect(result.box.x).toBeCloseTo(25, 10);
    expect(result.guides.filter((g) => g.axis === "x")).toEqual([]);
  });

  it("does not snap to the grid when gridEnabled=false", () => {
    const result = snapForMove(
      box(24.4, 152.3, 10, 10),
      ctx({ gridEnabled: false }),
    );
    expect(result.box.x).toBeCloseTo(24.4, 10);
    expect(result.box.y).toBeCloseTo(152.3, 10);
  });

  it("snaps to the paper edges (0 and page.width/height) and returns a guide", () => {
    const result = snapForMove(
      box(-0.8, 296.5, 10, 0),
      ctx({ gridEnabled: false }),
    );
    expect(result.box.x).toBeCloseTo(0, 10);
    expect(result.box.y).toBeCloseTo(297, 10);
    expect(result.guides).toContainEqual({ axis: "x", positionMm: 0 });
    expect(result.guides).toContainEqual({ axis: "y", positionMm: 297 });
  });

  it("the center is also a snap point", () => {
    // The moving box's center x=50.6 snaps to another element's center 50 (distance 0.6)
    const result = snapForMove(
      box(45.6, 100.3, 10, 10),
      ctx({ otherBoxes: [box(40, 200, 20, 10)], gridEnabled: false }),
    );
    expect(result.box.x).toBeCloseTo(45, 10);
  });

  it("snaps to the page center lines (page.width/2, page.height/2) and returns a guide", () => {
    const xResult = snapForMove(
      box(99.4, 100, 10, 10),
      ctx({ gridEnabled: false }),
    );
    expect(xResult.box.x).toBeCloseTo(100, 10);
    expect(xResult.guides).toContainEqual({ axis: "x", positionMm: 105 });

    const yResult = snapForMove(
      box(50, 142.9, 10, 10),
      ctx({ gridEnabled: false }),
    );
    expect(yResult.box.y).toBeCloseTo(143.5, 10);
    expect(yResult.guides).toContainEqual({ axis: "y", positionMm: 148.5 });
  });

  it("prefers snapping to the page center line over the grid even when the grid is enabled, and shows a guide", () => {
    // A4's x=105 is at the same position as a 5mm grid line, but paper takes priority over the grid
    const result = snapForMove(
      box(99.4, 100, 10, 10),
      ctx({ gridEnabled: true }),
    );
    expect(result.box.x).toBeCloseTo(100, 10);
    expect(result.guides).toContainEqual({ axis: "x", positionMm: 105 });
  });

  it("does not snap to the page center line outside the tolerance distance", () => {
    const result = snapForMove(
      box(108, 100, 10, 10),
      ctx({ gridEnabled: false }),
    );
    expect(result.box.x).toBeCloseTo(108, 10);
    expect(result.guides).toEqual([]);
  });
});

describe("snapForMove custom guides", () => {
  it("returns a SnapAdjustment with a guide when snapping near guideLines", () => {
    const result = snapForMove(
      box(49, 100, 10, 10),
      ctx({
        gridEnabled: false,
        guideLines: [{ axis: "x", positionMm: 50 }],
      }),
    );
    expect(result.box.x).toBeCloseTo(50, 10);
    expect(result.guides).toEqual([{ axis: "x", positionMm: 50 }]);
  });

  it("prefers a custom guide over an element edge at equal distance", () => {
    const result = snapForMove(
      box(29, 150.3, 10, 10),
      ctx({
        otherBoxes: [box(30, 200, 10, 10)],
        guideLines: [{ axis: "x", positionMm: 30 }],
      }),
    );
    expect(result.box.x).toBeCloseTo(30, 10);
    // The coordinate is the same as the element-edge-derived guide, but the guideLines candidate is adopted as the value
    expect(result.guides).toEqual([{ axis: "x", positionMm: 30 }]);
  });

  it("produces the same result as before when guideLines is empty", () => {
    const withoutGuides = snapForMove(
      box(29, 20.5, 10, 10),
      ctx({ otherBoxes: [box(30, 100, 20, 10)] }),
    );
    const explicitEmpty = snapForMove(
      box(29, 20.5, 10, 10),
      ctx({ otherBoxes: [box(30, 100, 20, 10)], guideLines: [] }),
    );
    expect(withoutGuides).toEqual(explicitEmpty);
  });
});

describe("snapForResize", () => {
  it("only the moving edge snaps, and the opposite edge stays fixed", () => {
    const result = snapForResize(
      box(10, 10, 19.4, 20),
      { right: true },
      ctx({ otherBoxes: [box(30, 100, 10, 10)], gridEnabled: false }),
    );
    // Right edge 29.4 -> 30. x is unchanged, w extends
    expect(result.box.x).toBe(10);
    expect(result.box.w).toBeCloseTo(20, 10);
    expect(result.guides).toEqual([{ axis: "x", positionMm: 30 }]);
  });

  it("snapping the left edge changes x and w together", () => {
    const result = snapForResize(
      box(10.6, 10, 20, 20),
      { left: true },
      ctx({ gridEnabled: true }),
    );
    expect(result.box.x).toBeCloseTo(10, 10);
    expect(result.box.w).toBeCloseTo(20.6, 10);
  });

  it("an axis that isn't moving does not snap", () => {
    const result = snapForResize(
      box(10.6, 10.6, 20, 20),
      { bottom: true },
      ctx(),
    );
    expect(result.box.x).toBeCloseTo(10.6, 10);
    expect(result.box.y).toBeCloseTo(10.6, 10);
  });

  it("the moving edge snaps to the page center line", () => {
    const result = snapForResize(
      box(10, 10, 94.4, 20),
      { right: true },
      ctx({ gridEnabled: false }),
    );
    expect(result.box.w).toBeCloseTo(95, 10);
    expect(result.guides).toEqual([{ axis: "x", positionMm: 105 }]);
  });
});

describe("gridArrowTarget", () => {
  it("returns the next 5mm grid line in the direction of movement", () => {
    expect(gridArrowTarget(7.3, 1)).toBe(10);
    expect(gridArrowTarget(7.3, -1)).toBe(5);
  });

  it("advances a full step when starting exactly on a grid line", () => {
    expect(gridArrowTarget(5, 1)).toBe(10);
    expect(gridArrowTarget(5, -1)).toBe(0);
    expect(gridArrowTarget(0, -1)).toBe(-5);
  });
});
