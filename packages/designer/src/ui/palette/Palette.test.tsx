import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ELEMENT_TYPE_LABEL } from "../../state/element-labels";
import { Palette } from "./Palette";

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
});

function buttonFor(type: keyof typeof ELEMENT_TYPE_LABEL): HTMLButtonElement {
  const label = ELEMENT_TYPE_LABEL[type];
  const button = [...container.querySelectorAll(".apx-pal-item")].find((el) =>
    el.textContent?.includes(label),
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`パレットボタンがない: ${type}`);
  }
  return button;
}

describe("Palette", () => {
  it("ボタンの click で onQuickAdd がその型で1回呼ばれ、beginPlacement は呼ばれない", async () => {
    const beginPlacement = vi.fn();
    const onQuickAdd = vi.fn();
    root.render(
      <Palette beginPlacement={beginPlacement} onQuickAdd={onQuickAdd} />,
    );
    await vi.waitFor(() => {
      if (container.querySelector(".apx-palette") === null) {
        throw new Error("パレットが未描画");
      }
    });

    buttonFor("text").dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onQuickAdd).toHaveBeenCalledExactlyOnceWith("text");
    expect(beginPlacement).not.toHaveBeenCalled();
  });

  it("ボタンの pointerdown で beginPlacement が呼ばれる（既存挙動の回帰）", async () => {
    const beginPlacement = vi.fn();
    const onQuickAdd = vi.fn();
    root.render(
      <Palette beginPlacement={beginPlacement} onQuickAdd={onQuickAdd} />,
    );
    await vi.waitFor(() => {
      if (container.querySelector(".apx-palette") === null) {
        throw new Error("パレットが未描画");
      }
    });

    buttonFor("rect").dispatchEvent(
      new Event("pointerdown", { bubbles: true }),
    );

    expect(beginPlacement).toHaveBeenCalledOnce();
    expect(beginPlacement.mock.calls[0]?.[0]).toBe("rect");
    expect(onQuickAdd).not.toHaveBeenCalled();
  });

  it("バーコード項目が表示される", async () => {
    const beginPlacement = vi.fn();
    const onQuickAdd = vi.fn();
    root.render(
      <Palette beginPlacement={beginPlacement} onQuickAdd={onQuickAdd} />,
    );
    await vi.waitFor(() => {
      if (container.querySelector(".apx-palette") === null) {
        throw new Error("パレットが未描画");
      }
    });

    buttonFor("barcode").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(onQuickAdd).toHaveBeenCalledExactlyOnceWith("barcode");
  });
});
