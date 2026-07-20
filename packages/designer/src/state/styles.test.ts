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
  it("該当属性だけを定義値で書き込み、非該当属性は無視する", () => {
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

  it("flex 子孫にも適用できる", () => {
    const doc = blankDocument([HEADING]);
    const withEl = { ...doc, elements: [flexOf("f1", [textElement("c1")])] };
    const next = applyStyle(withEl, "c1", "見出し");
    const flex = next.elements[0];
    if (flex?.type !== "flex") throw new Error("expected flex");
    expect(flex.children[0]).toMatchObject({ style: "見出し", fontSize: 16 });
  });

  it("未知の id では同一参照を返す", () => {
    const doc = blankDocument([HEADING]);
    const withEl = { ...doc, elements: [textElement("t1")] };
    expect(applyStyle(withEl, "nope", "見出し")).toBe(withEl);
  });

  it("未知の name では同一参照を返す", () => {
    const doc = blankDocument([HEADING]);
    const withEl = { ...doc, elements: [textElement("t1")] };
    expect(applyStyle(withEl, "t1", "nope")).toBe(withEl);
  });

  it("要素型に適用可能な属性が1つも無いスタイルは参照だけ付く", () => {
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
  it("style 属性を除去し、具体値は保持する", () => {
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

  it("すでに style が無ければ同一参照を返す", () => {
    const doc = blankDocument();
    const withEl = { ...doc, elements: [textElement("t1")] };
    expect(clearStyle(withEl, "t1")).toBe(withEl);
  });
});

describe("upsertStyle", () => {
  it("同名が無ければ追加する", () => {
    const doc = blankDocument();
    const next = upsertStyle(doc, HEADING);
    expect(next.styles).toEqual([HEADING]);
  });

  it("同名があれば置換する", () => {
    const doc = blankDocument([HEADING]);
    const replaced: IrNamedStyle = { name: "見出し", attrs: { fontSize: 20 } };
    const next = upsertStyle(doc, replaced);
    expect(next.styles).toEqual([replaced]);
  });

  it("参照中の全要素（flex 子孫含む）を新しい定義値で再同期する", () => {
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

  it("個別に逸脱した具体値も定義更新で上書きされる", () => {
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

  it("参照していない要素には影響しない", () => {
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
  it("定義の name と全参照要素の style を書き換える", () => {
    const doc = blankDocument([HEADING]);
    const withEl = {
      ...doc,
      elements: [textElement("t1", { style: "見出し" })],
    };
    const next = renameStyle(withEl, "見出し", "タイトル");
    expect(next.styles).toEqual([{ ...HEADING, name: "タイトル" }]);
    expect(next.elements[0]).toMatchObject({ style: "タイトル" });
  });

  it("衝突名へは変更せず同一参照を返す", () => {
    const other: IrNamedStyle = { name: "本文", attrs: { fontSize: 10 } };
    const doc = blankDocument([HEADING, other]);
    expect(renameStyle(doc, "見出し", "本文")).toBe(doc);
  });

  it("未知の name では同一参照を返す", () => {
    const doc = blankDocument([HEADING]);
    expect(renameStyle(doc, "nope", "タイトル")).toBe(doc);
  });

  it("同名への変更は同一参照を返す", () => {
    const doc = blankDocument([HEADING]);
    expect(renameStyle(doc, "見出し", "見出し")).toBe(doc);
  });
});

describe("removeStyle", () => {
  it("定義を除去し、参照要素の style を除去する（具体値は保持）", () => {
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

  it("削除後も他のスタイルが残る場合は styles 属性を保つ", () => {
    const other: IrNamedStyle = { name: "本文", attrs: { fontSize: 10 } };
    const doc = blankDocument([HEADING, other]);
    const next = removeStyle(doc, "見出し");
    expect(next.styles).toEqual([other]);
  });

  it("未知の name では同一参照を返す", () => {
    const doc = blankDocument([HEADING]);
    expect(removeStyle(doc, "nope")).toBe(doc);
  });
});

describe("styleFromElement", () => {
  it("要素の適用可能属性から IrNamedStyle を組み立てる", () => {
    const el = textElement("t1", { fontSize: 18, align: "right" });
    const style = styleFromElement(el, "新規");
    expect(style).toEqual({
      name: "新規",
      attrs: { fontSize: 18, align: "right", lineHeight: 1.25 },
    });
  });

  it("rect は borderWidth のみを取る", () => {
    const el = rectElement("r1", { borderWidth: 1.2 });
    const style = styleFromElement(el, "枠");
    expect(style).toEqual({ name: "枠", attrs: { borderWidth: 1.2 } });
  });

  it("適用可能属性が無い要素型は null を返す", () => {
    const el = flexOf("f1", [textElement("c1")]);
    expect(styleFromElement(el, "x")).toBeNull();
  });
});
