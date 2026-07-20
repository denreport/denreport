import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessagesContext } from "../../i18n/context";
import { en } from "../../i18n/messages/en";
import { ja } from "../../i18n/messages/ja";
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

function buttonFor(type: keyof typeof ja.elementTypes): HTMLButtonElement {
  const label = ja.elementTypes[type];
  const button = [...container.querySelectorAll(".dr-pal-item")].find((el) =>
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
      if (container.querySelector(".dr-palette") === null) {
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
      if (container.querySelector(".dr-palette") === null) {
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
      if (container.querySelector(".dr-palette") === null) {
        throw new Error("パレットが未描画");
      }
    });

    buttonFor("barcode").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(onQuickAdd).toHaveBeenCalledExactlyOnceWith("barcode");
  });

  it("text アイコンの字形見本がロケールで切り替わる", async () => {
    root.render(<Palette beginPlacement={vi.fn()} onQuickAdd={vi.fn()} />);
    await vi.waitFor(() => {
      if (container.querySelector(".dr-palette") === null) {
        throw new Error("パレットが未描画");
      }
    });
    expect(container.querySelector(".dr-pi-text")?.textContent).toBe("あ");

    root.render(
      <MessagesContext.Provider value={en}>
        <Palette beginPlacement={vi.fn()} onQuickAdd={vi.fn()} />
      </MessagesContext.Provider>,
    );
    await vi.waitFor(() => {
      expect(container.querySelector(".dr-pi-text")?.textContent).toBe("A");
    });
  });
});
