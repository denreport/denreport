import type {
  IrDocument,
  IrElement,
  IrFlexChild,
  IrTextElement,
} from "@denreport/core";
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MessagesContext } from "../../i18n/context";
import { en } from "../../i18n/messages/en";
import { ja } from "../../i18n/messages/ja";
import { layoutDocument } from "../../state/geometry";
import { EditorStore } from "../../state/store";
import {
  applicableDescriptors,
  buildBulkDescriptors,
  bulkValueFor,
} from "./bulk-descriptors";
import { MultiElementProperties } from "./MultiElementProperties";

const BULK_DESCRIPTORS = buildBulkDescriptors(ja);

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const T1: IrTextElement = {
  type: "text",
  id: "t1",
  x: 10,
  y: 10,
  pages: "first",
  w: 40,
  h: 8,
  text: "見出し",
  fontSize: 10,
  align: "left",
  lineHeight: 1.25,
};

const T2: IrTextElement = { ...T1, id: "t2", x: 60, text: "見出し2" };

const T3: IrTextElement = {
  ...T1,
  id: "t3",
  x: 110,
  text: "見出し3",
  fontSize: 14,
};

const ELEMENTS: readonly IrElement[] = [
  T1,
  T2,
  T3,
  {
    type: "rect",
    id: "r1",
    x: 10,
    y: 40,
    pages: "first",
    w: 40,
    h: 20,
    borderWidth: 0.3,
  },
  {
    type: "line",
    id: "l1",
    x: 10,
    y: 70,
    pages: "first",
    orientation: "horizontal",
    length: 50,
    thickness: 0.3,
  },
  {
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
  },
  {
    type: "flex",
    id: "f1",
    x: 10,
    y: 200,
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
        text: "子",
        fontSize: 10,
        align: "left",
        lineHeight: 1.25,
      },
    ],
  },
];

function makeDocument(): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements: ELEMENTS,
  };
}

function makeStore(): EditorStore {
  return new EditorStore(makeDocument());
}

function viewsOf(store: EditorStore, ids: readonly string[]) {
  const state = store.getState();
  const layout = layoutDocument(state.document, state.view.pageContext);
  const byId = new Map(layout.map((view) => [view.id, view]));
  return ids.map((id) => {
    const view = byId.get(id);
    if (view === undefined) {
      throw new Error(`view がない: ${id}`);
    }
    return view;
  });
}

describe("applicableDescriptors", () => {
  it("2 text elements yield position and text descriptors", () => {
    const store = makeStore();
    const keys = applicableDescriptors(
      viewsOf(store, ["t1", "t2"]),
      BULK_DESCRIPTORS,
    ).map((d) => d.key);
    expect(keys).toEqual([
      "pages",
      "x",
      "y",
      "w",
      "h",
      "fontSize",
      "align",
      "lineHeight",
    ]);
  });

  it("text + rect narrows down to only pages/x/y/w/h", () => {
    const store = makeStore();
    const keys = applicableDescriptors(
      viewsOf(store, ["t1", "r1"]),
      BULK_DESCRIPTORS,
    ).map((d) => d.key);
    expect(keys).toEqual(["pages", "x", "y", "w", "h"]);
  });

  it("text + table narrows down to x/y and fontSize", () => {
    const store = makeStore();
    const keys = applicableDescriptors(
      viewsOf(store, ["t1", "tbl1"]),
      BULK_DESCRIPTORS,
    ).map((d) => d.key);
    expect(keys).toEqual(["x", "y", "fontSize"]);
  });

  it("line + table narrows down to only x/y since table has no pages", () => {
    const store = makeStore();
    const keys = applicableDescriptors(
      viewsOf(store, ["l1", "tbl1"]),
      BULK_DESCRIPTORS,
    ).map((d) => d.key);
    expect(keys).toEqual(["x", "y"]);
  });

  it("pages/x/y disappear when the selection includes a flex child", () => {
    const store = makeStore();
    const keys = applicableDescriptors(
      viewsOf(store, ["c1", "t1"]),
      BULK_DESCRIPTORS,
    ).map((d) => d.key);
    expect(keys).toEqual(["w", "h", "fontSize", "align", "lineHeight"]);
  });
});

describe("bulkValueFor", () => {
  const fontSize = BULK_DESCRIPTORS.find((d) => d.key === "fontSize");
  if (fontSize === undefined) {
    throw new Error("fontSize ディスクリプタがない");
  }

  it("uniform when all elements' values match", () => {
    expect(bulkValueFor(fontSize, [T1, T2])).toEqual({
      kind: "uniform",
      value: 10,
    });
  });

  it("mixed when values don't match", () => {
    expect(bulkValueFor(fontSize, [T1, T3])).toEqual({ kind: "mixed" });
  });
});

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

function renderSelection(store: EditorStore, ids: readonly string[]): void {
  render(<MultiElementProperties store={store} views={viewsOf(store, ids)} />);
}

