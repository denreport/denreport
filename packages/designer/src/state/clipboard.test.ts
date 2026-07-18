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
    font: { name: "NotoSansJP" },
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
  it("選択順と逆でも文書順で格納される", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [textElement("a"), textElement("b")],
    };
    const clipboard = clipboardFromSelection(doc, ["b", "a"], []);
    expect(clipboard?.elements.map((el) => el.id)).toEqual(["a", "b"]);
  });

  it("flex 子 id を渡しても含まれない", () => {
    const flex = flexElement("f", "c1");
    const doc: IrDocument = { ...blankDocument(), elements: [flex] };
    expect(clipboardFromSelection(doc, ["c1"], [])).toBeNull();
  });

  it("トップレベル該当が 0 件なら null", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [textElement("a")],
    };
    expect(clipboardFromSelection(doc, ["nothing"], [])).toBeNull();
  });

  it("pasteCount は 0 で初期化される", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [textElement("a")],
    };
    expect(clipboardFromSelection(doc, ["a"], [])?.pasteCount).toBe(0);
  });

  it("グループ全員を格納すると groupIndexes に添字集合が記録される", () => {
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

  it("グループの一部のみ格納した場合、格納された分が2件以上なら記録される", () => {
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

  it("グループの1件のみ格納した場合は記録されない", () => {
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
  it("既存 id text1, text3 がある文書へ text をペーストすると text2 が採番される", () => {
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

  it("複数要素で新 id が文書内で一意になる", () => {
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

  it("flex コンテナのペーストで子孫 id もすべて再採番され、元の flex とその子は不変", () => {
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

  it("x/y に +5mm、table は continuationY にも +5mm、maxY は不変", () => {
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

  it("複数要素の相対位置（x/y の差）が保存される", () => {
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

  it("連続ペーストでオフセットが 10mm・15mm と累積する", () => {
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

  it("ペースト結果の文書は parseIr で正規化済み完全形として通る", () => {
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

  it("元文書の未変更要素の参照が保持される", () => {
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

  it("ペースト結果は文書配列の末尾（最前面）に追加される", () => {
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

  it("groupIndexes は pastedIds と同じ添字で新要素を指す", () => {
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
