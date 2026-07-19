import { describe, expect, it } from "vitest";
import { footnoteMarkIds, resolveFootnotes } from "../src/ir/footnotes";
import type { IrDocument, IrFootnotes, IrTextElement } from "../src/ir/types";

function text(
  id: string,
  content: string,
  overrides: Partial<IrTextElement> = {},
): IrTextElement {
  return {
    type: "text",
    id,
    x: 0,
    y: 0,
    pages: "first",
    w: 50,
    h: 10,
    text: content,
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
    ...overrides,
  };
}

function footnotes(overrides: Partial<IrFootnotes> = {}): IrFootnotes {
  return {
    x: 15,
    w: 180,
    bottom: 10,
    fontSize: 8,
    lineHeight: 1.25,
    pages: "all",
    notes: [],
    ...overrides,
  };
}

function doc(overrides: Partial<IrDocument> = {}): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements: [],
    ...overrides,
  };
}

describe("footnoteMarkIds", () => {
  it("returns a single mark id", () => {
    expect(footnoteMarkIds("税抜{#tax}です")).toEqual(["tax"]);
  });

  it("returns multiple, repeated ids in order with duplicates", () => {
    expect(footnoteMarkIds("{#a}{#b} {#a}")).toEqual(["a", "b", "a"]);
  });

  it("ignores plain {key} data tokens", () => {
    expect(footnoteMarkIds("{tax}")).toEqual([]);
  });

  it("ignores non-identifier braces as literal text", () => {
    expect(footnoteMarkIds("{#tax rate} {#} {#")).toEqual([]);
  });
});

describe("resolveFootnotes", () => {
  it("passes a document without footnotes through unchanged", () => {
    const document = doc({ elements: [text("t1", "hello")] });
    expect(resolveFootnotes(document)).toBe(document);
  });

  it("passes through and removes the footnotes key when notes is empty", () => {
    const document = doc({ footnotes: footnotes({ notes: [] }) });
    const resolved = resolveFootnotes(document);
    expect(resolved).not.toHaveProperty("footnotes");
    expect(resolved.elements).toEqual(document.elements);
  });

  it("numbers marks in first-occurrence order across elements and replaces them with *n", () => {
    const document = doc({
      elements: [
        text("t1", "税抜{#tax}、手数料{#fee}負担"),
        text("t2", "再度{#tax}を参照"),
      ],
      footnotes: footnotes({
        notes: [
          { id: "fee", text: "振込手数料はお客様負担です" },
          { id: "tax", text: "本体価格は税抜表示です" },
        ],
      }),
    });
    const resolved = resolveFootnotes(document);
    const [t1, t2] = resolved.elements as [IrTextElement, IrTextElement];
    expect(t1.text).toBe("税抜*1、手数料*2負担");
    expect(t2.text).toBe("再度*1を参照");
  });

  it("appends a single note block text element listing notes in reference-number order", () => {
    const document = doc({
      elements: [text("t1", "税抜{#tax}、手数料{#fee}負担")],
      footnotes: footnotes({
        notes: [
          { id: "fee", text: "振込手数料はお客様負担です" },
          { id: "tax", text: "本体価格は税抜表示です" },
        ],
      }),
    });
    const resolved = resolveFootnotes(document);
    const block = resolved.elements[resolved.elements.length - 1];
    expect(block).toMatchObject({
      id: "apxFootnotes",
      text: "*1 本体価格は税抜表示です\n*2 振込手数料はお客様負担です",
    });
  });

  it("keeps multi-line note bodies without prefixing continuation lines", () => {
    const document = doc({
      elements: [text("t1", "{#a}")],
      footnotes: footnotes({
        notes: [{ id: "a", text: "1行目\n2行目" }],
      }),
    });
    const resolved = resolveFootnotes(document);
    const block = resolved.elements[resolved.elements.length - 1];
    expect(block).toMatchObject({ text: "*1 1行目\n2行目" });
  });

  it("removes the footnotes key from the resolved document", () => {
    const document = doc({
      elements: [text("t1", "{#a}")],
      footnotes: footnotes({ notes: [{ id: "a", text: "本文" }] }),
    });
    const resolved = resolveFootnotes(document);
    expect(resolved).not.toHaveProperty("footnotes");
  });

  it("computes blockHeight and y from total line count, fontSize, and lineHeight", () => {
    const document = doc({
      page: { width: 210, height: 297 },
      elements: [text("t1", "{#a}{#b}")],
      footnotes: footnotes({
        bottom: 10,
        fontSize: 8,
        lineHeight: 1.25,
        notes: [
          { id: "a", text: "1行目\n2行目" },
          { id: "b", text: "1行のみ" },
        ],
      }),
    });
    const resolved = resolveFootnotes(document);
    const block = resolved.elements[
      resolved.elements.length - 1
    ] as IrTextElement;
    const ptToMm = 25.4 / 72;
    const expectedHeight = 3 * 8 * 1.25 * ptToMm;
    expect(block.h).toBeCloseTo(expectedHeight);
    expect(block.y).toBeCloseTo(297 - 10 - expectedHeight);
  });

  it("carries footnotes.pages onto the note block", () => {
    const document = doc({
      elements: [text("t1", "{#a}")],
      footnotes: footnotes({
        pages: "last",
        notes: [{ id: "a", text: "本文" }],
      }),
    });
    const resolved = resolveFootnotes(document);
    const block = resolved.elements[resolved.elements.length - 1];
    expect(block).toMatchObject({ pages: "last" });
  });

  it("reuses the first-occurrence number for repeated marks of the same id", () => {
    const document = doc({
      elements: [text("t1", "{#a} と {#a} は同じ")],
      footnotes: footnotes({ notes: [{ id: "a", text: "本文" }] }),
    });
    const resolved = resolveFootnotes(document);
    const [t1] = resolved.elements as [IrTextElement];
    expect(t1.text).toBe("*1 と *1 は同じ");
  });

  it("does not add a note block when no mark references any note", () => {
    const document = doc({
      elements: [text("t1", "マークなし")],
      footnotes: footnotes({ notes: [{ id: "a", text: "本文" }] }),
    });
    const resolved = resolveFootnotes(document);
    expect(resolved.elements).toEqual(document.elements);
    expect(resolved).not.toHaveProperty("footnotes");
  });
});
