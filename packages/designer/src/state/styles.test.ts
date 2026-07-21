import type {
  IrDocument,
  IrFlexChild,
  IrFlexElement,
  IrNamedStyle,
  IrRectElement,
  IrTextElement,
} from "@denreport/core";
import { describe, expect, it } from "vitest";
import {
  applyStyle,
  clearStyle,
  removeStyle,
  renameStyle,
  styleFromElement,
  upsertStyle,
} from "./styles";

function blankDocument(styles?: readonly IrNamedStyle[]): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    ...(styles !== undefined ? { styles } : {}),
    elements: [],
  };
}

function textElement(
  id: string,
  overrides: Partial<IrTextElement> = {},
): IrTextElement {
  return {
    type: "text",
    id,
    x: 10,
    y: 10,
    pages: "first",
    w: 40,
    h: 8,
    text: "見本",
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
    ...overrides,
  };
}

function rectElement(
  id: string,
  overrides: Partial<IrRectElement> = {},
): IrRectElement {
  return {
    type: "rect",
    id,
    x: 0,
    y: 0,
    pages: "first",
    w: 20,
    h: 10,
    borderWidth: 0.3,
    ...overrides,
  };
}

function flexOf(id: string, children: readonly IrFlexChild[]): IrFlexElement {
  return {
    type: "flex",
    id,
    x: 0,
    y: 0,
    pages: "first",
    direction: "column",
    gap: 0,
    justifyContent: "start",
    alignItems: "start",
    children,
  };
}

const HEADING: IrNamedStyle = {
  name: "見出し",
  attrs: { fontSize: 16, align: "center" },
};

describe("applyStyle", () => {
  it("writes only the applicable attributes from the definition, ignoring non-applicable ones", () => {
    const doc = blankDocument([HEADING]);
    const withEl = { ...doc, elements: [textElement("t1", { lineHeight: 2 })] };
    const next = applyStyle(withEl, "t1", "見出し");
    expect(next.elements[0]).toMatchObject({
      style: "見出し",
      fontSize: 16,
      align: "center",
      lineHeight: 2,
    });
  });

  it("applies to flex descendants as well", () => {
    const doc = blankDocument([HEADING]);
    const withEl = { ...doc, elements: [flexOf("f1", [textElement("c1")])] };
    const next = applyStyle(withEl, "c1", "見出し");
    const flex = next.elements[0];
    if (flex?.type !== "flex") throw new Error("expected flex");
    expect(flex.children[0]).toMatchObject({ style: "見出し", fontSize: 16 });
  });

  it("returns the same reference for an unknown id", () => {
    const doc = blankDocument([HEADING]);
    const withEl = { ...doc, elements: [textElement("t1")] };
    expect(applyStyle(withEl, "nope", "見出し")).toBe(withEl);
  });

  it("returns the same reference for an unknown name", () => {
    const doc = blankDocument([HEADING]);
    const withEl = { ...doc, elements: [textElement("t1")] };
    expect(applyStyle(withEl, "t1", "nope")).toBe(withEl);
  });

  it("a style with no attributes applicable to the element type only attaches the reference", () => {
    const border: IrNamedStyle = { name: "枠", attrs: { borderWidth: 2 } };
    const doc = blankDocument([border]);
    const withEl = { ...doc, elements: [textElement("t1")] };
    const next = applyStyle(withEl, "t1", "枠");
    expect(next.elements[0]).toMatchObject({
      style: "枠",
      fontSize: 10,
      align: "left",
      lineHeight: 1.25,
    });
  });
});

describe("clearStyle", () => {
  it("removes the style attribute and keeps the concrete values", () => {
    const doc = blankDocument([HEADING]);
    const withEl = {
      ...doc,
      elements: [
        textElement("t1", { style: "見出し", fontSize: 16, align: "center" }),
      ],
    };
    const next = clearStyle(withEl, "t1");
    expect(next.elements[0]).not.toHaveProperty("style");
    expect(next.elements[0]).toMatchObject({ fontSize: 16, align: "center" });
  });

  it("returns the same reference when style is already absent", () => {
    const doc = blankDocument();
    const withEl = { ...doc, elements: [textElement("t1")] };
    expect(clearStyle(withEl, "t1")).toBe(withEl);
  });
});

