import type { IrDocument, IrElement } from "@denreport/core";
import { describe, expect, it } from "vitest";
import {
  alignSelection,
  canGroupSelection,
  canUngroupSelection,
  copySelection,
  cutSelection,
  deleteSelection,
  distributeSelection,
  duplicateSelection,
  groupSelection,
  pasteClipboard,
  ungroupSelection,
} from "./commands";
import { EditorStore } from "./store";

function textElement(id: string, x = 10, y = 10): IrElement {
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

function flexWithChild(id: string, childId: string): IrElement {
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
  };
}

function makeStore(
  elements: readonly IrElement[] = [textElement("a")],
  selection: readonly string[] = ["a"],
): EditorStore {
  const document: IrDocument = {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements,
  };
  const store = new EditorStore(document);
  store.setSelection(selection);
  return store;
}

function elementAt(store: EditorStore, id: string): IrElement | undefined {
  return store.getState().document.elements.find((el) => el.id === id);
}

describe("copySelection", () => {
  it("returns true with a selection: stores the clipboard and leaves the document/history unchanged", () => {
    const store = makeStore();
    const before = store.getState().document;

    expect(copySelection(store)).toBe(true);

    expect(store.getClipboard()?.elements.map((el) => el.id)).toEqual(["a"]);
    expect(store.getState().document).toBe(before);
    expect(store.canUndo()).toBe(false);
  });

  it("returns false when the selection is empty", () => {
    const store = makeStore([textElement("a")], []);
    expect(copySelection(store)).toBe(false);
    expect(store.getClipboard()).toBeNull();
  });
});

describe("cutSelection", () => {
  it("is restored by a single undo (1 commit)", () => {
    const store = makeStore();
    expect(cutSelection(store)).toBe(true);
    expect(store.getState().document.elements).toEqual([]);

    store.undo();
    expect(store.getState().document.elements).toHaveLength(1);
    expect(store.canUndo()).toBe(false);
  });

  it("keeps the clipboard after undo", () => {
    const store = makeStore();
    cutSelection(store);
    store.undo();
    expect(store.getClipboard()?.elements.map((el) => el.id)).toEqual(["a"]);
  });
});

describe("pasteClipboard", () => {
  it("returns false when the clipboard is empty", () => {
    const store = makeStore();
    expect(pasteClipboard(store)).toBe(false);
  });

  it("selects the new id after pasting, and the offset accumulates on repeated paste", () => {
    const store = makeStore();
    copySelection(store);

    expect(pasteClipboard(store)).toBe(true);
    const firstId = store.getState().selection[0];
    expect(firstId).toBeDefined();
    expect(firstId).not.toBe("a");
    expect(elementAt(store, firstId as string)).toMatchObject({ x: 15, y: 15 });

    pasteClipboard(store);
    const secondId = store.getState().selection[0];
    expect(secondId).not.toBe(firstId);
    expect(elementAt(store, secondId as string)).toMatchObject({
      x: 20,
      y: 20,
    });
  });
});

describe("duplicateSelection", () => {
  it("leaves getClipboard() referentially unchanged after duplicating", () => {
    const store = makeStore();
    expect(store.getClipboard()).toBeNull();

    expect(duplicateSelection(store)).toBe(true);
    expect(store.getClipboard()).toBeNull();
  });

  it("does not mutate the saved clipboard", () => {
    const store = makeStore([textElement("a"), textElement("b", 60, 60)]);
    store.setSelection(["b"]);
    copySelection(store);
    const clipboardBefore = store.getClipboard();

    store.setSelection(["a"]);
    duplicateSelection(store);

    expect(store.getClipboard()).toBe(clipboardBefore);
  });

  it("moves the selection to the duplicated result with a 5mm offset, and reverts with 1 undo", () => {
    const store = makeStore();
    expect(duplicateSelection(store)).toBe(true);

    const newId = store.getState().selection[0];
    expect(newId).not.toBe("a");
    expect(elementAt(store, newId as string)).toMatchObject({ x: 15, y: 15 });
    expect(store.getState().document.elements).toHaveLength(2);

    store.undo();
    expect(store.getState().document.elements).toHaveLength(1);
    expect(store.canUndo()).toBe(false);
  });

  it("returns false when only flex children are selected", () => {
    const store = makeStore([flexWithChild("f", "c1")], ["c1"]);
    expect(duplicateSelection(store)).toBe(false);
    expect(store.getState().document.elements).toHaveLength(1);
  });
});

describe("deleteSelection", () => {
  it("can delete a selection that includes flex child ids", () => {
    const store = makeStore([flexWithChild("f", "c1")], ["c1"]);
    expect(deleteSelection(store)).toBe(true);
    const remaining = elementAt(store, "f");
    expect(remaining).toMatchObject({ type: "flex", children: [] });
    expect(store.getState().selection).toEqual([]);
  });

  it("returns false when the selection is empty", () => {
    const store = makeStore([textElement("a")], []);
    expect(deleteSelection(store)).toBe(false);
  });
});

describe("alignSelection", () => {
  it("returns false with fewer than 2 top-level elements (including a selection of only flex children), and adds no history entry", () => {
    const store = makeStore([textElement("a")], ["a"]);
    expect(alignSelection(store, "left")).toBe(false);
    expect(store.canUndo()).toBe(false);

    const flexStore = makeStore([flexWithChild("f", "c1")], ["c1"]);
    expect(alignSelection(flexStore, "left")).toBe(false);
  });

  it("adds a single history entry on success, and 1 undo reverts all elements", () => {
    const store = makeStore(
      [textElement("a", 10, 10), textElement("b", 60, 40)],
      ["a", "b"],
    );
    expect(alignSelection(store, "left")).toBe(true);
    expect(elementAt(store, "b")).toMatchObject({ x: 10 });

    store.undo();
    expect(elementAt(store, "a")).toMatchObject({ x: 10, y: 10 });
    expect(elementAt(store, "b")).toMatchObject({ x: 60, y: 40 });
    expect(store.canUndo()).toBe(false);
  });
});

