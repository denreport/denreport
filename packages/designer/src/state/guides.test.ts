import { describe, expect, it } from "vitest";
import {
  addGuide,
  type CustomGuide,
  guidesInPage,
  moveGuide,
  removeGuide,
} from "./guides";

describe("addGuide", () => {
  it("assigns the smallest available guide<n> as the id", () => {
    const first = addGuide([], "x", 10);
    expect(first.id).toBe("guide1");
    expect(first.guides).toEqual([{ id: "guide1", axis: "x", positionMm: 10 }]);

    const second = addGuide(first.guides, "y", 20);
    expect(second.id).toBe("guide2");
    expect(second.guides).toHaveLength(2);
  });

  it("takes the smallest gap when an existing id is missing", () => {
    const guides: readonly CustomGuide[] = [
      { id: "guide1", axis: "x", positionMm: 10 },
      { id: "guide3", axis: "x", positionMm: 30 },
    ];
    const result = addGuide(guides, "x", 20);
    expect(result.id).toBe("guide2");
  });
});

describe("moveGuide", () => {
  it("updates only the positionMm of the specified id, leaving the rest unchanged", () => {
    const guides: readonly CustomGuide[] = [
      { id: "guide1", axis: "x", positionMm: 10 },
      { id: "guide2", axis: "y", positionMm: 20 },
    ];
    const result = moveGuide(guides, "guide1", 15);
    expect(result).toEqual([
      { id: "guide1", axis: "x", positionMm: 15 },
      { id: "guide2", axis: "y", positionMm: 20 },
    ]);
    expect(result).not.toBe(guides);
  });

  it("passes the array through unchanged when given a nonexistent id", () => {
    const guides: readonly CustomGuide[] = [
      { id: "guide1", axis: "x", positionMm: 10 },
    ];
    expect(moveGuide(guides, "guide9", 99)).toEqual(guides);
  });
});

describe("removeGuide", () => {
  it("removes the specified id", () => {
    const guides: readonly CustomGuide[] = [
      { id: "guide1", axis: "x", positionMm: 10 },
      { id: "guide2", axis: "y", positionMm: 20 },
    ];
    expect(removeGuide(guides, "guide1")).toEqual([
      { id: "guide2", axis: "y", positionMm: 20 },
    ]);
  });
});

describe("guidesInPage", () => {
  const page = { width: 210, height: 297 };

  it("keeps only guides within the per-axis page size range [0, size]", () => {
    const guides: readonly CustomGuide[] = [
      { id: "guide1", axis: "x", positionMm: -1 },
      { id: "guide2", axis: "x", positionMm: 0 },
      { id: "guide3", axis: "x", positionMm: 210 },
      { id: "guide4", axis: "x", positionMm: 210.1 },
      { id: "guide5", axis: "y", positionMm: 297 },
      { id: "guide6", axis: "y", positionMm: 297.1 },
    ];
    expect(guidesInPage(guides, page).map((g) => g.id)).toEqual([
      "guide2",
      "guide3",
      "guide5",
    ]);
  });
});
