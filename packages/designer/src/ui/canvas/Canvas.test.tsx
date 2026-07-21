import type { IrDocument, IrElement } from "@denreport/core";
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditorStore } from "../../state/store";
import { Canvas } from "./Canvas";
import { useCanvasInteraction } from "./useCanvasInteraction";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function textElement(id: string): IrElement {
  return {
    type: "text",
    id,
    x: 12,
    y: 23,
    pages: "first",
    w: 40,
    h: 8,
    text: id,
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  };
}

function makeStore(): EditorStore {
  const document: IrDocument = {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements: [textElement("a")],
  };
  const store = new EditorStore(document);
  store.setSelection(["a"]);
  return store;
}

function tableElement(id: string): IrElement {
  return {
    type: "table",
    id,
    x: 10,
    y: 10,
    bind: "items",
    columns: [{ key: "name", label: "品目", width: 50, align: "left" }],
    rowHeight: 8,
    headerHeight: 8,
    fontSize: 10,
    maxY: 100,
    continuationY: 10,
    minRows: 2,
  };
}

function makeTableStore(sampleData: string): EditorStore {
  const document: IrDocument = {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements: [tableElement("tbl1")],
  };
  return new EditorStore(document, sampleData);
}

function setValue(el: HTMLInputElement, value: string): void {
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function pressEnter(el: HTMLElement): void {
  act(() => {
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
  });
}

function Host(props: { readonly store: EditorStore }): ReactNode {
  const interaction = useCanvasInteraction(props.store);
  return (
    <Canvas
      store={props.store}
      interaction={interaction}
      revealRef={{ current: null }}
    />
  );
}

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  Reflect.deleteProperty(document, "elementFromPoint");
});

describe("Canvas pan mode", () => {
  it("adds is-pan to the viewport when canvasMode is pan", () => {
    const store = makeStore();
    store.setView({ canvasMode: "pan" });
    act(() => {
      root.render(<Host store={store} />);
    });
    const viewport = container.querySelector(".dr-viewport");
    expect(viewport?.classList.contains("is-pan")).toBe(true);
  });

  it("dragging the pointer over paper scrolls the viewport while selection and document stay unchanged; is-panning is added during the drag", () => {
    const store = makeStore();
    store.setView({ canvasMode: "pan" });
    act(() => {
      root.render(<Host store={store} />);
    });
    const viewport = container.querySelector(".dr-viewport");
    const paper = container.querySelector(".dr-paper");
    if (viewport === null || paper === null) {
      throw new Error("viewport または paper が見つからない");
    }
    viewport.scrollLeft = 100;
    viewport.scrollTop = 80;
    const beforeDocument = store.getState().document;
    const beforeSelection = store.getState().selection;

    act(() => {
      paper.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: 50,
          clientY: 40,
          button: 0,
        }),
      );
    });
    expect(viewport.classList.contains("is-panning")).toBe(true);

    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointermove", { clientX: 30, clientY: 10 }),
      );
    });
    expect(viewport.scrollLeft).toBe(120);
    expect(viewport.scrollTop).toBe(110);

    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointerup", { clientX: 30, clientY: 10 }),
      );
    });
    expect(viewport.classList.contains("is-panning")).toBe(false);
    expect(store.getState().document).toBe(beforeDocument);
    expect(store.getState().selection).toEqual(beforeSelection);
  });

  it("a Space keydown on window turns on is-pan, and keyup reverts it", () => {
    const store = makeStore();
    act(() => {
      root.render(<Host store={store} />);
    });
    const viewport = container.querySelector(".dr-viewport");
    expect(viewport?.classList.contains("is-pan")).toBe(false);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: " ",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(viewport?.classList.contains("is-pan")).toBe(true);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keyup", { key: " ", bubbles: true }),
      );
    });
    expect(viewport?.classList.contains("is-pan")).toBe(false);
  });

  it("Space doesn't change anything while an input is focused", () => {
    const store = makeStore();
    act(() => {
      root.render(<Host store={store} />);
    });
    const viewport = container.querySelector(".dr-viewport");
    const input = document.createElement("input");
    document.body.append(input);

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: " ",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(viewport?.classList.contains("is-pan")).toBe(false);
    input.remove();
  });

  it("dblclick in pan mode doesn't open inline editing", () => {
    const store = makeStore();
    store.setView({ canvasMode: "pan" });
    act(() => {
      root.render(<Host store={store} />);
    });
    const paper = container.querySelector(".dr-paper");
    if (paper === null) {
      throw new Error("paper が見つからない");
    }
    act(() => {
      paper.dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true, clientX: 1, clientY: 1 }),
      );
    });
    expect(container.querySelector(".dr-inline-editor")).toBeNull();
  });
});