describe("distributeSelection", () => {
  it("returns false with fewer than 3 top-level elements", () => {
    const store = makeStore(
      [textElement("a", 0, 0), textElement("b", 20, 0)],
      ["a", "b"],
    );
    expect(distributeSelection(store, "horizontal")).toBe(false);
    expect(store.canUndo()).toBe(false);
  });

  it("commits once on success and reverts with 1 undo", () => {
    const store = makeStore(
      [
        textElement("a", 0, 0),
        textElement("b", 20, 0),
        textElement("c", 60, 0),
      ],
      ["a", "b", "c"],
    );
    expect(distributeSelection(store, "horizontal")).toBe(true);
    expect(store.canUndo()).toBe(true);

    store.undo();
    expect(elementAt(store, "b")).toMatchObject({ x: 20 });
    expect(store.canUndo()).toBe(false);
  });
});

describe("groupSelection / ungroupSelection", () => {
  function twoTextStore(): EditorStore {
    return makeStore([textElement("a"), textElement("b", 60, 60)], ["a", "b"]);
  }

  it("succeeds and adds a group when 2 or more top-level elements are selected", () => {
    const store = twoTextStore();
    expect(groupSelection(store)).toBe(true);
    expect(store.getState().groups).toEqual([
      { id: "group1", memberIds: ["a", "b"] },
    ]);
  });

  it("returns false when 1 or fewer elements are selected", () => {
    const store = makeStore([textElement("a")], ["a"]);
    expect(groupSelection(store)).toBe(false);
    expect(store.getState().groups).toEqual([]);
  });

  it("does not succeed when the selection is only flex child ids (they don't count as top-level)", () => {
    const store = makeStore(
      [flexWithChild("f", "c1"), textElement("a")],
      ["c1", "a"],
    );
    expect(groupSelection(store)).toBe(false);
  });

  it("does not affect history or dirty state", () => {
    const store = twoTextStore();
    groupSelection(store);
    expect(store.canUndo()).toBe(false);
    expect(store.getState().dirty).toBe(false);
  });

  it("can ungroup when the selection intersects a live group", () => {
    const store = twoTextStore();
    groupSelection(store);
    expect(ungroupSelection(store)).toBe(true);
    expect(store.getState().groups).toEqual([]);
  });

  it("returns false when no group intersects the selection", () => {
    const store = twoTextStore();
    expect(ungroupSelection(store)).toBe(false);
  });
});

describe("canGroupSelection / canUngroupSelection", () => {
  it("canGroupSelection is true when 2 or more top-level elements are selected", () => {
    const store = makeStore(
      [textElement("a"), textElement("b", 60, 60)],
      ["a", "b"],
    );
    expect(canGroupSelection(store.getState())).toBe(true);
  });

  it("canGroupSelection is false when only 1 element is selected", () => {
    const store = makeStore([textElement("a")], ["a"]);
    expect(canGroupSelection(store.getState())).toBe(false);
  });

  it("canUngroupSelection is true when the selection intersects a live group", () => {
    const store = makeStore(
      [textElement("a"), textElement("b", 60, 60)],
      ["a", "b"],
    );
    groupSelection(store);
    expect(canUngroupSelection(store.getState())).toBe(true);
  });

  it("returns false when the selection does not intersect a live group", () => {
    const store = makeStore([textElement("a")], ["a"]);
    expect(canUngroupSelection(store.getState())).toBe(false);
  });
});

describe("duplicating/pasting and group reformation", () => {
  it("re-bundles a duplicated group under new ids", () => {
    const store = makeStore(
      [textElement("a"), textElement("b", 60, 60)],
      ["a", "b"],
    );
    groupSelection(store);

    expect(duplicateSelection(store)).toBe(true);
    expect(store.getState().selection).toEqual(["text1", "text2"]);
    expect(store.getState().groups).toContainEqual({
      id: "group2",
      memberIds: ["text1", "text2"],
    });
  });

  it("reverts only the elements on 1 undo after duplicating, leaving the group (outside history) unchanged", () => {
    const store = makeStore(
      [textElement("a"), textElement("b", 60, 60)],
      ["a", "b"],
    );
    groupSelection(store);
    duplicateSelection(store);
    const groupsAfterDuplicate = store.getState().groups;

    store.undo();
    expect(store.getState().document.elements).toHaveLength(2);
    expect(store.getState().groups).toEqual(groupsAfterDuplicate);
  });

  it("reforms the group on cut -> paste", () => {
    const store = makeStore(
      [textElement("a"), textElement("b", 60, 60)],
      ["a", "b"],
    );
    groupSelection(store);

    expect(cutSelection(store)).toBe(true);
    expect(pasteClipboard(store)).toBe(true);
    expect(store.getState().selection).toEqual(["text1", "text2"]);
    expect(store.getState().groups).toContainEqual({
      id: "group2",
      memberIds: ["text1", "text2"],
    });
  });

  it("does not add a group when duplicating a non-group selection", () => {
    const store = makeStore([textElement("a")], ["a"]);
    duplicateSelection(store);
    expect(store.getState().groups).toEqual([]);
  });
});
