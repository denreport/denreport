import type {
  IrDocument,
  IrElement,
  IrFlexElement,
  IrTableElement,
  IrTextElement,
} from "@denreport/core";
import { parseIr } from "@denreport/core";
import { describe, expect, it } from "vitest";
import { clipboardFromSelection, pasteFromClipboard } from "./clipboard";
import type { ElementGroup } from "./groups";

function blankDocument(): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements: [],
  };
}

function textElement(id: string, x = 10, y = 10): IrTextElement {
  return {
    type: "text",
    id,
    x,
    y,
    pages: "first",
    w: 40,
    h: 8,
    text: id,
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  };
}

function tableElement(id: string, y = 90): IrTableElement {
  return {
    type: "table",
    id,
    x: 15,
    y,
    bind: "items",
    columns: [{ key: "col1", label: "列1", width: 40, align: "left" }],
    rowHeight: 8,
    headerHeight: 8,
    fontSize: 10,
    maxY: 297,
    continuationY: y,
    minRows: 3,
  };
}

function flexElement(id: string, childId: string): IrFlexElement {
  return {
    type: "flex",
    id,
    x: 20,
    y: 20,
    pages: "first",
    direction: "column",
    gap: 2,
    justifyContent: "start",
    alignItems: "start",
    children: [
      {
        type: "flex",
        id: `${childId}-inner`,
        direction: "row",
        gap: 0,
        justifyContent: "start",
        alignItems: "start",
        children: [
          {
            type: "text",
            id: childId,
            w: 40,
            h: 8,
            text: childId,
            fontSize: 10,
            align: "left",
            lineHeight: 1.25,
          },
        ],
      },
    ],
  };
}

describe("clipboardFromSelection", () => {
  it("stores elements in document order even when selected in reverse", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [textElement("a"), textElement("b")],
    };
    const clipboard = clipboardFromSelection(doc, ["b", "a"], []);
    expect(clipboard?.elements.map((el) => el.id)).toEqual(["a", "b"]);
  });

  it("excludes a flex child id even if passed in", () => {
    const flex = flexElement("f", "c1");
    const doc: IrDocument = { ...blankDocument(), elements: [flex] };
    expect(clipboardFromSelection(doc, ["c1"], [])).toBeNull();
  });

  it("returns null when zero top-level ids match", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [textElement("a")],
    };
    expect(clipboardFromSelection(doc, ["nothing"], [])).toBeNull();
  });

  it("initializes pasteCount to 0", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [textElement("a")],
    };
    expect(clipboardFromSelection(doc, ["a"], [])?.pasteCount).toBe(0);
  });

  it("records an index set in groupIndexes when all group members are stored", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [textElement("a"), textElement("b"), textElement("c")],
    };
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "c"] },
    ];
    const clipboard = clipboardFromSelection(doc, ["a", "b", "c"], groups);
    expect(clipboard?.groupIndexes).toEqual([[0, 2]]);
  });

  it("records it when only part of a group is stored, as long as 2 or more are stored", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [textElement("a"), textElement("b"), textElement("c")],
    };
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b", "c"] },
    ];
    const clipboard = clipboardFromSelection(doc, ["a", "b"], groups);
    expect(clipboard?.groupIndexes).toEqual([[0, 1]]);
  });

  it("doesn't record it when only one member of a group is stored", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [textElement("a"), textElement("b")],
    };
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b"] },
    ];
    const clipboard = clipboardFromSelection(doc, ["a"], groups);
    expect(clipboard?.groupIndexes).toEqual([]);
  });
});

