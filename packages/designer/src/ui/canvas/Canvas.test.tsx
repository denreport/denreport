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

describe("Canvas パンモード", () => {
  it("canvasMode が pan のとき viewport に is-pan が付く", () => {
    const store = makeStore();
    store.setView({ canvasMode: "pan" });
    act(() => {
      root.render(<Host store={store} />);
    });
    const viewport = container.querySelector(".apx-viewport");
    expect(viewport?.classList.contains("is-pan")).toBe(true);
  });

  it("paper へのポインタドラッグは viewport のスクロールを動かし、選択・文書は不変。ドラッグ中は is-panning が付く", () => {
    const store = makeStore();
    store.setView({ canvasMode: "pan" });
    act(() => {
      root.render(<Host store={store} />);
    });
    const viewport = container.querySelector(".apx-viewport");
    const paper = container.querySelector(".apx-paper");
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

  it("window への Space keydown で is-pan になり、keyup で戻る", () => {
    const store = makeStore();
    act(() => {
      root.render(<Host store={store} />);
    });
    const viewport = container.querySelector(".apx-viewport");
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

  it("input へフォーカスがある間の Space では変化しない", () => {
    const store = makeStore();
    act(() => {
      root.render(<Host store={store} />);
    });
    const viewport = container.querySelector(".apx-viewport");
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

  it("pan モードの dblclick でインライン編集が開かない", () => {
    const store = makeStore();
    store.setView({ canvasMode: "pan" });
    act(() => {
      root.render(<Host store={store} />);
    });
    const paper = container.querySelector(".apx-paper");
    if (paper === null) {
      throw new Error("paper が見つからない");
    }
    act(() => {
      paper.dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true, clientX: 1, clientY: 1 }),
      );
    });
    expect(container.querySelector(".apx-inline-editor")).toBeNull();
  });
});

describe("Canvas ダブルクリック編集開始", () => {
  it("pointer capture でイベント標的が paper へ固定されていても、実際にカーソル直下にある要素を編集対象にする", () => {
    const store = makeStore();
    act(() => {
      root.render(<Host store={store} />);
    });
    const paper = container.querySelector(".apx-paper");
    const target = container.querySelector('[data-apx-id="a"]');
    if (paper === null || target === null) {
      throw new Error("paper または対象要素が見つからない");
    }

    // setPointerCapture 済みのポインタでは dblclick の target が paper 自身に固定される
    // （実ブラウザの挙動）ため、ここでは document.elementFromPoint 側だけが実際の
    // カーソル位置の要素を返す状況を再現する
    document.elementFromPoint = () => target as HTMLElement;
    act(() => {
      paper.dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true, clientX: 1, clientY: 1 }),
      );
    });

    expect(container.querySelector(".apx-inline-editor")).not.toBeNull();
  });
});

describe("Canvas 表のデータ行セル編集", () => {
  function dblclickCell(row: number, col: number): void {
    const cell = container.querySelector(
      `[data-apx-id="tbl1"] [data-apx-row="${row}"][data-apx-col="${col}"]`,
    );
    const paper = container.querySelector(".apx-paper");
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

  it("セルのダブルクリックで bind 由来の値を表示する入力が開く", () => {
    const store = makeTableStore(
      JSON.stringify({ items: [{ name: "item0" }] }),
    );
    act(() => {
      root.render(<Host store={store} />);
    });
    dblclickCell(0, 0);
    const editor = container.querySelector(".apx-inline-editor");
    expect(editor).not.toBeNull();
    expect((editor as HTMLInputElement).value).toBe("item0");
  });

  it("値を変えて確定すると cellOverrides が1回の commit で反映される", () => {
    const store = makeTableStore(
      JSON.stringify({ items: [{ name: "item0" }] }),
    );
    act(() => {
      root.render(<Host store={store} />);
    });
    dblclickCell(0, 0);
    const editor = container.querySelector(
      ".apx-inline-editor",
    ) as HTMLInputElement;
    setValue(editor, "固定値");
    pressEnter(editor);

    expect(container.querySelector(".apx-inline-editor")).toBeNull();
    const table = store.getState().document.elements[0];
    expect(table?.type === "table" ? table.cellOverrides : undefined).toEqual([
      { row: 0, key: "name", value: "固定値" },
    ]);
    expect(store.getState().dirty).toBe(true);
  });

  it("bind 表示値に改行が含まれていても、覗いて確定しただけなら commit されない", () => {
    const store = makeTableStore(
      JSON.stringify({ items: [{ name: "item0\nline2" }] }),
    );
    act(() => {
      root.render(<Host store={store} />);
    });
    const before = store.getState().document;
    dblclickCell(0, 0);
    const editor = container.querySelector(
      ".apx-inline-editor",
    ) as HTMLInputElement;
    pressEnter(editor);

    expect(store.getState().document).toBe(before);
    expect(store.getState().dirty).toBe(false);
  });

  it("bind 表示値と同じ値で確定すると commit されない", () => {
    const store = makeTableStore(
      JSON.stringify({ items: [{ name: "item0" }] }),
    );
    act(() => {
      root.render(<Host store={store} />);
    });
    const before = store.getState().document;
    dblclickCell(0, 0);
    const editor = container.querySelector(
      ".apx-inline-editor",
    ) as HTMLInputElement;
    setValue(editor, "item0");
    pressEnter(editor);

    expect(store.getState().document).toBe(before);
    expect(store.getState().dirty).toBe(false);
  });
});
