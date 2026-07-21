import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContextMenu } from "./ContextMenu";
import type { CanvasMenuItem } from "./menu-items";

let container: HTMLElement;
let root: Root;

const ITEMS: readonly CanvasMenuItem[] = [
  { action: "copy", label: "コピー", shortcut: "Ctrl+C", disabled: false },
  { action: "cut", label: "切り取り", shortcut: "Ctrl+X", disabled: false },
  { action: "paste", label: "貼り付け", shortcut: "Ctrl+V", disabled: true },
  { action: "duplicate", label: "複製", shortcut: null, disabled: false },
  { action: "delete", label: "削除", shortcut: "Delete", disabled: false },
];

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
});

async function renderMenu(
  items: readonly CanvasMenuItem[],
  onAction: (action: string) => void = () => {},
  onClose: () => void = () => {},
): Promise<HTMLElement> {
  root.render(
    <ContextMenu
      x={10}
      y={10}
      items={items}
      onAction={onAction}
      onClose={onClose}
    />,
  );
  await vi.waitFor(() => {
    if (container.querySelector(".dr-context-menu") === null) {
      throw new Error("メニューが未描画");
    }
  });
  const menu = container.querySelector<HTMLElement>(".dr-context-menu");
  if (menu === null) {
    throw new Error("メニューがない");
  }
  return menu;
}

function itemButtons(menu: HTMLElement): HTMLButtonElement[] {
  return [...menu.querySelectorAll<HTMLButtonElement>(".dr-context-menu-item")];
}

function pressKey(target: Element, key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

describe("ContextMenu rendering", () => {
  it("renders item labels/shortcuts and sets aria-disabled on disabled items", async () => {
    const menu = await renderMenu(ITEMS);
    const buttons = itemButtons(menu);
    expect(buttons.map((b) => b.textContent)).toEqual([
      "コピーCtrl+C",
      "切り取りCtrl+X",
      "貼り付けCtrl+V",
      "複製",
      "削除Delete",
    ]);
    expect(buttons[2]?.getAttribute("aria-disabled")).toBe("true");
    expect(buttons[0]?.getAttribute("aria-disabled")).toBe("false");
  });

  it("sets role=menu / role=menuitem", async () => {
    const menu = await renderMenu(ITEMS);
    expect(menu.getAttribute("role")).toBe("menu");
    expect(
      itemButtons(menu).every((b) => b.getAttribute("role") === "menuitem"),
    ).toBe(true);
  });
});

describe("focus management", () => {
  it("focuses the first enabled item on mount", async () => {
    const menu = await renderMenu(ITEMS);
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(itemButtons(menu)[0]);
    });
  });

  it("focuses the first enabled item when the first item is disabled", async () => {
    const items = ITEMS.map((item, i) =>
      i === 0 ? { ...item, disabled: true } : item,
    );
    const menu = await renderMenu(items);
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(itemButtons(menu)[1]);
    });
  });

  it("calls focus() only after visibility settles to visible", async () => {
    const original = HTMLButtonElement.prototype.focus;
    const visibilityAtCall: string[] = [];
    const spy = vi
      .spyOn(HTMLButtonElement.prototype, "focus")
      .mockImplementation(function (this: HTMLButtonElement, ...args) {
        const menuEl = this.closest<HTMLElement>(".dr-context-menu");
        visibilityAtCall.push(menuEl?.style.visibility ?? "");
        return original.apply(this, args);
      });
    const menu = await renderMenu(ITEMS);
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(itemButtons(menu)[0]);
    });
    expect(visibilityAtCall.length).toBeGreaterThan(0);
    expect(visibilityAtCall.every((v) => v === "visible")).toBe(true);
    spy.mockRestore();
  });
});

describe("keyboard operations", () => {
  it("cycles through items with Down/Up", async () => {
    const menu = await renderMenu(ITEMS);
    const buttons = itemButtons(menu);
    await vi.waitFor(() => expect(document.activeElement).toBe(buttons[0]));

    pressKey(menu, "ArrowUp");
    expect(document.activeElement).toBe(buttons[4]);

    pressKey(menu, "ArrowDown");
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("moves to the first/last item with Home/End", async () => {
    const menu = await renderMenu(ITEMS);
    const buttons = itemButtons(menu);
    buttons[2]?.focus();

    pressKey(menu, "End");
    expect(document.activeElement).toBe(buttons[4]);

    pressKey(menu, "Home");
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("calls onAction on Enter", async () => {
    const onAction = vi.fn();
    const menu = await renderMenu(ITEMS, onAction);
    const buttons = itemButtons(menu);
    await vi.waitFor(() => expect(document.activeElement).toBe(buttons[0]));

    pressKey(menu, "Enter");
    expect(onAction).toHaveBeenCalledWith("copy");
  });

  it("does not call onAction on Enter over a disabled item", async () => {
    const onAction = vi.fn();
    const menu = await renderMenu(ITEMS, onAction);
    const buttons = itemButtons(menu);
    buttons[2]?.focus();

    pressKey(menu, "Enter");
    expect(onAction).not.toHaveBeenCalled();
  });

  it("does not call onAction when clicking a disabled item", async () => {
    const onAction = vi.fn();
    const menu = await renderMenu(ITEMS, onAction);
    itemButtons(menu)[2]?.click();
    expect(onAction).not.toHaveBeenCalled();
  });

  it("calls onAction when clicking an enabled item", async () => {
    const onAction = vi.fn();
    const menu = await renderMenu(ITEMS, onAction);
    itemButtons(menu)[4]?.click();
    expect(onAction).toHaveBeenCalledWith("delete");
  });

  it("calls onClose on Esc", async () => {
    const onClose = vi.fn();
    const menu = await renderMenu(ITEMS, undefined, onClose);
    pressKey(menu, "Escape");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not propagate keydown of an arbitrary key to the parent (onKeyDown on the React tree)", async () => {
    const parentOnKeyDown = vi.fn();
    root.render(
      // biome-ignore lint/a11y/noStaticElementInteractions: mimics DesignerRoot's dr-layout (an ancestor with onKeyDown) for verification purposes
      <div onKeyDown={parentOnKeyDown}>
        <ContextMenu
          x={10}
          y={10}
          items={ITEMS}
          onAction={() => {}}
          onClose={() => {}}
        />
      </div>,
    );
    await vi.waitFor(() => {
      if (container.querySelector(".dr-context-menu") === null) {
        throw new Error("メニューが未描画");
      }
    });
    const menu = container.querySelector<HTMLElement>(".dr-context-menu");
    if (menu === null) {
      throw new Error("メニューがない");
    }
    pressKey(menu, "a");
    expect(parentOnKeyDown).not.toHaveBeenCalled();
  });
});

describe("closing via outside interaction", () => {
  it("calls onClose on pointerdown outside the menu", async () => {
    const onClose = vi.fn();
    await renderMenu(ITEMS, undefined, onClose);
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose on pointerdown inside the menu", async () => {
    const onClose = vi.fn();
    const menu = await renderMenu(ITEMS, undefined, onClose);
    itemButtons(menu)[0]?.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when scrolling occurs", async () => {
    const onClose = vi.fn();
    await renderMenu(ITEMS, undefined, onClose);
    document.body.dispatchEvent(new Event("scroll", { bubbles: false }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