describe("Canvas double-click starts editing", () => {
  it("targets the element actually under the cursor for editing even when pointer capture pins the event target to paper", () => {
    const store = makeStore();
    act(() => {
      root.render(<Host store={store} />);
    });
    const paper = container.querySelector(".dr-paper");
    const target = container.querySelector('[data-dr-id="a"]');
    if (paper === null || target === null) {
      throw new Error("paper または対象要素が見つからない");
    }

    // For a pointer that already has setPointerCapture, dblclick's target is pinned to paper
    // itself (real browser behavior), so here we reproduce the situation where only
    // document.elementFromPoint returns the element actually at the cursor position
    document.elementFromPoint = () => target as HTMLElement;
    act(() => {
      paper.dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true, clientX: 1, clientY: 1 }),
      );
    });

    expect(container.querySelector(".dr-inline-editor")).not.toBeNull();
  });
});

describe("Canvas table data-row cell editing", () => {
  function dblclickCell(row: number, col: number): void {
    const cell = container.querySelector(
      `[data-dr-id="tbl1"] [data-dr-row="${row}"][data-dr-col="${col}"]`,
    );
    const paper = container.querySelector(".dr-paper");
    if (cell === null || paper === null) {
      throw new Error("セルまたは paper が見つからない");
    }
    document.elementFromPoint = () => cell as HTMLElement;
    act(() => {
      paper.dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true, clientX: 1, clientY: 1 }),
      );
    });
  }

  it("double-clicking a cell opens an input showing the bind-derived value", () => {
    const store = makeTableStore(
      JSON.stringify({ items: [{ name: "item0" }] }),
    );
    act(() => {
      root.render(<Host store={store} />);
    });
    dblclickCell(0, 0);
    const editor = container.querySelector(".dr-inline-editor");
    expect(editor).not.toBeNull();
    expect((editor as HTMLInputElement).value).toBe("item0");
  });

  it("changing the value and committing reflects it in cellOverrides with a single commit", () => {
    const store = makeTableStore(
      JSON.stringify({ items: [{ name: "item0" }] }),
    );
    act(() => {
      root.render(<Host store={store} />);
    });
    dblclickCell(0, 0);
    const editor = container.querySelector(
      ".dr-inline-editor",
    ) as HTMLInputElement;
    setValue(editor, "固定値");
    pressEnter(editor);

    expect(container.querySelector(".dr-inline-editor")).toBeNull();
    const table = store.getState().document.elements[0];
    expect(table?.type === "table" ? table.cellOverrides : undefined).toEqual([
      { row: 0, key: "name", value: "固定値" },
    ]);
    expect(store.getState().dirty).toBe(true);
  });

  it("even when the bind display value contains a newline, simply peeking and confirming doesn't commit", () => {
    const store = makeTableStore(
      JSON.stringify({ items: [{ name: "item0\nline2" }] }),
    );
    act(() => {
      root.render(<Host store={store} />);
    });
    const before = store.getState().document;
    dblclickCell(0, 0);
    const editor = container.querySelector(
      ".dr-inline-editor",
    ) as HTMLInputElement;
    pressEnter(editor);

    expect(store.getState().document).toBe(before);
    expect(store.getState().dirty).toBe(false);
  });

  it("doesn't commit when confirming with the same value as the bind display value", () => {
    const store = makeTableStore(
      JSON.stringify({ items: [{ name: "item0" }] }),
    );
    act(() => {
      root.render(<Host store={store} />);
    });
    const before = store.getState().document;
    dblclickCell(0, 0);
    const editor = container.querySelector(
      ".dr-inline-editor",
    ) as HTMLInputElement;
    setValue(editor, "item0");
    pressEnter(editor);

    expect(store.getState().document).toBe(before);
    expect(store.getState().dirty).toBe(false);
  });
});

