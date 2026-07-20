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
    if (container.querySelector(".apx-context-menu") === null) {
      throw new Error("メニューが未描画");
    }
  });
  const menu = container.querySelector<HTMLElement>(".apx-context-menu");
  if (menu === null) {
    throw new Error("メニューがない");
  }
  return menu;
}

function itemButtons(menu: HTMLElement): HTMLButtonElement[] {
  return [
    ...menu.querySelectorAll<HTMLButtonElement>(".apx-context-menu-item"),
  ];
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

describe("ContextMenu 描画", () => {
  it("items のラベル・ショートカットを描画し、無効項目に aria-disabled が付く", async () => {
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

  it("role=menu / role=menuitem が付く", async () => {
    const menu = await renderMenu(ITEMS);
    expect(menu.getAttribute("role")).toBe("menu");
    expect(
      itemButtons(menu).every((b) => b.getAttribute("role") === "menuitem"),
    ).toBe(true);
  });
});

describe("フォーカス管理", () => {
  it("マウント時に最初の有効項目へフォーカスする", async () => {
    const menu = await renderMenu(ITEMS);
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(itemButtons(menu)[0]);
    });
  });

  it("先頭が無効な場合は最初の有効項目へフォーカスする", async () => {
    const items = ITEMS.map((item, i) =>
      i === 0 ? { ...item, disabled: true } : item,
    );
    const menu = await renderMenu(items);
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(itemButtons(menu)[1]);
    });
  });

  it("visibility が visible に確定してから focus() を呼ぶ", async () => {
    const original = HTMLButtonElement.prototype.focus;
    const visibilityAtCall: string[] = [];
    const spy = vi
      .spyOn(HTMLButtonElement.prototype, "focus")
      .mockImplementation(function (this: HTMLButtonElement, ...args) {
        const menuEl = this.closest<HTMLElement>(".apx-context-menu");
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

describe("キーボード操作", () => {
  it("↓/↑ で項目を循環移動する", async () => {
    const menu = await renderMenu(ITEMS);
    const buttons = itemButtons(menu);
    await vi.waitFor(() => expect(document.activeElement).toBe(buttons[0]));

    pressKey(menu, "ArrowUp");
    expect(document.activeElement).toBe(buttons[4]);

    pressKey(menu, "ArrowDown");
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("Home/End で先頭/末尾へ移動する", async () => {
    const menu = await renderMenu(ITEMS);
    const buttons = itemButtons(menu);
    buttons[2]?.focus();

    pressKey(menu, "End");
    expect(document.activeElement).toBe(buttons[4]);

    pressKey(menu, "Home");
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("Enter で onAction が呼ばれる", async () => {
    const onAction = vi.fn();
    const menu = await renderMenu(ITEMS, onAction);
    const buttons = itemButtons(menu);
    await vi.waitFor(() => expect(document.activeElement).toBe(buttons[0]));

    pressKey(menu, "Enter");
    expect(onAction).toHaveBeenCalledWith("copy");
  });

  it("無効項目上の Enter では onAction が呼ばれない", async () => {
    const onAction = vi.fn();
    const menu = await renderMenu(ITEMS, onAction);
    const buttons = itemButtons(menu);
    buttons[2]?.focus();

    pressKey(menu, "Enter");
    expect(onAction).not.toHaveBeenCalled();
  });

  it("無効項目のクリックでは onAction が呼ばれない", async () => {
    const onAction = vi.fn();
    const menu = await renderMenu(ITEMS, onAction);
    itemButtons(menu)[2]?.click();
    expect(onAction).not.toHaveBeenCalled();
  });

  it("有効項目のクリックで onAction が呼ばれる", async () => {
    const onAction = vi.fn();
    const menu = await renderMenu(ITEMS, onAction);
    itemButtons(menu)[4]?.click();
    expect(onAction).toHaveBeenCalledWith("delete");
  });

  it("Esc で onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    const menu = await renderMenu(ITEMS, undefined, onClose);
    pressKey(menu, "Escape");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("任意キーの keydown が親（React ツリー上の onKeyDown）へ伝播しない", async () => {
    const parentOnKeyDown = vi.fn();
    root.render(
      // biome-ignore lint/a11y/noStaticElementInteractions: mimics DesignerRoot's apx-layout (an ancestor with onKeyDown) for verification purposes
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
      if (container.querySelector(".apx-context-menu") === null) {
        throw new Error("メニューが未描画");
      }
    });
    const menu = container.querySelector<HTMLElement>(".apx-context-menu");
    if (menu === null) {
      throw new Error("メニューがない");
    }
    pressKey(menu, "a");
    expect(parentOnKeyDown).not.toHaveBeenCalled();
  });
});

describe("外側での閉じる操作", () => {
  it("メニュー外の pointerdown で onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    await renderMenu(ITEMS, undefined, onClose);
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("メニュー内の pointerdown では onClose が呼ばれない", async () => {
    const onClose = vi.fn();
    const menu = await renderMenu(ITEMS, undefined, onClose);
    itemButtons(menu)[0]?.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("スクロール発生で onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    await renderMenu(ITEMS, undefined, onClose);
    document.body.dispatchEvent(new Event("scroll", { bubbles: false }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
