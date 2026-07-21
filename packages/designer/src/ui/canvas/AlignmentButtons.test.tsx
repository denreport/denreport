import type { IrDocument, IrElement } from "@denreport/core";
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditorStore } from "../../state/store";
import { AlignmentButtons } from "./AlignmentButtons";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

function makeStore(count: number): EditorStore {
  const elements = Array.from({ length: count }, (_, i) =>
    textElement(`e${i}`, i * 20, i * 20),
  );
  const document: IrDocument = {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements,
  };
  const store = new EditorStore(document);
  store.setSelection(elements.map((el) => el.id));
  return store;
}

describe("AlignmentButtons", () => {
  it("renders nothing with 0-1 selected", () => {
    render(<AlignmentButtons store={makeStore(0)} />);
    expect(container.querySelectorAll("button")).toHaveLength(0);

    render(<AlignmentButtons store={makeStore(1)} />);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("with 2 selected, align buttons are clickable and the 2 distribute buttons are disabled", () => {
    render(<AlignmentButtons store={makeStore(2)} />);
    const buttons = [...container.querySelectorAll("button")];
    expect(buttons).toHaveLength(8);
    const distributeButtons = buttons.filter(
      (b) =>
        b.getAttribute("aria-label") === "水平方向に等間隔" ||
        b.getAttribute("aria-label") === "垂直方向に等間隔",
    );
    expect(distributeButtons).toHaveLength(2);
    for (const b of distributeButtons) {
      expect(b.disabled).toBe(true);
    }
    const alignButtons = buttons.filter((b) => !distributeButtons.includes(b));
    for (const b of alignButtons) {
      expect(b.disabled).toBe(false);
    }
  });

  it("with 3 selected, all buttons are enabled", () => {
    render(<AlignmentButtons store={makeStore(3)} />);
    const buttons = [...container.querySelectorAll("button")];
    expect(buttons).toHaveLength(8);
    for (const b of buttons) {
      expect(b.disabled).toBe(false);
    }
  });

  it("clicking an align button changes the document coordinates", () => {
    const store = makeStore(2);
    render(<AlignmentButtons store={store} />);
    const button = [...container.querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-label") === "左端揃え",
    );
    if (button === undefined) {
      throw new Error("左端揃えボタンが見つからない");
    }
    const before = store.getState().document.elements[1];
    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const after = store.getState().document.elements[1];
    expect(after).not.toEqual(before);
    expect(after).toMatchObject({ x: 0 });
  });
});