describe("Canvas cell range selection", () => {
  const MM = 3.78; // MM_TO_PX (zoom 1)

  function firePointer(
    target: Element,
    type: string,
    xMm: number,
    yMm: number,
    shiftKey = false,
  ): void {
    act(() => {
      target.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX: xMm * MM,
          clientY: yMm * MM,
          button: 0,
          pointerId: 1,
          shiftKey,
        }),
      );
    });
  }

  beforeEach(() => {
    // jsdom does not implement setPointerCapture, so stub it out to neutralize the onPointerDown call
    HTMLElement.prototype.setPointerCapture ??= () => {};
    HTMLElement.prototype.hasPointerCapture ??= () => false;
  });

  it("dragging while the table is already selected selects a cell range; the table doesn't move and the highlight remains", () => {
    const store = makeTableStore("{}");
    store.setSelection(["tbl1"]);
    act(() => {
      root.render(<Host store={store} />);
    });
    const paper = container.querySelector(".dr-paper");
    const tableEl = container.querySelector('[data-dr-id="tbl1"]');
    if (paper === null || tableEl === null) {
      throw new Error("paper または表が見つからない");
    }
    const beforeDocument = store.getState().document;

    // tbl1: box x10 y10 w50 h24 (headerHeight8 + minRows2 * rowHeight8)
    // pointerdown resolves data-dr-id from e.target, so it's fired on the table element
    firePointer(tableEl, "pointerdown", 35, 22); // row0
    firePointer(paper, "pointermove", 35, 30); // row1
    expect(container.querySelector(".dr-cell-sel")).not.toBeNull();
    firePointer(paper, "pointerup", 35, 30);

    const box = container.querySelector(".dr-cell-sel") as HTMLElement;
    expect(box).not.toBeNull();
    expect(box.style.getPropertyValue("--y")).toBe("18");
    expect(box.style.getPropertyValue("--h")).toBe("16");
    expect(store.getState().document).toBe(beforeDocument);
    expect(store.getState().selection).toEqual(["tbl1"]);
  });

  it("Shift+pointerdown extends the existing selection rectangle", () => {
    const store = makeTableStore("{}");
    store.setSelection(["tbl1"]);
    act(() => {
      root.render(<Host store={store} />);
    });
    const paper = container.querySelector(".dr-paper");
    const tableEl = container.querySelector('[data-dr-id="tbl1"]');
    if (paper === null || tableEl === null) {
      throw new Error("paper または表が見つからない");
    }

    firePointer(tableEl, "pointerdown", 35, 22); // row0
    firePointer(paper, "pointerup", 35, 22);
    const initial = container.querySelector(".dr-cell-sel") as HTMLElement;
    expect(initial.style.getPropertyValue("--h")).toBe("8");

    firePointer(tableEl, "pointerdown", 35, 30, true); // shift + row1
    firePointer(paper, "pointerup", 35, 30);
    const extended = container.querySelector(".dr-cell-sel") as HTMLElement;
    expect(extended.style.getPropertyValue("--y")).toBe("18");
    expect(extended.style.getPropertyValue("--h")).toBe("16");
  });

  it("the highlight disappears when the table is deselected", () => {
    const store = makeTableStore("{}");
    store.setSelection(["tbl1"]);
    act(() => {
      root.render(<Host store={store} />);
    });
    const paper = container.querySelector(".dr-paper");
    const tableEl = container.querySelector('[data-dr-id="tbl1"]');
    if (paper === null || tableEl === null) {
      throw new Error("paper または表が見つからない");
    }

    firePointer(tableEl, "pointerdown", 35, 22);
    firePointer(paper, "pointerup", 35, 22);
    expect(container.querySelector(".dr-cell-sel")).not.toBeNull();

    act(() => {
      store.setSelection([]);
    });
    expect(container.querySelector(".dr-cell-sel")).toBeNull();
  });
});
