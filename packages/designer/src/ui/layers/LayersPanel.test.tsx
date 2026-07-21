import type { IrDocument, IrElement } from "@denreport/core";
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addElement } from "../../state/elements";
import { EditorStore } from "../../state/store";
import { LayersPanel } from "./LayersPanel";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeDocument(elements: readonly IrElement[]): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements,
  };
}

const FLEX: IrElement = {
  type: "flex",
  id: "f1",
  x: 10,
  y: 10,
  pages: "first",
  direction: "column",
  gap: 2,
  justifyContent: "start",
  alignItems: "start",
  children: [
    {
      type: "text",
      id: "c1",
      w: 40,
      h: 8,
      text: "子1",
      fontSize: 10,
      align: "left",
      lineHeight: 1.25,
    },
    {
      type: "flex",
      id: "f2",
      direction: "row",
      gap: 1,
      justifyContent: "start",
      alignItems: "start",
      children: [{ type: "rect", id: "c2", w: 10, h: 10, borderWidth: 0.3 }],
    },
  ],
};

const REST_TEXT: IrElement = {
  type: "text",
  id: "t1",
  x: 10,
  y: 60,
  pages: "rest",
  w: 40,
  h: 8,
  text: "rest専用",
  fontSize: 10,
  align: "left",
  lineHeight: 1.25,
};

const TABLE: IrElement = {
  type: "table",
  id: "tbl1",
  x: 10,
  y: 90,
  bind: "items",
  columns: [{ key: "col1", label: "列1", width: 40, align: "left" }],
  rowHeight: 8,
  headerHeight: 8,
  fontSize: 10,
  maxY: 240,
  continuationY: 20,
  minRows: 3,
};

function makeStore(
  elements: readonly IrElement[] = [FLEX, REST_TEXT, TABLE],
): EditorStore {
  return new EditorStore(makeDocument(elements));
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
});

function render(node: ReactNode): void {
  act(() => {
    root.render(node);
  });
}

function click(el: Element): void {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function rowEl(id: string): HTMLElement {
  const row = container.querySelector(`[data-dr-layer-id="${id}"]`);
  if (!(row instanceof HTMLElement)) {
    throw new Error(`行がない: ${id}`);
  }
  return row;
}

function rowMain(id: string): HTMLElement {
  const main = rowEl(id).querySelector(".dr-layer-main");
  if (!(main instanceof HTMLElement)) {
    throw new Error(`行本体がない: ${id}`);
  }
  return main;
}

describe("tree rendering", () => {
  it("all elements render as rows", () => {
    const store = makeStore();
    render(<LayersPanel store={store} onReveal={() => {}} />);
    for (const id of ["f1", "c1", "f2", "c2", "t1", "tbl1"]) {
      expect(
        container.querySelector(`[data-dr-layer-id="${id}"]`),
      ).not.toBeNull();
    }
  });

  it("toggling the flex row's caret hides/shows child rows", () => {
    const store = makeStore();
    render(<LayersPanel store={store} onReveal={() => {}} />);
    const caret = rowEl("f1").querySelector(".dr-layer-caret");
    if (caret === null) {
      throw new Error("キャレットがない");
    }
    expect(container.querySelector('[data-dr-layer-id="c1"]')).not.toBeNull();
    click(caret);
    expect(container.querySelector('[data-dr-layer-id="c1"]')).toBeNull();
    click(caret);
    expect(container.querySelector('[data-dr-layer-id="c1"]')).not.toBeNull();
  });

  it("adding an element (commit) adds a row", () => {
    const store = makeStore([TABLE]);
    render(<LayersPanel store={store} onReveal={() => {}} />);
    expect(container.querySelectorAll(".dr-layer-row").length).toBe(1);
    act(() => {
      store.commit(addElement(store.getState().document, REST_TEXT));
    });
    expect(container.querySelectorAll(".dr-layer-row").length).toBe(2);
  });
});

describe("selection sync", () => {
  it("clicking a row selects it singly and calls onReveal", () => {
    const store = makeStore();
    const onReveal = vi.fn();
    render(<LayersPanel store={store} onReveal={onReveal} />);
    click(rowMain("c1"));
    expect(store.getState().selection).toEqual(["c1"]);
    expect(onReveal).toHaveBeenCalledExactlyOnceWith("c1");
  });

  it("clicking a row whose pages differs from the current context switches pageContext", () => {
    const store = makeStore();
    render(<LayersPanel store={store} onReveal={() => {}} />);
    expect(store.getState().view.pageContext).toBe("first");
    click(rowMain("t1"));
    expect(store.getState().view.pageContext).toBe("rest");
    expect(store.getState().selection).toEqual(["t1"]);
  });

  it("clicking a table (pages: null) does not change pageContext", () => {
    const store = makeStore();
    render(<LayersPanel store={store} onReveal={() => {}} />);
    click(rowMain("tbl1"));
    expect(store.getState().view.pageContext).toBe("first");
  });

  it("setSelection adds is-selected to the matching row and auto-expands a collapsed parent flex", () => {
    const store = makeStore();
    render(<LayersPanel store={store} onReveal={() => {}} />);
    const caret = rowEl("f1").querySelector(".dr-layer-caret");
    if (caret === null) {
      throw new Error("キャレットがない");
    }
    click(caret);
    expect(container.querySelector('[data-dr-layer-id="c1"]')).toBeNull();

    act(() => {
      store.setSelection(["c1"]);
    });
    expect(rowEl("c1").className).toContain("is-selected");
    expect(container.querySelector('[data-dr-layer-id="c1"]')).not.toBeNull();
  });
});

describe("deletion", () => {
  it("the delete button removes the element from the document and removes its id from selection", () => {
    const store = makeStore();
    render(<LayersPanel store={store} onReveal={() => {}} />);
    act(() => {
      store.setSelection(["c1"]);
    });
    const del = rowEl("c1").querySelector(".dr-layer-del");
    if (del === null) {
      throw new Error("削除ボタンがない");
    }
    click(del);
    expect(store.getState().selection).toEqual([]);
    expect(container.querySelector('[data-dr-layer-id="c1"]')).toBeNull();
    const flex = store
      .getState()
      .document.elements.find((el) => el.id === "f1");
    expect(flex?.type === "flex" ? flex.children.length : -1).toBe(1);
  });
});
