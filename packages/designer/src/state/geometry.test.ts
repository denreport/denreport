import type { IrDocument, IrElement } from "@denreport/core";
import { resolveFlex } from "@denreport/core";
import { describe, expect, it } from "vitest";
import {
  flexMainContentSize,
  layoutDocument,
  roundMm,
  visibleInContext,
} from "./geometry";

function makeDocument(elements: readonly IrElement[]): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { name: "NotoSansJP" },
    elements,
  };
}

const NESTED_FLEX: IrElement = {
  type: "flex",
  id: "outer",
  x: 20,
  y: 40,
  pages: "first",
  direction: "column",
  h: 50,
  gap: 2,
  justifyContent: "center",
  alignItems: "center",
  children: [
    {
      type: "text",
      id: "t1",
      w: 60,
      h: 6,
      text: "a",
      fontSize: 10,
      align: "left",
      lineHeight: 1.25,
    },
    {
      type: "flex",
      id: "inner",
      direction: "row",
      gap: 1,
      justifyContent: "start",
      alignItems: "end",
      children: [
        {
          type: "rect",
          id: "r1",
          w: 10,
          h: 8,
          borderWidth: 0.3,
        },
        {
          type: "line",
          id: "l1",
          orientation: "vertical",
          length: 12,
          thickness: 0.3,
        },
      ],
    },
  ],
};

describe("layoutDocument: flex", () => {
  it("flex 子（入れ子含む）の座標が core の resolveFlex と一致する", () => {
    const doc = makeDocument([NESTED_FLEX]);
    const views = new Map(layoutDocument(doc, "first").map((v) => [v.id, v]));
    for (const placed of resolveFlex(doc)) {
      const view = views.get(placed.id);
      expect(view, placed.id).toBeDefined();
      expect(view?.box.x, placed.id).toBeCloseTo(placed.x, 10);
      expect(view?.box.y, placed.id).toBeCloseTo(placed.y, 10);
    }
  });

  it("コンテナの箱: 主軸明示 h=50、交差軸は max(子の幅)", () => {
    const views = layoutDocument(makeDocument([NESTED_FLEX]), "first");
    const outer = views.find((v) => v.id === "outer");
    expect(outer?.box).toEqual({ x: 20, y: 40, w: 60, h: 50 });
  });

  it("入れ子コンテナの箱: 導出寸法（幅 10+1+0、高さ max(8,12)）と親内の配置", () => {
    const views = layoutDocument(makeDocument([NESTED_FLEX]), "first");
    const inner = views.find((v) => v.id === "inner");
    // 内容高 = 6 + 2 + 12 = 20、主軸 50 の center → オフセット 15
    expect(inner?.box.w).toBeCloseTo(11, 10);
    expect(inner?.box.h).toBeCloseTo(12, 10);
    expect(inner?.box.y).toBeCloseTo(40 + 15 + 6 + 2, 10);
    // 交差軸 center: (60 - 11) / 2
    expect(inner?.box.x).toBeCloseTo(20 + 24.5, 10);
    expect(inner?.parentFlexId).toBe("outer");
    expect(inner?.childIndex).toBe(1);
  });

  it("子は pages をコンテナから継承する", () => {
    const views = layoutDocument(makeDocument([NESTED_FLEX]), "first");
    const t1 = views.find((v) => v.id === "t1");
    expect(t1?.pages).toBe("first");
    expect(t1?.parentFlexId).toBe("outer");
  });
});

