import type { IrDocument, IrElement } from "@denreport/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditorStore } from "../../state/store";
import type { EditingKeyCommands, EditingKeyEvent } from "./useKeyboardEditing";
import { applyEditingKey } from "./useKeyboardEditing";

function textElement(id: string, x: number, y: number): IrElement {
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

function tableElement(id: string, y: number, continuationY: number): IrElement {
  return {
    type: "table",
    id,
    x: 15,
    y,
    bind: "items",
    columns: [{ key: "c", label: "c", width: 100, align: "left" }],
    rowHeight: 9,
    headerHeight: 9,
    fontSize: 10,
    maxY: 240,
    continuationY,
    minRows: 3,
  };
}

function makeStore(
  elements: readonly IrElement[] = [textElement("a", 12, 23)],
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

function key(
  name: string,
  overrides: Partial<EditingKeyEvent> = {},
): EditingKeyEvent {
  return {
    key: name,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    target: null,
    ...overrides,
  };
}

function elementAt(store: EditorStore, id: string): IrElement | undefined {
  return store.getState().document.elements.find((el) => el.id === id);
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

let commands: EditingKeyCommands;

beforeEach(() => {
  commands = { requestSave: vi.fn(), openShortcutHelp: vi.fn() };
});

describe("矢印キー移動", () => {
  it("スナップ無効時は 1mm 移動", () => {
    const store = makeStore();
    store.setView({ snapEnabled: false });
    expect(applyEditingKey(store, false, commands, key("ArrowRight"))).toBe(
      true,
    );
    expect(elementAt(store, "a")).toMatchObject({ x: 13, y: 23 });
    applyEditingKey(store, false, commands, key("ArrowUp"));
    expect(elementAt(store, "a")).toMatchObject({ x: 13, y: 22 });
  });

  it("Shift+矢印は 0.1mm 移動", () => {
    const store = makeStore();
    expect(
      applyEditingKey(
        store,
        false,
        commands,
        key("ArrowDown", { shiftKey: true }),
      ),
    ).toBe(true);
    expect(elementAt(store, "a")).toMatchObject({ x: 12, y: 23.1 });
  });

  it("スナップ有効時は次の 5mm グリッド線へ量子化して移動する", () => {
    const store = makeStore();
    applyEditingKey(store, false, commands, key("ArrowRight"));
    expect(elementAt(store, "a")).toMatchObject({ x: 15 });
    applyEditingKey(store, false, commands, key("ArrowRight"));
    expect(elementAt(store, "a")).toMatchObject({ x: 20 });
    applyEditingKey(store, false, commands, key("ArrowLeft"));
    expect(elementAt(store, "a")).toMatchObject({ x: 15 });
    applyEditingKey(store, false, commands, key("ArrowUp"));
    expect(elementAt(store, "a")).toMatchObject({ y: 20 });
  });

  it("1回の keydown = 1 履歴エントリ", () => {
    const store = makeStore();
    applyEditingKey(store, false, commands, key("ArrowRight"));
    applyEditingKey(store, false, commands, key("ArrowRight"));
    store.undo();
    expect(elementAt(store, "a")).toMatchObject({ x: 15 });
    store.undo();
    expect(elementAt(store, "a")).toMatchObject({ x: 12 });
  });

  it("選択が空なら何もしない", () => {
    const store = makeStore([textElement("a", 12, 23)], []);
    expect(applyEditingKey(store, false, commands, key("ArrowRight"))).toBe(
      false,
    );
    expect(elementAt(store, "a")).toMatchObject({ x: 12 });
  });

  it("first 文脈: continuationY が y と等値の table は ArrowDown で continuationY も動く", () => {
    const store = makeStore([tableElement("tbl", 90, 90)], ["tbl"]);
    store.setView({ snapEnabled: false });
    applyEditingKey(store, false, commands, key("ArrowDown"));
    expect(elementAt(store, "tbl")).toMatchObject({ y: 91, continuationY: 91 });
  });
});

describe("Delete / Backspace", () => {
  it("選択要素を削除して選択を空にする", () => {
    const store = makeStore();
    expect(applyEditingKey(store, false, commands, key("Delete"))).toBe(true);
    expect(store.getState().document.elements).toEqual([]);
    expect(store.getState().selection).toEqual([]);
  });

  it("Backspace でも削除される", () => {
    const store = makeStore();
    applyEditingKey(store, false, commands, key("Backspace"));
    expect(store.getState().document.elements).toEqual([]);
  });
});

describe("undo / redo ショートカット", () => {
  it("Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y が対応する操作を行う", () => {
    const store = makeStore();
    store.setView({ snapEnabled: false });
    applyEditingKey(store, false, commands, key("ArrowRight"));
    expect(elementAt(store, "a")).toMatchObject({ x: 13 });

    expect(
      applyEditingKey(store, false, commands, key("z", { ctrlKey: true })),
    ).toBe(true);
    expect(elementAt(store, "a")).toMatchObject({ x: 12 });

    expect(
      applyEditingKey(
        store,
        false,
        commands,
        key("Z", { ctrlKey: true, shiftKey: true }),
      ),
    ).toBe(true);
    expect(elementAt(store, "a")).toMatchObject({ x: 13 });

    applyEditingKey(store, false, commands, key("z", { ctrlKey: true }));
    expect(
      applyEditingKey(store, false, commands, key("y", { ctrlKey: true })),
    ).toBe(true);
    expect(elementAt(store, "a")).toMatchObject({ x: 13 });
  });

  it("メタキー（⌘）でも効く", () => {
    const store = makeStore();
    store.setView({ snapEnabled: false });
    applyEditingKey(store, false, commands, key("ArrowRight"));
    expect(
      applyEditingKey(store, false, commands, key("z", { metaKey: true })),
    ).toBe(true);
    expect(elementAt(store, "a")).toMatchObject({ x: 12 });
  });
});

describe("Escape", () => {
  it("ドラッグ中でなければ選択を解除する", () => {
    const store = makeStore();
    expect(applyEditingKey(store, false, commands, key("Escape"))).toBe(true);
    expect(store.getState().selection).toEqual([]);
  });

  it("ドラッグ中はドラッグ側のキャンセルに譲る（false を返す）", () => {
    const store = makeStore();
    expect(applyEditingKey(store, true, commands, key("Escape"))).toBe(false);
    expect(store.getState().selection).toEqual(["a"]);
  });
});

describe("フォーム要素フォーカス中は無視", () => {
  it("input がターゲットのときは何もしない", () => {
    const store = makeStore();
    const input = document.createElement("input");
    expect(
      applyEditingKey(store, false, commands, key("Delete", { target: input })),
    ).toBe(false);
    expect(store.getState().document.elements).toHaveLength(1);
  });

  it("textarea がターゲットのときも何もしない（インライン編集中の Delete）", () => {
    const store = makeStore();
    const textarea = document.createElement("textarea");
    expect(
      applyEditingKey(
        store,
        false,
        commands,
        key("Delete", { target: textarea }),
      ),
    ).toBe(false);
    expect(store.getState().document.elements).toHaveLength(1);
  });

  it("Ctrl+C / Ctrl+X / Ctrl+V も無視される", () => {
    const store = makeStore();
    const input = document.createElement("input");
    expect(
      applyEditingKey(
        store,
        false,
        commands,
        key("c", { ctrlKey: true, target: input }),
      ),
    ).toBe(false);
    expect(
      applyEditingKey(
        store,
        false,
        commands,
        key("x", { ctrlKey: true, target: input }),
      ),
    ).toBe(false);
    expect(
      applyEditingKey(
        store,
        false,
        commands,
        key("v", { ctrlKey: true, target: input }),
      ),
    ).toBe(false);
    expect(store.getState().document.elements).toHaveLength(1);
    expect(store.getClipboard()).toBeNull();
  });
});

describe("Ctrl+C コピー", () => {
  it("選択ありで true・クリップボードに格納・文書と履歴は不変", () => {
    const store = makeStore();
    const before = store.getState().document;

    expect(
      applyEditingKey(store, false, commands, key("c", { ctrlKey: true })),
    ).toBe(true);

    expect(store.getClipboard()?.elements.map((el) => el.id)).toEqual(["a"]);
    expect(store.getState().document).toBe(before);
    expect(store.canUndo()).toBe(false);
  });

  it("メタキー（⌘）でも効く", () => {
    const store = makeStore();
    expect(
      applyEditingKey(store, false, commands, key("c", { metaKey: true })),
    ).toBe(true);
    expect(store.getClipboard()).not.toBeNull();
  });

  it("選択が空なら false", () => {
    const store = makeStore([textElement("a", 12, 23)], []);
    expect(
      applyEditingKey(store, false, commands, key("c", { ctrlKey: true })),
    ).toBe(false);
    expect(store.getClipboard()).toBeNull();
  });

  it("flex 子のみの選択では false", () => {
    const store = makeStore([flexWithChild("f", "c1")], ["c1"]);
    expect(
      applyEditingKey(store, false, commands, key("c", { ctrlKey: true })),
    ).toBe(false);
    expect(store.getClipboard()).toBeNull();
  });
});

describe("Ctrl+X 切り取り", () => {
  it("要素が消え選択が空になり、1回の undo で復元される（1 commit）", () => {
    const store = makeStore();
    expect(
      applyEditingKey(store, false, commands, key("x", { ctrlKey: true })),
    ).toBe(true);
    expect(store.getState().document.elements).toEqual([]);
    expect(store.getState().selection).toEqual([]);
    expect(store.getClipboard()?.elements.map((el) => el.id)).toEqual(["a"]);

    store.undo();
    expect(store.getState().document.elements).toHaveLength(1);
    expect(store.canUndo()).toBe(false);
  });

  it("undo 後もペーストできる", () => {
    const store = makeStore();
    applyEditingKey(store, false, commands, key("x", { ctrlKey: true }));
    store.undo();

    expect(
      applyEditingKey(store, false, commands, key("v", { ctrlKey: true })),
    ).toBe(true);
    expect(store.getState().document.elements).toHaveLength(2);
  });
});

describe("Ctrl+V ペースト", () => {
  it("クリップボードが空なら false", () => {
    const store = makeStore();
    expect(
      applyEditingKey(store, false, commands, key("v", { ctrlKey: true })),
    ).toBe(false);
  });

  it("ペースト後の選択が新要素 id になり、2回のペーストで id が衝突しない", () => {
    const store = makeStore();
    applyEditingKey(store, false, commands, key("c", { ctrlKey: true }));

    expect(
      applyEditingKey(store, false, commands, key("v", { ctrlKey: true })),
    ).toBe(true);
    const firstPastedId = store.getState().selection[0];
    expect(firstPastedId).toBeDefined();
    expect(firstPastedId).not.toBe("a");

    applyEditingKey(store, false, commands, key("v", { ctrlKey: true }));
    const secondPastedId = store.getState().selection[0];
    expect(secondPastedId).not.toBe(firstPastedId);
    expect(store.getState().document.elements).toHaveLength(3);
  });
});

describe("Ctrl+A 全選択", () => {
  it("トップレベル全要素を選択する", () => {
    const store = makeStore(
      [textElement("a", 12, 23), textElement("b", 40, 50)],
      [],
    );
    expect(
      applyEditingKey(store, false, commands, key("a", { ctrlKey: true })),
    ).toBe(true);
    expect(store.getState().selection).toEqual(["a", "b"]);
  });

  it("要素が 0 件なら false", () => {
    const store = makeStore([], []);
    expect(
      applyEditingKey(store, false, commands, key("a", { ctrlKey: true })),
    ).toBe(false);
  });

  it("フォーム要素上では発火しない", () => {
    const store = makeStore([textElement("a", 12, 23)], []);
    const input = document.createElement("input");
    expect(
      applyEditingKey(
        store,
        false,
        commands,
        key("a", { ctrlKey: true, target: input }),
      ),
    ).toBe(false);
    expect(store.getState().selection).toEqual([]);
  });
});

describe("Ctrl+D 複製", () => {
  it("新 id・+5mm オフセットで複製し、選択が新要素になり、store のクリップボードは変化しない", () => {
    const store = makeStore();
    expect(store.getClipboard()).toBeNull();
    expect(
      applyEditingKey(store, false, commands, key("d", { ctrlKey: true })),
    ).toBe(true);
    expect(store.getState().document.elements).toHaveLength(2);
    const pastedId = store.getState().selection[0];
    expect(pastedId).toBeDefined();
    expect(pastedId).not.toBe("a");
    expect(elementAt(store, pastedId ?? "")).toMatchObject({ x: 17, y: 28 });
    expect(store.getClipboard()).toBeNull();
  });

  it("table の continuationY もオフセットされる", () => {
    const store = makeStore([tableElement("tbl", 90, 90)], ["tbl"]);
    applyEditingKey(store, false, commands, key("d", { ctrlKey: true }));
    const pastedId = store.getState().selection[0];
    expect(elementAt(store, pastedId ?? "")).toMatchObject({
      y: 95,
      continuationY: 95,
    });
  });

  it("選択が空なら false", () => {
    const store = makeStore([textElement("a", 12, 23)], []);
    expect(
      applyEditingKey(store, false, commands, key("d", { ctrlKey: true })),
    ).toBe(false);
    expect(store.getState().document.elements).toHaveLength(1);
  });

  it("textarea がターゲット（インライン編集中）では発火しない", () => {
    const store = makeStore();
    const textarea = document.createElement("textarea");
    expect(
      applyEditingKey(
        store,
        false,
        commands,
        key("d", { ctrlKey: true, target: textarea }),
      ),
    ).toBe(false);
    expect(store.getState().document.elements).toHaveLength(1);
  });
});

describe("Ctrl+G グループ化・Ctrl+Shift+G グループ解除", () => {
  it("選択2件以上で成立し、グループが追加される", () => {
    const store = makeStore(
      [textElement("a", 12, 23), textElement("b", 60, 60)],
      ["a", "b"],
    );
    expect(
      applyEditingKey(store, false, commands, key("g", { ctrlKey: true })),
    ).toBe(true);
    expect(store.getState().groups).toEqual([
      { id: "group1", memberIds: ["a", "b"] },
    ]);
  });

  it("選択1件では不成立", () => {
    const store = makeStore([textElement("a", 12, 23)], ["a"]);
    expect(
      applyEditingKey(store, false, commands, key("g", { ctrlKey: true })),
    ).toBe(false);
  });

  it("Ctrl+Shift+G は交差する生存グループを解除する", () => {
    const store = makeStore(
      [textElement("a", 12, 23), textElement("b", 60, 60)],
      ["a", "b"],
    );
    applyEditingKey(store, false, commands, key("g", { ctrlKey: true }));
    expect(
      applyEditingKey(
        store,
        false,
        commands,
        key("g", { ctrlKey: true, shiftKey: true }),
      ),
    ).toBe(true);
    expect(store.getState().groups).toEqual([]);
  });

  it("textarea がターゲット（インライン編集中）では発火しない", () => {
    const store = makeStore(
      [textElement("a", 12, 23), textElement("b", 60, 60)],
      ["a", "b"],
    );
    const textarea = document.createElement("textarea");
    expect(
      applyEditingKey(
        store,
        false,
        commands,
        key("g", { ctrlKey: true, target: textarea }),
      ),
    ).toBe(false);
    expect(store.getState().groups).toEqual([]);
  });
});

describe("Ctrl+S 保存", () => {
  it("requestSave が呼ばれ true が返る（選択なしでも）", () => {
    const store = makeStore([textElement("a", 12, 23)], []);
    expect(
      applyEditingKey(store, false, commands, key("s", { ctrlKey: true })),
    ).toBe(true);
    expect(commands.requestSave).toHaveBeenCalledOnce();
  });
});

describe("ズームショートカット", () => {
  it("Ctrl+「+」「=」でズームインする", () => {
    const store = makeStore();
    expect(
      applyEditingKey(store, false, commands, key("+", { ctrlKey: true })),
    ).toBe(true);
    expect(store.getState().view.zoom).toBe(1.25);
    expect(
      applyEditingKey(store, false, commands, key("=", { ctrlKey: true })),
    ).toBe(true);
    expect(store.getState().view.zoom).toBe(1.5);
  });

  it("Ctrl+「-」でズームアウトする", () => {
    const store = makeStore();
    expect(
      applyEditingKey(store, false, commands, key("-", { ctrlKey: true })),
    ).toBe(true);
    expect(store.getState().view.zoom).toBe(0.75);
  });

  it("端では false になり文書・履歴は変化しない", () => {
    const store = makeStore();
    store.setView({ zoom: 4 });
    expect(
      applyEditingKey(store, false, commands, key("+", { ctrlKey: true })),
    ).toBe(false);
    expect(store.getState().view.zoom).toBe(4);
    expect(store.canUndo()).toBe(false);
  });
});

describe("V / H でのキャンバスモード切替", () => {
  it("v で選択モード、h で移動モードへ切り替わり true を返す", () => {
    const store = makeStore();
    store.setView({ canvasMode: "pan" });
    expect(applyEditingKey(store, false, commands, key("v"))).toBe(true);
    expect(store.getState().view.canvasMode).toBe("select");

    expect(applyEditingKey(store, false, commands, key("h"))).toBe(true);
    expect(store.getState().view.canvasMode).toBe("pan");
  });

  it("Ctrl/⌘+V（貼り付け）は従来どおり動く", () => {
    const store = makeStore();
    applyEditingKey(store, false, commands, key("c", { ctrlKey: true }));
    expect(
      applyEditingKey(store, false, commands, key("v", { ctrlKey: true })),
    ).toBe(true);
    expect(store.getState().view.canvasMode).toBe("select");
    expect(store.getState().document.elements).toHaveLength(2);
  });

  it("フォーム要素発では発火しない", () => {
    const store = makeStore();
    const input = document.createElement("input");
    expect(
      applyEditingKey(store, false, commands, key("h", { target: input })),
    ).toBe(false);
    expect(store.getState().view.canvasMode).toBe("select");
  });

  it("ドラッグ中（interactionActive）では未処理", () => {
    const store = makeStore();
    expect(applyEditingKey(store, true, commands, key("h"))).toBe(false);
    expect(store.getState().view.canvasMode).toBe("select");
  });

  it("Shift 併用では未処理", () => {
    const store = makeStore();
    expect(
      applyEditingKey(store, false, commands, key("h", { shiftKey: true })),
    ).toBe(false);
    expect(store.getState().view.canvasMode).toBe("select");
  });
});

describe("ショートカット一覧を開く", () => {
  it("「?」または F1 で openShortcutHelp が呼ばれる", () => {
    const store = makeStore();
    expect(applyEditingKey(store, false, commands, key("?"))).toBe(true);
    expect(applyEditingKey(store, false, commands, key("F1"))).toBe(true);
    expect(commands.openShortcutHelp).toHaveBeenCalledTimes(2);
  });

  it("Ctrl+「?」では発火しない", () => {
    const store = makeStore();
    expect(
      applyEditingKey(store, false, commands, key("?", { ctrlKey: true })),
    ).toBe(false);
    expect(commands.openShortcutHelp).not.toHaveBeenCalled();
  });
});
