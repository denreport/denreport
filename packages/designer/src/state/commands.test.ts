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
    font: { name: "NotoSansJP" },
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
  it("選択ありで true・クリップボード格納・文書/履歴不変", () => {
    const store = makeStore();
    const before = store.getState().document;

    expect(copySelection(store)).toBe(true);

    expect(store.getClipboard()?.elements.map((el) => el.id)).toEqual(["a"]);
    expect(store.getState().document).toBe(before);
    expect(store.canUndo()).toBe(false);
  });

  it("選択が空なら false", () => {
    const store = makeStore([textElement("a")], []);
    expect(copySelection(store)).toBe(false);
    expect(store.getClipboard()).toBeNull();
  });
});

describe("cutSelection", () => {
  it("1回の undo で復元される（1 commit）", () => {
    const store = makeStore();
    expect(cutSelection(store)).toBe(true);
    expect(store.getState().document.elements).toEqual([]);

    store.undo();
    expect(store.getState().document.elements).toHaveLength(1);
    expect(store.canUndo()).toBe(false);
  });

  it("undo 後もクリップボードが残る", () => {
    const store = makeStore();
    cutSelection(store);
    store.undo();
    expect(store.getClipboard()?.elements.map((el) => el.id)).toEqual(["a"]);
  });
});

describe("pasteClipboard", () => {
  it("クリップボードが空なら false", () => {
    const store = makeStore();
    expect(pasteClipboard(store)).toBe(false);
  });

  it("貼り付け後の選択が新 id になり、連続実行でオフセットが累積する", () => {
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
  it("複製後も getClipboard() が実行前と同一参照のまま（不変）", () => {
    const store = makeStore();
    expect(store.getClipboard()).toBeNull();

    expect(duplicateSelection(store)).toBe(true);
    expect(store.getClipboard()).toBeNull();
  });

  it("保存済みクリップボードを汚さない", () => {
    const store = makeStore([textElement("a"), textElement("b", 60, 60)]);
    store.setSelection(["b"]);
    copySelection(store);
    const clipboardBefore = store.getClipboard();

    store.setSelection(["a"]);
    duplicateSelection(store);

    expect(store.getClipboard()).toBe(clipboardBefore);
  });

  it("選択が複製結果に移り、5mm オフセットが付き、1 undo で戻る", () => {
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

  it("flex 子のみの選択では false", () => {
    const store = makeStore([flexWithChild("f", "c1")], ["c1"]);
    expect(duplicateSelection(store)).toBe(false);
    expect(store.getState().document.elements).toHaveLength(1);
  });
});

describe("deleteSelection", () => {
  it("flex 子 id を含む選択が削除できる", () => {
    const store = makeStore([flexWithChild("f", "c1")], ["c1"]);
    expect(deleteSelection(store)).toBe(true);
    const remaining = elementAt(store, "f");
    expect(remaining).toMatchObject({ type: "flex", children: [] });
    expect(store.getState().selection).toEqual([]);
  });

  it("選択が空なら false", () => {
    const store = makeStore([textElement("a")], []);
    expect(deleteSelection(store)).toBe(false);
  });
});

describe("alignSelection", () => {
  it("トップレベル2未満（flex 子のみの選択を含む）で false・履歴が積まれない", () => {
    const store = makeStore([textElement("a")], ["a"]);
    expect(alignSelection(store, "left")).toBe(false);
    expect(store.canUndo()).toBe(false);

    const flexStore = makeStore([flexWithChild("f", "c1")], ["c1"]);
    expect(alignSelection(flexStore, "left")).toBe(false);
  });

  it("成功時に履歴が1エントリで、undo 1回で全要素が元に戻る", () => {
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
  it("トップレベル3未満で false", () => {
    const store = makeStore(
      [textElement("a", 0, 0), textElement("b", 20, 0)],
      ["a", "b"],
    );
    expect(distributeSelection(store, "horizontal")).toBe(false);
    expect(store.canUndo()).toBe(false);
  });

  it("成功時 1 commit で undo 1回で戻る", () => {
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

  it("選択が2以上のトップレベル要素なら成立し、グループが追加される", () => {
    const store = twoTextStore();
    expect(groupSelection(store)).toBe(true);
    expect(store.getState().groups).toEqual([
      { id: "group1", memberIds: ["a", "b"] },
    ]);
  });

  it("選択が1件以下なら false", () => {
    const store = makeStore([textElement("a")], ["a"]);
    expect(groupSelection(store)).toBe(false);
    expect(store.getState().groups).toEqual([]);
  });

  it("flex 子 id は対象外で成立しない", () => {
    const store = makeStore(
      [flexWithChild("f", "c1"), textElement("a")],
      ["c1", "a"],
    );
    expect(groupSelection(store)).toBe(false);
  });

  it("履歴・dirty に影響しない", () => {
    const store = twoTextStore();
    groupSelection(store);
    expect(store.canUndo()).toBe(false);
    expect(store.getState().dirty).toBe(false);
  });

  it("交差する生存グループがあれば解除できる", () => {
    const store = twoTextStore();
    groupSelection(store);
    expect(ungroupSelection(store)).toBe(true);
    expect(store.getState().groups).toEqual([]);
  });

  it("交差するグループがなければ false", () => {
    const store = twoTextStore();
    expect(ungroupSelection(store)).toBe(false);
  });
});

describe("canGroupSelection / canUngroupSelection", () => {
  it("トップレベル選択が2以上なら canGroupSelection は true", () => {
    const store = makeStore(
      [textElement("a"), textElement("b", 60, 60)],
      ["a", "b"],
    );
    expect(canGroupSelection(store.getState())).toBe(true);
  });

  it("選択が1件なら canGroupSelection は false", () => {
    const store = makeStore([textElement("a")], ["a"]);
    expect(canGroupSelection(store.getState())).toBe(false);
  });

  it("選択が生存グループと交差すれば canUngroupSelection は true", () => {
    const store = makeStore(
      [textElement("a"), textElement("b", 60, 60)],
      ["a", "b"],
    );
    groupSelection(store);
    expect(canUngroupSelection(store.getState())).toBe(true);
  });

  it("生存グループと交差しなければ false", () => {
    const store = makeStore([textElement("a")], ["a"]);
    expect(canUngroupSelection(store.getState())).toBe(false);
  });
});

describe("複製・貼り付けとグループの再形成", () => {
  it("グループを複製すると新 id で束なる", () => {
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

  it("複製で1 undo すると要素だけ戻り、グループ（履歴外）はそのまま残る", () => {
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

  it("cut → paste でグループが再形成される", () => {
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

  it("グループでない選択の複製ではグループを追加しない", () => {
    const store = makeStore([textElement("a")], ["a"]);
    duplicateSelection(store);
    expect(store.getState().groups).toEqual([]);
  });
});