function inputByLabel(text: string): HTMLInputElement {
  const label = [...container.querySelectorAll("label")].find(
    (l) => l.textContent === text,
  );
  const forId = label?.getAttribute("for");
  const el =
    forId === null || forId === undefined
      ? null
      : document.getElementById(forId);
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`ラベル "${text}" の入力がない`);
  }
  return el;
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

function blur(el: HTMLElement): void {
  act(() => {
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}

function click(el: Element): void {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function buttonByText(text: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === text,
  );
  if (button === undefined) {
    throw new Error(`ボタンがない: ${text}`);
  }
  return button;
}

function elementById(store: EditorStore, id: string): IrElement | IrFlexChild {
  function visit(
    el: IrElement | IrFlexChild,
  ): IrElement | IrFlexChild | undefined {
    if (el.id === id) {
      return el;
    }
    if (el.type === "flex") {
      for (const child of el.children) {
        const found = visit(child);
        if (found !== undefined) {
          return found;
        }
      }
    }
    return undefined;
  }
  for (const el of store.getState().document.elements) {
    const found = visit(el);
    if (found !== undefined) {
      return found;
    }
  }
  throw new Error(`要素がない: ${id}`);
}

describe("MultiElementProperties", () => {
  it("bulk-changes fontSize for 2 uniform text elements, and one undo reverts both", () => {
    const store = makeStore();
    renderSelection(store, ["t1", "t2"]);
    const fontSizeInput = inputByLabel("文字サイズ");
    expect(fontSizeInput.value).toBe("10.0");

    setValue(fontSizeInput, "14");
    blur(fontSizeInput);
    expect(elementById(store, "t1")).toMatchObject({ fontSize: 14 });
    expect(elementById(store, "t2")).toMatchObject({ fontSize: 14 });

    act(() => {
      store.undo();
    });
    expect(elementById(store, "t1")).toMatchObject({ fontSize: 10 });
    expect(elementById(store, "t2")).toMatchObject({ fontSize: 10 });
  });

  it('shows "混在" for 2 text elements with mixed fontSize, and input overwrites both', () => {
    const store = makeStore();
    renderSelection(store, ["t1", "t3"]);
    const fontSizeInput = inputByLabel("文字サイズ");
    expect(fontSizeInput.value).toBe("");
    expect(fontSizeInput.placeholder).toBe("混在");

    // Even though it's the same as t1's original value (10), it applies to both since it's a commit from a mixed state
    setValue(fontSizeInput, "10");
    blur(fontSizeInput);
    expect(elementById(store, "t1")).toMatchObject({ fontSize: 10 });
    expect(elementById(store, "t3")).toMatchObject({ fontSize: 10 });
  });

  it('no "文字" section for a text + rect selection; only "配置" appears', () => {
    const store = makeStore();
    renderSelection(store, ["t1", "r1"]);
    const headings = [...container.querySelectorAll(".dr-sect-h")].map(
      (h) => h.textContent,
    );
    expect(headings).toEqual(["配置"]);
  });

  it("shows a type badge for a uniform selection, or a count-only header for mixed types", () => {
    const store = makeStore();
    renderSelection(store, ["t1", "t2"]);
    expect(container.querySelector(".dr-type-badge")?.textContent).toBe(
      "テキスト",
    );
    expect(container.textContent).toContain("2 個の要素を選択中");

    renderSelection(store, ["t1", "r1"]);
    expect(container.querySelector(".dr-type-badge")).toBeNull();
    expect(container.textContent).toContain("2 個の要素を選択中");
  });

  it("no history entry added when uniform value is committed unchanged", () => {
    const store = makeStore();
    const document = store.getState().document;
    renderSelection(store, ["t1", "t2"]);
    const fontSizeInput = inputByLabel("文字サイズ");
    setValue(fontSizeInput, "10");
    blur(fontSizeInput);
    expect(store.getState().dirty).toBe(false);
    expect(store.getState().document).toBe(document);
  });

  it('can select "均等" for alignment, applying to all selected elements at once', () => {
    const store = makeStore();
    renderSelection(store, ["t1", "t2"]);
    click(buttonByText("均等"));
    expect(elementById(store, "t1")).toMatchObject({ align: "justify" });
    expect(elementById(store, "t2")).toMatchObject({ align: "justify" });
  });

  it("section headings and count display are in English with the en Provider", () => {
    const store = makeStore();
    render(
      <MessagesContext.Provider value={en}>
        <MultiElementProperties
          store={store}
          views={viewsOf(store, ["t1", "t2"])}
        />
      </MessagesContext.Provider>,
    );
    const headings = [...container.querySelectorAll(".dr-sect-h")].map(
      (h) => h.textContent,
    );
    expect(headings).toEqual(["Placement", "Text"]);
    expect(container.textContent).toContain("2 elements selected");
  });
});
