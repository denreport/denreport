import type { IrDocument, IrElement } from "@denreport/core";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MessagesContext } from "../../i18n/context";
import { en } from "../../i18n/messages/en";
import { EditorStore } from "../../state/store";
import { StatusBar } from "./StatusBar";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const TEXT_EL: IrElement = {
  type: "text",
  id: "t1",
  x: 10,
  y: 10,
  pages: "first",
  w: 40,
  h: 8,
  text: "a",
  fontSize: 10,
  align: "left",
  lineHeight: 1.25,
};

function makeStore(elements: readonly IrElement[]): EditorStore {
  const document: IrDocument = {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements,
  };
  return new EditorStore(document);
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

describe("StatusBar", () => {
  it("shows the text type and coordinates for a single selection", () => {
    const store = makeStore([TEXT_EL]);
    store.setSelection(["t1"]);
    act(() => {
      root.render(<StatusBar store={store} cursorMm={null} />);
    });
    expect(container.textContent).toContain("選択: ");
    expect(container.textContent).toContain("（テキスト）");
  });

  it("shows the count for a multi-selection", () => {
    const store = makeStore([TEXT_EL, { ...TEXT_EL, id: "t2" }]);
    store.setSelection(["t1", "t2"]);
    act(() => {
      root.render(<StatusBar store={store} cursorMm={null} />);
    });
    expect(container.textContent).toContain("選択: 2個");
  });

  it("switches the saved-status text based on dirty state", () => {
    const store = makeStore([]);
    act(() => {
      root.render(<StatusBar store={store} cursorMm={null} />);
    });
    expect(container.querySelector(".dr-statusbar-saved")?.textContent).toBe(
      "保存済み",
    );
    act(() => {
      store.commit({ ...store.getState().document, elements: [TEXT_EL] });
    });
    expect(container.querySelector(".dr-statusbar-saved")?.textContent).toBe(
      "未保存の変更あり",
    );
  });

  it("renders text in English under the en MessagesContext", () => {
    const store = makeStore([TEXT_EL]);
    store.setSelection(["t1"]);
    act(() => {
      root.render(
        <MessagesContext.Provider value={en}>
          <StatusBar store={store} cursorMm={null} />
        </MessagesContext.Provider>,
      );
    });
    expect(container.textContent).toContain("Selection: ");
    expect(container.querySelector(".dr-statusbar-saved")?.textContent).toBe(
      "Saved",
    );
  });
});
