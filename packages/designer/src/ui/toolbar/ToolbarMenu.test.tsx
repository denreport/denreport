import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolbarMenuItem } from "./ToolbarMenu";
import { ToolbarMenu } from "./ToolbarMenu";

let container: HTMLElement;
let root: Root;

function makeItems(
  onSelect: (id: string) => void = () => {},
): ToolbarMenuItem[] {
  return [
    { id: "theme", label: "テーマ切替", onSelect: () => onSelect("theme") },
    { id: "locale", label: "言語切替", onSelect: () => onSelect("locale") },
    {
      id: "shortcuts",
      label: "ショートカット一覧",
      onSelect: () => onSelect("shortcuts"),
    },
  ];
}

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
  items: readonly ToolbarMenuItem[],
  onClose: () => void = () => {},
  anchorEl: HTMLElement | null = null,
): Promise<HTMLElement> {
  root.render(
    <ToolbarMenu
      x={10}
      y={10}
      items={items}
      onClose={onClose}
      anchorEl={anchorEl}
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

function pressKey(target: Element, key: string): void {
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
  );
}

describe("ToolbarMenu rendering", () => {
  it("renders item labels with role=menuitem", async () => {
    const menu = await renderMenu(makeItems());
    expect(menu.getAttribute("role")).toBe("menu");
    const buttons = itemButtons(menu);
    expect(buttons.map((b) => b.textContent)).toEqual([
      "テーマ切替",
      "言語切替",
      "ショートカット一覧",
    ]);
    expect(buttons.every((b) => b.getAttribute("role") === "menuitem")).toBe(
      true,
    );
  });

  it("focuses the first item on mount", async () => {
    const menu = await renderMenu(makeItems());
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(itemButtons(menu)[0]);
    });
  });
});

describe("keyboard operation", () => {
  it("cycles through items with ↓/↑", async () => {
    const menu = await renderMenu(makeItems());
    const buttons = itemButtons(menu);
    await vi.waitFor(() => expect(document.activeElement).toBe(buttons[0]));

    pressKey(menu, "ArrowUp");
    expect(document.activeElement).toBe(buttons[2]);

    pressKey(menu, "ArrowDown");
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("moves to the first/last item with Home/End", async () => {
    const menu = await renderMenu(makeItems());
    const buttons = itemButtons(menu);
    buttons[1]?.focus();

    pressKey(menu, "End");
    expect(document.activeElement).toBe(buttons[2]);

    pressKey(menu, "Home");
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("calls the selected item's onSelect and also onClose on Enter", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const menu = await renderMenu(makeItems(onSelect), onClose);
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(itemButtons(menu)[0]),
    );

    pressKey(menu, "Enter");
    expect(onSelect).toHaveBeenCalledWith("theme");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls the item's onSelect on click", async () => {
    const onSelect = vi.fn();
    const menu = await renderMenu(makeItems(onSelect));
    itemButtons(menu)[2]?.click();
    expect(onSelect).toHaveBeenCalledWith("shortcuts");
  });

  it("calls onClose on Esc", async () => {
    const onClose = vi.fn();
    const menu = await renderMenu(makeItems(), onClose);
    pressKey(menu, "Escape");
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("closing via outside interaction", () => {
  it("calls onClose on pointerdown outside the menu", async () => {
    const onClose = vi.fn();
    await renderMenu(makeItems(), onClose);
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose on pointerdown inside the menu", async () => {
    const onClose = vi.fn();
    const menu = await renderMenu(makeItems(), onClose);
    itemButtons(menu)[0]?.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when scrolling occurs", async () => {
    const onClose = vi.fn();
    await renderMenu(makeItems(), onClose);
    document.body.dispatchEvent(new Event("scroll", { bubbles: false }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose on pointerdown on anchorEl (re-closing via a trigger re-click is left to the trigger's own click handler)", async () => {
    const anchor = document.createElement("button");
    document.body.append(anchor);
    const onClose = vi.fn();
    await renderMenu(makeItems(), onClose, anchor);

    anchor.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();

    anchor.remove();
  });
});
