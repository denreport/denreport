import { describe, expect, it } from "vitest";
import {
  addGuide,
  type CustomGuide,
  guidesInPage,
  moveGuide,
  removeGuide,
} from "./guides";

describe("addGuide", () => {
  it("最小空きの guide<n> を id として採番する", () => {
    const first = addGuide([], "x", 10);
    expect(first.id).toBe("guide1");
    expect(first.guides).toEqual([{ id: "guide1", axis: "x", positionMm: 10 }]);

    const second = addGuide(first.guides, "y", 20);
    expect(second.id).toBe("guide2");
    expect(second.guides).toHaveLength(2);
  });

  it("既存 id の欠番があれば最小の空きを採る", () => {
    const guides: readonly CustomGuide[] = [
      { id: "guide1", axis: "x", positionMm: 10 },
      { id: "guide3", axis: "x", positionMm: 30 },
    ];
    const result = addGuide(guides, "x", 20);
    expect(result.id).toBe("guide2");
  });
});

describe("moveGuide", () => {
  it("指定 id の positionMm だけを更新し、他は不変のまま", () => {
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

  it("存在しない id を指定しても配列を素通しする", () => {
    const guides: readonly CustomGuide[] = [
      { id: "guide1", axis: "x", positionMm: 10 },
    ];
    expect(moveGuide(guides, "guide9", 99)).toEqual(guides);
  });
});

describe("removeGuide", () => {
  it("指定 id を取り除く", () => {
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

  it("軸ごとのページサイズ範囲 [0, size] 内のガイドのみ残す", () => {
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
