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
    font: { regular: "NotoSansJP" },
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
  it("flex children (including nested) have coordinates matching core's resolveFlex", () => {
    const doc = makeDocument([NESTED_FLEX]);
    const views = new Map(layoutDocument(doc, "first").map((v) => [v.id, v]));
    for (const placed of resolveFlex(doc)) {
      const view = views.get(placed.id);
      expect(view, placed.id).toBeDefined();
      expect(view?.box.x, placed.id).toBeCloseTo(placed.x, 10);
      expect(view?.box.y, placed.id).toBeCloseTo(placed.y, 10);
    }
  });

  it("container box: explicit main axis h=50, cross axis is max(children's width)", () => {
    const views = layoutDocument(makeDocument([NESTED_FLEX]), "first");
    const outer = views.find((v) => v.id === "outer");
    expect(outer?.box).toEqual({ x: 20, y: 40, w: 60, h: 50 });
  });

  it("nested container box: derived dimensions (width 10+1+0, height max(8,12)) and placement within parent", () => {
    const views = layoutDocument(makeDocument([NESTED_FLEX]), "first");
    const inner = views.find((v) => v.id === "inner");
    // content height = 6 + 2 + 12 = 20, center within main axis 50 -> offset 15
    expect(inner?.box.w).toBeCloseTo(11, 10);
    expect(inner?.box.h).toBeCloseTo(12, 10);
    expect(inner?.box.y).toBeCloseTo(40 + 15 + 6 + 2, 10);
    // cross axis center: (60 - 11) / 2
    expect(inner?.box.x).toBeCloseTo(20 + 24.5, 10);
    expect(inner?.parentFlexId).toBe("outer");
    expect(inner?.childIndex).toBe(1);
  });

  it("children inherit pages from the container", () => {
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

  it("first context: y origin, width Σ column widths, min(minRows, k_first) rows", () => {
    const views = layoutDocument(makeDocument([TABLE]), "first");
    const view = views.find((v) => v.id === "items");
    // k_first = floor((240-90-9)/9) = 16 -> the row count is minRows's 10
    expect(view?.box).toEqual({ x: 15, y: 90, w: 125, h: 9 + 10 * 9 });
    expect(view?.pages).toBeNull();
  });

  it("rest context: continuationY origin, k_cont rows", () => {
    const views = layoutDocument(makeDocument([TABLE]), "rest");
    const view = views.find((v) => v.id === "items");
    // k_cont = floor((240-30-9)/9) = 22
    expect(view?.box).toEqual({ x: 15, y: 30, w: 125, h: 9 + 22 * 9 });
  });

  it("falls back to a header-only box even when the area is invalid (negative capacity)", () => {
    const broken: IrElement = { ...TABLE, y: 239 };
    const views = layoutDocument(makeDocument([broken]), "first");
    const view = views.find((v) => v.id === "items");
    expect(view?.box.h).toBe(9);
  });
});

describe("layoutDocument: line and draw order", () => {
  it("line becomes a length×0 / 0×length box depending on orientation", () => {
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
  it("C = Σ children's main-axis size + gap×(count−1); nested flex counts using derived dimensions", () => {
    if (NESTED_FLEX.type !== "flex") {
      throw new Error("フィクスチャが flex でない");
    }
    // outer(column): 6 + 2 + 12 (inner's derived height) = 20
    expect(flexMainContentSize(NESTED_FLEX)).toBeCloseTo(20, 10);
    const inner = NESTED_FLEX.children[1];
    if (inner?.type !== "flex") {
      throw new Error("フィクスチャに入れ子 flex がない");
    }
    // inner(row): 10 + 1 + 0 (the width of the vertical line) = 11
    expect(flexMainContentSize(inner)).toBeCloseTo(11, 10);
  });

  it("matches the main-axis size of a container box with no explicit main axis", () => {
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
  it("rounds to 0.1mm units (.05 rounds up)", () => {
    expect(roundMm(1.25)).toBe(1.3);
    expect(roundMm(1.2499)).toBe(1.2);
    expect(roundMm(10)).toBe(10);
    expect(roundMm(0.05)).toBe(0.1);
  });
});

describe("visibleInContext", () => {
  it("visible when pages matches the context, is all, or is a table (null)", () => {
    expect(visibleInContext("first", "first")).toBe(true);
    expect(visibleInContext("all", "rest")).toBe(true);
    expect(visibleInContext(null, "last")).toBe(true);
    expect(visibleInContext("rest", "last")).toBe(false);
    expect(visibleInContext("last", "rest")).toBe(false);
  });
});
