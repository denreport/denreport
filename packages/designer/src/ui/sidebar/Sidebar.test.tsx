import type { IrDocument } from "@denreport/core";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorStore } from "../../state/store";
import { Sidebar } from "./Sidebar";
import { MIN_PALETTE_HEIGHT } from "./splitter";

const BLANK: IrDocument = {
  version: "1.0",
  page: { width: 210, height: 297 },
  font: { regular: "NotoSansJP" },
  elements: [],
};

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  // jsdom does not implement setPointerCapture, so stub it just for drag verification
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  root.unmount();
  container.remove();
});

async function renderSidebar(): Promise<EditorStore> {
  const store = new EditorStore(BLANK);
  root.render(
    <Sidebar
      store={store}
      beginPlacement={() => {}}
      onQuickAdd={() => {}}
      onReveal={() => {}}
    />,
  );
  await vi.waitFor(() => {
    if (container.querySelector(".dr-sidebar") === null) {
      throw new Error("サイドバーが未描画");
    }
  });
  return store;
}

function sidebarEl(): HTMLElement {
  const el = container.querySelector<HTMLElement>(".dr-sidebar");
  if (el === null) {
    throw new Error("サイドバーがない");
  }
  return el;
}

function splitterEl(): HTMLElement {
  const el = container.querySelector<HTMLElement>('[role="separator"]');
  if (el === null) {
    throw new Error("スプリッターがない");
  }
  return el;
}

describe("Sidebar 初期描画", () => {
  it("has-split なしでパレット・レイヤー・スプリッターが存在する", async () => {
    await renderSidebar();
    expect(sidebarEl().classList.contains("has-split")).toBe(false);
    expect(container.querySelector(".dr-palette")).not.toBeNull();
    expect(container.querySelector(".dr-layers")).not.toBeNull();
    const splitter = splitterEl();
    expect(splitter.getAttribute("aria-orientation")).toBe("horizontal");
    expect(splitter.getAttribute("aria-label")).toBe(
      "パレットとレイヤーの高さ",
    );
    expect(splitter.getAttribute("aria-valuenow")).toBeNull();
  });
});

describe("キーボード操作", () => {
  it("ArrowUp/ArrowDown で has-split と --dr-palette-h が設定される", async () => {
    await renderSidebar();
    const splitter = splitterEl();
    splitter.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
    );
    await vi.waitFor(() => {
      expect(sidebarEl().classList.contains("has-split")).toBe(true);
    });
    expect(sidebarEl().style.getPropertyValue("--dr-palette-h")).toBe(
      `${MIN_PALETTE_HEIGHT}px`,
    );
    expect(splitterEl().getAttribute("aria-valuenow")).toBe(
      `${MIN_PALETTE_HEIGHT}`,
    );
  });
});

describe("ポインタ操作", () => {
  it("pointerdown → pointermove → pointerup の一連で高さが更新される", async () => {
    await renderSidebar();
    const splitter = splitterEl();
    splitter.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, clientY: 100 }),
    );
    splitter.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, clientY: 150 }),
    );
    splitter.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, clientY: 150 }),
    );
    await vi.waitFor(() => {
      expect(sidebarEl().classList.contains("has-split")).toBe(true);
    });
    // jsdom always returns 0 from getBoundingClientRect, so only verify the structure degraded to clamp's lower bound
    expect(sidebarEl().style.getPropertyValue("--dr-palette-h")).toBe(
      `${MIN_PALETTE_HEIGHT}px`,
    );
  });
});
