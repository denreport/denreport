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
    font: { regular: "NotoSansJP" },
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

describe("Arrow-key move", () => {
  it("moves 1mm when snapping is disabled", () => {
    const store = makeStore();
    store.setView({ snapEnabled: false });
    expect(applyEditingKey(store, false, commands, key("ArrowRight"))).toBe(
      true,
    );
    expect(elementAt(store, "a")).toMatchObject({ x: 13, y: 23 });
    applyEditingKey(store, false, commands, key("ArrowUp"));
    expect(elementAt(store, "a")).toMatchObject({ x: 13, y: 22 });
  });

  it("shift+arrow moves 0.1mm", () => {
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

  it("quantizes to the next 5mm grid line when snapping is enabled", () => {
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

  it("one keydown equals one history entry", () => {
    const store = makeStore();
    applyEditingKey(store, false, commands, key("ArrowRight"));
    applyEditingKey(store, false, commands, key("ArrowRight"));
    store.undo();
    expect(elementAt(store, "a")).toMatchObject({ x: 15 });
    store.undo();
    expect(elementAt(store, "a")).toMatchObject({ x: 12 });
  });

  it("does nothing when the selection is empty", () => {
    const store = makeStore([textElement("a", 12, 23)], []);
    expect(applyEditingKey(store, false, commands, key("ArrowRight"))).toBe(
      false,
    );
    expect(elementAt(store, "a")).toMatchObject({ x: 12 });
  });

  it("first context: ArrowDown also moves continuationY for a table whose continuationY equals y", () => {
    const store = makeStore([tableElement("tbl", 90, 90)], ["tbl"]);
    store.setView({ snapEnabled: false });
    applyEditingKey(store, false, commands, key("ArrowDown"));
    expect(elementAt(store, "tbl")).toMatchObject({ y: 91, continuationY: 91 });
  });
});

describe("Delete / Backspace", () => {
  it("deletes the selected elements and clears the selection", () => {
    const store = makeStore();
    expect(applyEditingKey(store, false, commands, key("Delete"))).toBe(true);
    expect(store.getState().document.elements).toEqual([]);
    expect(store.getState().selection).toEqual([]);
  });

  it("Backspace also deletes", () => {
    const store = makeStore();
    applyEditingKey(store, false, commands, key("Backspace"));
    expect(store.getState().document.elements).toEqual([]);
  });
});

describe("undo / redo shortcuts", () => {
  it("Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y perform the corresponding operations", () => {
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

  it("also works with the meta key (⌘)", () => {
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
  it("clears the selection when not dragging", () => {
    const store = makeStore();
    expect(applyEditingKey(store, false, commands, key("Escape"))).toBe(true);
    expect(store.getState().selection).toEqual([]);
  });

  it("defers to the drag's own cancel while dragging (returns false)", () => {
    const store = makeStore();
    expect(applyEditingKey(store, true, commands, key("Escape"))).toBe(false);
    expect(store.getState().selection).toEqual(["a"]);
  });
});

describe("Ignored while a form element is focused", () => {
  it("does nothing when the target is an input", () => {
    const store = makeStore();
    const input = document.createElement("input");
    expect(
      applyEditingKey(store, false, commands, key("Delete", { target: input })),
    ).toBe(false);
    expect(store.getState().document.elements).toHaveLength(1);
  });

  it("does nothing when the target is a textarea either (Delete during inline editing)", () => {
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

  it("Ctrl+C / Ctrl+X / Ctrl+V are also ignored", () => {
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

describe("Ctrl+C copy", () => {
  it("returns true with a selection, stores to the clipboard, and leaves the document and history unchanged", () => {
    const store = makeStore();
    const before = store.getState().document;

    expect(
      applyEditingKey(store, false, commands, key("c", { ctrlKey: true })),
    ).toBe(true);

    expect(store.getClipboard()?.elements.map((el) => el.id)).toEqual(["a"]);
    expect(store.getState().document).toBe(before);
    expect(store.canUndo()).toBe(false);
  });

  it("also works with the meta key (⌘)", () => {
    const store = makeStore();
    expect(
      applyEditingKey(store, false, commands, key("c", { metaKey: true })),
    ).toBe(true);
    expect(store.getClipboard()).not.toBeNull();
  });

  it("returns false when the selection is empty", () => {
    const store = makeStore([textElement("a", 12, 23)], []);
    expect(
      applyEditingKey(store, false, commands, key("c", { ctrlKey: true })),
    ).toBe(false);
    expect(store.getClipboard()).toBeNull();
  });

  it("returns false when only flex children are selected", () => {
    const store = makeStore([flexWithChild("f", "c1")], ["c1"]);
    expect(
      applyEditingKey(store, false, commands, key("c", { ctrlKey: true })),
    ).toBe(false);
    expect(store.getClipboard()).toBeNull();
  });
});

describe("Ctrl+X cut", () => {
  it("the element disappears and the selection clears, restored by a single undo (1 commit)", () => {
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

  it("can still paste after undo", () => {
    const store = makeStore();
    applyEditingKey(store, false, commands, key("x", { ctrlKey: true }));
    store.undo();

    expect(
      applyEditingKey(store, false, commands, key("v", { ctrlKey: true })),
    ).toBe(true);
    expect(store.getState().document.elements).toHaveLength(2);
  });
});

describe("Ctrl+V paste", () => {
  it("returns false when the clipboard is empty", () => {
    const store = makeStore();
    expect(
      applyEditingKey(store, false, commands, key("v", { ctrlKey: true })),
    ).toBe(false);
  });

  it("the selection after paste becomes the new element's id, and two pastes don't collide on id", () => {
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

describe("Ctrl+A select all", () => {
  it("selects all top-level elements", () => {
    const store = makeStore(
      [textElement("a", 12, 23), textElement("b", 40, 50)],
      [],
    );
    expect(
      applyEditingKey(store, false, commands, key("a", { ctrlKey: true })),
    ).toBe(true);
    expect(store.getState().selection).toEqual(["a", "b"]);
  });

  it("returns false when there are 0 elements", () => {
    const store = makeStore([], []);
    expect(
      applyEditingKey(store, false, commands, key("a", { ctrlKey: true })),
    ).toBe(false);
  });

  it("doesn't fire on a form element", () => {
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

describe("Ctrl+D duplicate", () => {
  it("duplicates with a new id and +5mm offset, selects the new element, and leaves the store's clipboard unchanged", () => {
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

  it("table's continuationY is offset too", () => {
    const store = makeStore([tableElement("tbl", 90, 90)], ["tbl"]);
    applyEditingKey(store, false, commands, key("d", { ctrlKey: true }));
    const pastedId = store.getState().selection[0];
    expect(elementAt(store, pastedId ?? "")).toMatchObject({
      y: 95,
      continuationY: 95,
    });
  });

  it("returns false when the selection is empty", () => {
    const store = makeStore([textElement("a", 12, 23)], []);
    expect(
      applyEditingKey(store, false, commands, key("d", { ctrlKey: true })),
    ).toBe(false);
    expect(store.getState().document.elements).toHaveLength(1);
  });

  it("doesn't fire when the target is a textarea (inline editing)", () => {
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

describe("Ctrl+G group / Ctrl+Shift+G ungroup", () => {
  it("succeeds with 2 or more selected and adds a group", () => {
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

  it("fails with only 1 selected", () => {
    const store = makeStore([textElement("a", 12, 23)], ["a"]);
    expect(
      applyEditingKey(store, false, commands, key("g", { ctrlKey: true })),
    ).toBe(false);
  });

  it("Ctrl+Shift+G ungroups intersecting surviving groups", () => {
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

  it("doesn't fire when the target is a textarea (inline editing)", () => {
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

describe("Ctrl+S save", () => {
  it("calls requestSave and returns true (even with no selection)", () => {
    const store = makeStore([textElement("a", 12, 23)], []);
    expect(
      applyEditingKey(store, false, commands, key("s", { ctrlKey: true })),
    ).toBe(true);
    expect(commands.requestSave).toHaveBeenCalledOnce();
  });
});

describe("Zoom shortcuts", () => {
  it('Ctrl+"+"/"=" zooms in', () => {
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

  it('Ctrl+"-" zooms out', () => {
    const store = makeStore();
    expect(
      applyEditingKey(store, false, commands, key("-", { ctrlKey: true })),
    ).toBe(true);
    expect(store.getState().view.zoom).toBe(0.75);
  });

  it("returns false at the limit and leaves the document/history unchanged", () => {
    const store = makeStore();
    store.setView({ zoom: 4 });
    expect(
      applyEditingKey(store, false, commands, key("+", { ctrlKey: true })),
    ).toBe(false);
    expect(store.getState().view.zoom).toBe(4);
    expect(store.canUndo()).toBe(false);
  });
});

describe("Canvas mode switching via V / H", () => {
  it("v switches to select mode, h to pan mode, returning true", () => {
    const store = makeStore();
    store.setView({ canvasMode: "pan" });
    expect(applyEditingKey(store, false, commands, key("v"))).toBe(true);
    expect(store.getState().view.canvasMode).toBe("select");

    expect(applyEditingKey(store, false, commands, key("h"))).toBe(true);
    expect(store.getState().view.canvasMode).toBe("pan");
  });

  it("Ctrl/⌘+V (paste) still works as before", () => {
    const store = makeStore();
    applyEditingKey(store, false, commands, key("c", { ctrlKey: true }));
    expect(
      applyEditingKey(store, false, commands, key("v", { ctrlKey: true })),
    ).toBe(true);
    expect(store.getState().view.canvasMode).toBe("select");
    expect(store.getState().document.elements).toHaveLength(2);
  });

  it("doesn't fire on a form element", () => {
    const store = makeStore();
    const input = document.createElement("input");
    expect(
      applyEditingKey(store, false, commands, key("h", { target: input })),
    ).toBe(false);
    expect(store.getState().view.canvasMode).toBe("select");
  });

  it("isn't handled while dragging (interactionActive)", () => {
    const store = makeStore();
    expect(applyEditingKey(store, true, commands, key("h"))).toBe(false);
    expect(store.getState().view.canvasMode).toBe("select");
  });

  it("isn't handled when combined with Shift", () => {
    const store = makeStore();
    expect(
      applyEditingKey(store, false, commands, key("h", { shiftKey: true })),
    ).toBe(false);
    expect(store.getState().view.canvasMode).toBe("select");
  });
});

describe("Opening the shortcut list", () => {
  it('"?" or F1 calls openShortcutHelp', () => {
    const store = makeStore();
    expect(applyEditingKey(store, false, commands, key("?"))).toBe(true);
    expect(applyEditingKey(store, false, commands, key("F1"))).toBe(true);
    expect(commands.openShortcutHelp).toHaveBeenCalledTimes(2);
  });

  it('Ctrl+"?" doesn\'t fire', () => {
    const store = makeStore();
    expect(
      applyEditingKey(store, false, commands, key("?", { ctrlKey: true })),
    ).toBe(false);
    expect(commands.openShortcutHelp).not.toHaveBeenCalled();
  });
});
