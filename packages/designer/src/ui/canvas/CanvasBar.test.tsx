import type { IrDocument } from "@denreport/core";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditorStore } from "../../state/store";
import { CanvasBar } from "./CanvasBar";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeStore(page: IrDocument["page"]): EditorStore {
  const document: IrDocument = {
    version: "1.0",
    page,
    font: { name: "NotoSansJP" },
    elements: [],
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

function select(): HTMLSelectElement {
  const el = container.querySelector<HTMLSelectElement>(
    'select[aria-label="封筒窓ガイド"]',
  );
  if (el === null) {
    throw new Error("封筒窓ガイドの select が見つからない");
  }
  return el;
}

describe("CanvasBar の封筒窓ガイド", () => {
  it("A4 縦では有効で、選択すると setEnvelopePreset が呼ばれる", () => {
    const store = makeStore({ width: 210, height: 297 });
    act(() => {
      root.render(<CanvasBar store={store} />);
    });
    expect(select().disabled).toBe(false);

    act(() => {
      const el = select();
      Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )?.set?.call(el, "l3-w80h45");
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(store.getState().envelopePresetId).toBe("l3-w80h45");
  });

  it("空文字を選ぶと null になる", () => {
    const store = makeStore({ width: 210, height: 297 });
    store.setEnvelopePreset("l3-w80h45");
    act(() => {
      root.render(<CanvasBar store={store} />);
    });

    act(() => {
      const el = select();
      Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )?.set?.call(el, "");
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(store.getState().envelopePresetId).toBeNull();
  });

  it("A4 縦以外の document では disabled になる", () => {
    const store = makeStore({ width: 148, height: 210 });
    act(() => {
      root.render(<CanvasBar store={store} />);
    });
    expect(select().disabled).toBe(true);
  });
});
