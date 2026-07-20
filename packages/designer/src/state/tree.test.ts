import type {
  IrDocument,
  IrElement,
  IrFlexChild,
  IrFlexElement,
} from "@denreport/core";
import { describe, expect, it } from "vitest";
import { updateElementById } from "./tree";

function textElement(id: string): IrElement {
  return {
    type: "text",
    id,
    x: 10,
    y: 10,
    pages: "first",
    w: 40,
    h: 8,
    text: id,
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  };
}

const INNER_FLEX: IrFlexChild = {
  type: "flex",
  id: "inner",
  direction: "row",
  gap: 0,
  justifyContent: "start",
  alignItems: "start",
  children: [
    {
      type: "rect",
      id: "grandchild",
      w: 5,
      h: 5,
      borderWidth: 0.3,
    },
  ],
};

const OUTER_FLEX: IrFlexElement = {
  type: "flex",
  id: "outer",
  x: 20,
  y: 20,
  pages: "first",
  direction: "column",
  gap: 2,
  justifyContent: "start",
  alignItems: "start",
  children: [
    {
      type: "text",
      id: "child",
      w: 40,
      h: 8,
      text: "子",
      fontSize: 10,
      align: "left",
      lineHeight: 1.25,
    },
    INNER_FLEX,
  ],
};

function baseDocument(): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements: [textElement("top"), OUTER_FLEX],
  };
}

describe("updateElementById", () => {
  it("トップレベル要素を置換する", () => {
    const doc = baseDocument();
    const next = updateElementById(doc, "top", (el) => ({
      ...el,
      x: 99,
    }));
    expect(next.elements[0]).toMatchObject({ x: 99 });
    expect(next.elements[1]).toBe(doc.elements[1]);
  });

  it("flex 子を置換する", () => {
    const doc = baseDocument();
    const next = updateElementById(doc, "child", (el) => ({
      ...el,
      w: 99,
    }));
    const flex = next.elements[1];
    expect(flex?.type).toBe("flex");
    if (flex?.type === "flex") {
      expect(flex.children[0]).toMatchObject({ w: 99 });
    }
    expect(next.elements[0]).toBe(doc.elements[0]);
  });

  it("入れ子 flex の子孫まで届く", () => {
    const doc = baseDocument();
    const next = updateElementById(doc, "grandchild", (el) => ({
      ...el,
      w: 42,
    }));
    const flex = next.elements[1];
    if (flex?.type === "flex") {
      const inner = flex.children[1];
      if (inner?.type === "flex") {
        expect(inner.children[0]).toMatchObject({ w: 42 });
      } else {
        expect.unreachable();
      }
    } else {
      expect.unreachable();
    }
  });

  it("不在 id は同一参照を返す（no-op）", () => {
    const doc = baseDocument();
    expect(updateElementById(doc, "nope", (el) => el)).toBe(doc);
  });

  it("無関係な部分の参照を維持する（structural sharing）", () => {
    const doc = baseDocument();
    const next = updateElementById(doc, "grandchild", (el) => ({
      ...el,
      w: 42,
    }));
    const flex = next.elements[1];
    if (flex?.type === "flex") {
      expect(flex.children[0]).toBe(OUTER_FLEX.children[0]);
    } else {
      expect.unreachable();
    }
  });
});
