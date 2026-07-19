import { describe, expect, it } from "vitest";
import { resolveFlex } from "../src/ir/flex";
import type {
  IrDocument,
  IrFlexAlign,
  IrFlexChild,
  IrFlexElement,
  IrOrientation,
  IrRectElement,
} from "../src/ir/types";

function textChild(id: string, w: number, h: number): IrFlexChild {
  return {
    type: "text",
    id,
    w,
    h,
    text: id,
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  };
}

function lineChild(
  id: string,
  orientation: IrOrientation,
  length: number,
): IrFlexChild {
  return { type: "line", id, orientation, length, thickness: 0.3 };
}

function barcodeChild(id: string, w: number, h: number): IrFlexChild {
  return { type: "barcode", id, w, h, symbology: "qrcode", value: "{code}" };
}

function rect(id: string): IrRectElement {
  return {
    type: "rect",
    id,
    x: 0,
    y: 0,
    pages: "first",
    w: 1,
    h: 1,
    borderWidth: 0.3,
  };
}

function docOf(...elements: IrDocument["elements"]): IrDocument {
  return {
    version: "1.0",
    page: { width: 500, height: 500 },
    font: { regular: "NotoSansJP" },
    elements,
  };
}

describe("resolveFlex", () => {
  it("stacks children vertically for direction: column", () => {
    const flex: IrFlexElement = {
      type: "flex",
      id: "f1",
      x: 10,
      y: 20,
      pages: "first",
      direction: "column",
      gap: 2,
      justifyContent: "start",
      alignItems: "start",
      children: [textChild("a", 10, 5), textChild("b", 10, 8)],
    };
    const result = resolveFlex(docOf(flex));
    expect(result).toEqual([
      expect.objectContaining({ id: "a", x: 10, y: 20 }),
      expect.objectContaining({ id: "b", x: 10, y: 27 }),
    ]);
  });

  it("stacks children horizontally for direction: row", () => {
    const flex: IrFlexElement = {
      type: "flex",
      id: "f1",
      x: 10,
      y: 20,
      pages: "first",
      direction: "row",
      gap: 3,
      justifyContent: "start",
      alignItems: "start",
      children: [textChild("a", 5, 4), textChild("b", 6, 4)],
    };
    const result = resolveFlex(docOf(flex));
    expect(result).toEqual([
      expect.objectContaining({ id: "a", x: 10, y: 20 }),
      expect.objectContaining({ id: "b", x: 18, y: 20 }),
    ]);
  });

  it("aligns children on the cross axis per alignItems (column)", () => {
    const withAlign = (alignItems: IrFlexAlign): IrFlexElement => ({
      type: "flex",
      id: "f1",
      x: 0,
      y: 0,
      pages: "first",
      direction: "column",
      gap: 0,
      justifyContent: "start",
      alignItems,
      children: [textChild("a", 10, 5), textChild("b", 20, 5)],
    });
    expect(resolveFlex(docOf(withAlign("start")))[0]).toMatchObject({ x: 0 });
    expect(resolveFlex(docOf(withAlign("center")))[0]).toMatchObject({ x: 5 });
    expect(resolveFlex(docOf(withAlign("end")))[0]).toMatchObject({ x: 10 });
  });

  it("offsets children on the main axis per justifyContent, including a non-integer center", () => {
    const withJustify = (justifyContent: IrFlexAlign): IrFlexElement => ({
      type: "flex",
      id: "f1",
      x: 0,
      y: 0,
      pages: "first",
      direction: "row",
      w: 25,
      gap: 0,
      justifyContent,
      alignItems: "start",
      children: [textChild("a", 5, 5), textChild("b", 5, 5)],
    });
    expect(resolveFlex(docOf(withJustify("start")))[0]).toMatchObject({ x: 0 });
    expect(resolveFlex(docOf(withJustify("center")))[0]).toMatchObject({
      x: 7.5,
    });
    expect(resolveFlex(docOf(withJustify("end")))[0]).toMatchObject({ x: 15 });
  });

  it("produces the same result for every justifyContent when the explicit dimension equals content", () => {
    const withJustify = (justifyContent: IrFlexAlign): IrFlexElement => ({
      type: "flex",
      id: "f1",
      x: 0,
      y: 0,
      pages: "first",
      direction: "row",
      w: 10, // C = 5 + 5 + gap(0) = 10、境界ちょうど
      gap: 0,
      justifyContent,
      alignItems: "start",
      children: [textChild("a", 5, 5), textChild("b", 5, 5)],
    });
    const start = resolveFlex(docOf(withJustify("start")));
    const center = resolveFlex(docOf(withJustify("center")));
    const end = resolveFlex(docOf(withJustify("end")));
    expect(center).toEqual(start);
    expect(end).toEqual(start);
  });

  it("ignores justifyContent when the main-axis dimension is omitted (L = C)", () => {
    const withJustify = (justifyContent: IrFlexAlign): IrFlexElement => ({
      type: "flex",
      id: "f1",
      x: 0,
      y: 0,
      pages: "first",
      direction: "row",
      gap: 0,
      justifyContent,
      alignItems: "start",
      children: [textChild("a", 5, 5), textChild("b", 5, 5)],
    });
    const start = resolveFlex(docOf(withJustify("start")));
    const center = resolveFlex(docOf(withJustify("center")));
    const end = resolveFlex(docOf(withJustify("end")));
    expect(center).toEqual(start);
    expect(end).toEqual(start);
  });

  it("applies gap between children, and zero gap packs them together", () => {
    const withGap = (gap: number): IrFlexElement => ({
      type: "flex",
      id: "f1",
      x: 0,
      y: 0,
      pages: "first",
      direction: "row",
      gap,
      justifyContent: "start",
      alignItems: "start",
      children: [textChild("a", 5, 5), textChild("b", 5, 5)],
    });
    expect(resolveFlex(docOf(withGap(0)))[1]).toMatchObject({ x: 5 });
    expect(resolveFlex(docOf(withGap(4)))[1]).toMatchObject({ x: 9 });
  });

  it("resolves nested flex containers depth-first", () => {
    const inner: IrFlexChild = {
      type: "flex",
      id: "inner",
      direction: "row",
      gap: 1,
      justifyContent: "start",
      alignItems: "start",
      children: [textChild("x", 3, 4), textChild("y", 3, 4)],
    };
    const outer: IrFlexElement = {
      type: "flex",
      id: "outer",
      x: 100,
      y: 100,
      pages: "first",
      direction: "column",
      gap: 0,
      justifyContent: "start",
      alignItems: "start",
      children: [inner],
    };
    const result = resolveFlex(docOf(outer));
    expect(result).toEqual([
      expect.objectContaining({ id: "x", x: 100, y: 100 }),
      expect.objectContaining({ id: "y", x: 104, y: 100 }),
    ]);
  });

  it("sizes a barcode child by its w/h, like text/rect/image", () => {
    const flex: IrFlexElement = {
      type: "flex",
      id: "f1",
      x: 10,
      y: 20,
      pages: "first",
      direction: "row",
      gap: 2,
      justifyContent: "start",
      alignItems: "start",
      children: [barcodeChild("a", 15, 15), textChild("b", 5, 5)],
    };
    const result = resolveFlex(docOf(flex));
    expect(result[0]).toMatchObject({ id: "a", x: 10, y: 20 });
    expect(result[1]).toMatchObject({ id: "b", x: 27, y: 20 });
  });

  it("gives a horizontal line zero cross-axis size and a vertical line zero main-axis size", () => {
    const flex: IrFlexElement = {
      type: "flex",
      id: "f1",
      x: 0,
      y: 0,
      pages: "first",
      direction: "row",
      gap: 2,
      justifyContent: "start",
      alignItems: "center",
      children: [lineChild("hz", "horizontal", 10), textChild("t", 4, 6)],
    };
    const result = resolveFlex(docOf(flex));
    expect(result[0]).toMatchObject({ id: "hz", x: 0, y: 3 });
    expect(result[1]).toMatchObject({ id: "t", x: 12, y: 0 });
  });

  it("propagates the container's pages to all descendants, including nested flex", () => {
    const inner: IrFlexChild = {
      type: "flex",
      id: "inner",
      direction: "row",
      gap: 0,
      justifyContent: "start",
      alignItems: "start",
      children: [textChild("x", 1, 1)],
    };
    const outer: IrFlexElement = {
      type: "flex",
      id: "outer",
      x: 0,
      y: 0,
      pages: "last",
      direction: "column",
      gap: 0,
      justifyContent: "start",
      alignItems: "start",
      children: [inner],
    };
    const result = resolveFlex(docOf(outer));
    expect(result[0]).toMatchObject({ pages: "last" });
  });

  it("preserves draw order, expanding a flex container in place", () => {
    const flex: IrFlexElement = {
      type: "flex",
      id: "f1",
      x: 0,
      y: 0,
      pages: "first",
      direction: "row",
      gap: 0,
      justifyContent: "start",
      alignItems: "start",
      children: [textChild("a", 1, 1), textChild("b", 1, 1)],
    };
    const result = resolveFlex(docOf(rect("before"), flex, rect("after")));
    expect(result.map((e) => e.id)).toEqual(["before", "a", "b", "after"]);
  });
});