describe("upsertStyle", () => {
  it("adds it when no style with the same name exists", () => {
    const doc = blankDocument();
    const next = upsertStyle(doc, HEADING);
    expect(next.styles).toEqual([HEADING]);
  });

  it("replaces it when a style with the same name exists", () => {
    const doc = blankDocument([HEADING]);
    const replaced: IrNamedStyle = { name: "見出し", attrs: { fontSize: 20 } };
    const next = upsertStyle(doc, replaced);
    expect(next.styles).toEqual([replaced]);
  });

  it("resynchronizes all referencing elements (including flex descendants) with the new definition values", () => {
    const doc = blankDocument([HEADING]);
    const withEls = {
      ...doc,
      elements: [
        textElement("t1", { style: "見出し", fontSize: 16, align: "center" }),
        flexOf("f1", [
          textElement("c1", { style: "見出し", fontSize: 16, align: "center" }),
        ]),
      ],
    };
    const updated: IrNamedStyle = {
      name: "見出し",
      attrs: { fontSize: 20, align: "right" },
    };
    const next = upsertStyle(withEls, updated);
    expect(next.elements[0]).toMatchObject({ fontSize: 20, align: "right" });
    const flex = next.elements[1];
    if (flex?.type !== "flex") throw new Error("expected flex");
    expect(flex.children[0]).toMatchObject({ fontSize: 20, align: "right" });
  });

  it("overwrites individually deviated concrete values when the definition is updated", () => {
    const doc = blankDocument([HEADING]);
    const withEl = {
      ...doc,
      elements: [
        textElement("t1", { style: "見出し", fontSize: 30, align: "left" }),
      ],
    };
    const next = upsertStyle(withEl, HEADING);
    expect(next.elements[0]).toMatchObject({ fontSize: 16, align: "center" });
  });

  it("does not affect elements that don't reference it", () => {
    const doc = blankDocument([HEADING]);
    const other = textElement("t2", { fontSize: 8 });
    const withEls = { ...doc, elements: [other] };
    const next = upsertStyle(withEls, {
      name: "見出し",
      attrs: { fontSize: 99 },
    });
    expect(next.elements[0]).toBe(other);
  });
});

describe("renameStyle", () => {
  it("rewrites the definition's name and the style of all referencing elements", () => {
    const doc = blankDocument([HEADING]);
    const withEl = {
      ...doc,
      elements: [textElement("t1", { style: "見出し" })],
    };
    const next = renameStyle(withEl, "見出し", "タイトル");
    expect(next.styles).toEqual([{ ...HEADING, name: "タイトル" }]);
    expect(next.elements[0]).toMatchObject({ style: "タイトル" });
  });

  it("does not rename to a conflicting name and returns the same reference", () => {
    const other: IrNamedStyle = { name: "本文", attrs: { fontSize: 10 } };
    const doc = blankDocument([HEADING, other]);
    expect(renameStyle(doc, "見出し", "本文")).toBe(doc);
  });

  it("returns the same reference for an unknown name", () => {
    const doc = blankDocument([HEADING]);
    expect(renameStyle(doc, "nope", "タイトル")).toBe(doc);
  });

  it("returns the same reference when renaming to the same name", () => {
    const doc = blankDocument([HEADING]);
    expect(renameStyle(doc, "見出し", "見出し")).toBe(doc);
  });
});

describe("removeStyle", () => {
  it("removes the definition and removes the style from referencing elements (keeps concrete values)", () => {
    const doc = blankDocument([HEADING]);
    const withEl = {
      ...doc,
      elements: [
        textElement("t1", { style: "見出し", fontSize: 16, align: "center" }),
      ],
    };
    const next = removeStyle(withEl, "見出し");
    expect(next.styles).toBeUndefined();
    expect(next.elements[0]).not.toHaveProperty("style");
    expect(next.elements[0]).toMatchObject({ fontSize: 16 });
  });

  it("keeps the styles attribute when other styles remain after removal", () => {
    const other: IrNamedStyle = { name: "本文", attrs: { fontSize: 10 } };
    const doc = blankDocument([HEADING, other]);
    const next = removeStyle(doc, "見出し");
    expect(next.styles).toEqual([other]);
  });

  it("returns the same reference for an unknown name", () => {
    const doc = blankDocument([HEADING]);
    expect(removeStyle(doc, "nope")).toBe(doc);
  });
});

describe("styleFromElement", () => {
  it("builds an IrNamedStyle from the element's applicable attributes", () => {
    const el = textElement("t1", { fontSize: 18, align: "right" });
    const style = styleFromElement(el, "新規");
    expect(style).toEqual({
      name: "新規",
      attrs: { fontSize: 18, align: "right", lineHeight: 1.25 },
    });
  });

  it("rect takes only borderWidth", () => {
    const el = rectElement("r1", { borderWidth: 1.2 });
    const style = styleFromElement(el, "枠");
    expect(style).toEqual({ name: "枠", attrs: { borderWidth: 1.2 } });
  });

  it("returns null for an element type with no applicable attributes", () => {
    const el = flexOf("f1", [textElement("c1")]);
    expect(styleFromElement(el, "x")).toBeNull();
  });
});
