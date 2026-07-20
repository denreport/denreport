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

describe("ToolbarMenu 描画", () => {
  it("items のラベルを role=menuitem で描画する", async () => {
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

  it("マウント時に最初の項目へフォーカスする", async () => {
    const menu = await renderMenu(makeItems());
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(itemButtons(menu)[0]);
    });
  });
});

describe("キーボード操作", () => {
  it("↓/↑ で項目を循環移動する", async () => {
    const menu = await renderMenu(makeItems());
    const buttons = itemButtons(menu);
    await vi.waitFor(() => expect(document.activeElement).toBe(buttons[0]));

    pressKey(menu, "ArrowUp");
    expect(document.activeElement).toBe(buttons[2]);

    pressKey(menu, "ArrowDown");
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("Home/End で先頭/末尾へ移動する", async () => {
    const menu = await renderMenu(makeItems());
    const buttons = itemButtons(menu);
    buttons[1]?.focus();

    pressKey(menu, "End");
    expect(document.activeElement).toBe(buttons[2]);

    pressKey(menu, "Home");
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("Enter で選択した項目の onSelect が呼ばれ、onClose も呼ばれる", async () => {
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

  it("クリックで項目の onSelect が呼ばれる", async () => {
    const onSelect = vi.fn();
    const menu = await renderMenu(makeItems(onSelect));
    itemButtons(menu)[2]?.click();
    expect(onSelect).toHaveBeenCalledWith("shortcuts");
  });

  it("Esc で onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    const menu = await renderMenu(makeItems(), onClose);
    pressKey(menu, "Escape");
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("外側での閉じる操作", () => {
  it("メニュー外の pointerdown で onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    await renderMenu(makeItems(), onClose);
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("メニュー内の pointerdown では onClose が呼ばれない", async () => {
    const onClose = vi.fn();
    const menu = await renderMenu(makeItems(), onClose);
    itemButtons(menu)[0]?.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("スクロール発生で onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    await renderMenu(makeItems(), onClose);
    document.body.dispatchEvent(new Event("scroll", { bubbles: false }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("anchorEl 上の pointerdown では onClose が呼ばれない（トリガー再クリックでの閉じ直しはトリガー側の click に委ねる）", async () => {
    const anchor = document.createElement("button");
    document.body.append(anchor);
    const onClose = vi.fn();
    await renderMenu(makeItems(), onClose, anchor);

    anchor.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();

    anchor.remove();
  });
});