describe("layoutDocument: table", () => {
  const TABLE: IrElement = {
    type: "table",
    id: "items",
    x: 15,
    y: 90,
    bind: "items",
    columns: [
      { key: "name", label: "品目", width: 90, align: "left" },
      { key: "amount", label: "金額", width: 35, align: "right" },
    ],
    rowHeight: 9,
    headerHeight: 9,
    fontSize: 10,
    maxY: 240,
    continuationY: 30,
    minRows: 10,
  };

  it("first 文脈: y 起点・幅 Σ列幅・min(minRows, k_first) 行", () => {
    const views = layoutDocument(makeDocument([TABLE]), "first");
    const view = views.find((v) => v.id === "items");
    // k_first = floor((240-90-9)/9) = 16 → 行数は minRows の 10
    expect(view?.box).toEqual({ x: 15, y: 90, w: 125, h: 9 + 10 * 9 });
    expect(view?.pages).toBeNull();
  });

  it("rest 文脈: continuationY 起点・k_cont 行", () => {
    const views = layoutDocument(makeDocument([TABLE]), "rest");
    const view = views.find((v) => v.id === "items");
    // k_cont = floor((240-30-9)/9) = 22
    expect(view?.box).toEqual({ x: 15, y: 30, w: 125, h: 9 + 22 * 9 });
  });

  it("領域が不成立（容量が負）でもヘッダのみの箱に落ちる", () => {
    const broken: IrElement = { ...TABLE, y: 239 };
    const views = layoutDocument(makeDocument([broken]), "first");
    const view = views.find((v) => v.id === "items");
    expect(view?.box.h).toBe(9);
  });
});

describe("layoutDocument: line と描画順", () => {
  it("line は orientation に応じて length×0 / 0×length の箱になる", () => {
    const doc = makeDocument([
      {
        type: "line",
        id: "lh",
        x: 10,
        y: 20,
        pages: "all",
        orientation: "horizontal",
        length: 90,
        thickness: 0.4,
      },
      {
        type: "line",
        id: "lv",
        x: 30,
        y: 40,
        pages: "all",
        orientation: "vertical",
        length: 50,
        thickness: 0.4,
      },
    ]);
    const views = layoutDocument(doc, "first");
    expect(views.map((v) => v.id)).toEqual(["lh", "lv"]);
    expect(views[0]?.box).toEqual({ x: 10, y: 20, w: 90, h: 0 });
    expect(views[1]?.box).toEqual({ x: 30, y: 40, w: 0, h: 50 });
  });
});

describe("flexMainContentSize", () => {
  it("C = Σ子の主軸寸法 + gap×(子数−1)。入れ子の flex は導出寸法で数える", () => {
    if (NESTED_FLEX.type !== "flex") {
      throw new Error("フィクスチャが flex でない");
    }
    // outer(column): 6 + 2 + 12（inner の導出高） = 20
    expect(flexMainContentSize(NESTED_FLEX)).toBeCloseTo(20, 10);
    const inner = NESTED_FLEX.children[1];
    if (inner?.type !== "flex") {
      throw new Error("フィクスチャに入れ子 flex がない");
    }
    // inner(row): 10 + 1 + 0（垂直 line の幅） = 11
    expect(flexMainContentSize(inner)).toBeCloseTo(11, 10);
  });

  it("主軸明示なしのコンテナ箱の主軸寸法と一致する", () => {
    if (NESTED_FLEX.type !== "flex") {
      throw new Error("フィクスチャが flex でない");
    }
    const { h: _h, ...derived } = NESTED_FLEX;
    const views = layoutDocument(makeDocument([derived]), "first");
    const outer = views.find((v) => v.id === "outer");
    expect(outer?.box.h).toBeCloseTo(flexMainContentSize(derived), 10);
  });
});

describe("roundMm", () => {
  it("0.1mm 単位に丸める（.05 は切り上げ）", () => {
    expect(roundMm(1.25)).toBe(1.3);
    expect(roundMm(1.2499)).toBe(1.2);
    expect(roundMm(10)).toBe(10);
    expect(roundMm(0.05)).toBe(0.1);
  });
});

describe("visibleInContext", () => {
  it("pages が文脈一致か all、または table（null）のとき可視", () => {
    expect(visibleInContext("first", "first")).toBe(true);
    expect(visibleInContext("all", "rest")).toBe(true);
    expect(visibleInContext(null, "last")).toBe(true);
    expect(visibleInContext("rest", "last")).toBe(false);
    expect(visibleInContext("last", "rest")).toBe(false);
  });
});