describe("pasteFromClipboard", () => {
  it("pasting text into a document with existing ids text1, text3 assigns text2", () => {
    const source = textElement("src", 10, 10);
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [textElement("text1"), source, textElement("text3")],
    };
    const clipboard = clipboardFromSelection(doc, ["src"], []);
    expect(clipboard).not.toBeNull();
    if (clipboard === null) return;
    const result = pasteFromClipboard(doc, clipboard);
    expect(result.pastedIds).toEqual(["text2"]);
  });

  it("new ids for multiple elements are unique within the document", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [textElement("a"), textElement("b")],
    };
    const clipboard = clipboardFromSelection(doc, ["a", "b"], []);
    expect(clipboard).not.toBeNull();
    if (clipboard === null) return;
    const result = pasteFromClipboard(doc, clipboard);
    expect(result.pastedIds).toEqual(["text1", "text2"]);
    expect(new Set(result.pastedIds).size).toBe(2);
  });

  it("pasting a flex container renumbers all descendant ids too, leaving the original flex and its children unchanged", () => {
    const flex = flexElement("f", "c1");
    const doc: IrDocument = { ...blankDocument(), elements: [flex] };
    const clipboard = clipboardFromSelection(doc, ["f"], []);
    expect(clipboard).not.toBeNull();
    if (clipboard === null) return;
    const result = pasteFromClipboard(doc, clipboard);

    const pasted = result.document.elements[1];
    expect(pasted?.type).toBe("flex");
    if (pasted?.type !== "flex") return;
    expect(pasted.id).not.toBe("f");
    const inner = pasted.children[0];
    expect(inner?.type).toBe("flex");
    if (inner?.type !== "flex") return;
    expect(inner.id).not.toBe("c1-inner");
    expect(inner.children[0]?.id).not.toBe("c1");

    expect(doc.elements[0]).toBe(flex);
  });

  it("+5mm to x/y; for a table, continuationY also gets +5mm, while maxY is unchanged", () => {
    const table = tableElement("tbl", 90);
    const doc: IrDocument = { ...blankDocument(), elements: [table] };
    const clipboard = clipboardFromSelection(doc, ["tbl"], []);
    expect(clipboard).not.toBeNull();
    if (clipboard === null) return;
    const result = pasteFromClipboard(doc, clipboard);
    const pasted = result.document.elements[1];
    expect(pasted).toMatchObject({
      x: 20,
      y: 95,
      continuationY: 95,
      maxY: 297,
    });
  });

  it("preserves the relative position (x/y difference) of multiple elements", () => {
    const a = textElement("a", 10, 10);
    const b = textElement("b", 60, 40);
    const doc: IrDocument = { ...blankDocument(), elements: [a, b] };
    const clipboard = clipboardFromSelection(doc, ["a", "b"], []);
    expect(clipboard).not.toBeNull();
    if (clipboard === null) return;
    const result = pasteFromClipboard(doc, clipboard);
    const [pastedA, pastedB] = result.document.elements.slice(2) as [
      IrElement,
      IrElement,
    ];
    expect(pastedA).toMatchObject({ x: 15, y: 15 });
    expect(pastedB).toMatchObject({ x: 65, y: 45 });
  });

  it("successive pastes accumulate the offset as 10mm, 15mm", () => {
    const a = textElement("a", 10, 10);
    const doc: IrDocument = { ...blankDocument(), elements: [a] };
    const clipboard = clipboardFromSelection(doc, ["a"], []);
    expect(clipboard).not.toBeNull();
    if (clipboard === null) return;

    const first = pasteFromClipboard(doc, clipboard);
    expect(first.document.elements[1]).toMatchObject({ x: 15, y: 15 });
    expect(first.clipboard.pasteCount).toBe(1);

    const second = pasteFromClipboard(first.document, first.clipboard);
    expect(second.document.elements[2]).toMatchObject({ x: 20, y: 20 });
    expect(second.clipboard.pasteCount).toBe(2);

    const third = pasteFromClipboard(second.document, second.clipboard);
    expect(third.document.elements[3]).toMatchObject({ x: 25, y: 25 });
  });

  it("the pasted document passes parseIr as an already-normalized, complete form", () => {
    const flex = flexElement("f", "c1");
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [textElement("a"), tableElement("tbl"), flex],
    };
    const clipboard = clipboardFromSelection(doc, ["a", "tbl", "f"], []);
    expect(clipboard).not.toBeNull();
    if (clipboard === null) return;
    const result = pasteFromClipboard(doc, clipboard);
    const parsed = parseIr(JSON.stringify(result.document));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.document).toEqual(result.document);
    }
  });

  it("preserves references to unchanged elements from the original document", () => {
    const a = textElement("a", 10, 10);
    const b = textElement("b", 60, 10);
    const doc: IrDocument = { ...blankDocument(), elements: [a, b] };
    const clipboard = clipboardFromSelection(doc, ["a"], []);
    expect(clipboard).not.toBeNull();
    if (clipboard === null) return;
    const result = pasteFromClipboard(doc, clipboard);
    expect(result.document.elements[0]).toBe(a);
    expect(result.document.elements[1]).toBe(b);
  });

  it("the pasted result is appended to the end (frontmost) of the elements array", () => {
    const a = textElement("a", 10, 10);
    const b = textElement("b", 60, 10);
    const doc: IrDocument = { ...blankDocument(), elements: [a, b] };
    const clipboard = clipboardFromSelection(doc, ["a"], []);
    expect(clipboard).not.toBeNull();
    if (clipboard === null) return;
    const result = pasteFromClipboard(doc, clipboard);
    expect(result.document.elements).toHaveLength(3);
    expect(result.document.elements[2]?.id).toBe(result.pastedIds[0]);
  });

  it("groupIndexes point to new elements using the same indices as pastedIds", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [textElement("a"), textElement("b"), textElement("c")],
    };
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "c"] },
    ];
    const clipboard = clipboardFromSelection(doc, ["a", "b", "c"], groups);
    expect(clipboard).not.toBeNull();
    if (clipboard === null) return;
    const result = pasteFromClipboard(doc, clipboard);
    const [groupIndexes] = clipboard.groupIndexes;
    expect(groupIndexes).toBeDefined();
    if (groupIndexes === undefined) return;
    const memberIds = groupIndexes.map((index) => result.pastedIds[index]);
    expect(memberIds).toEqual([result.pastedIds[0], result.pastedIds[2]]);
  });
});
