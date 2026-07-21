import type { IrDocument } from "@denreport/core";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MessagesContext } from "../../i18n/context";
import { en } from "../../i18n/messages/en";
import { EditorStore } from "../../state/store";
import { CanvasBar } from "./CanvasBar";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeStore(page: IrDocument["page"]): EditorStore {
  const document: IrDocument = {
    version: "1.0",
    page,
    font: { regular: "NotoSansJP" },
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

describe("CanvasBar envelope window guide", () => {
  it("enabled for A4 portrait, and calls setEnvelopePreset on selection", () => {
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

  it("becomes null when selecting an empty string", () => {
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

  it("disabled for documents other than A4 portrait", () => {
    const store = makeStore({ width: 148, height: 210 });
    act(() => {
      root.render(<CanvasBar store={store} />);
    });
    expect(select().disabled).toBe(true);
  });
});

describe("en MessagesContext", () => {
  it("renders text in English", () => {
    const store = makeStore({ width: 210, height: 297 });
    act(() => {
      root.render(
        <MessagesContext.Provider value={en}>
          <CanvasBar store={store} />
        </MessagesContext.Provider>,
      );
    });
    expect(
      container.querySelector('select[aria-label="Envelope window guide"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("Snap");
    expect(container.textContent).toContain("Grid");
    expect(container.textContent).toContain("Envelope window: None");
  });
});
