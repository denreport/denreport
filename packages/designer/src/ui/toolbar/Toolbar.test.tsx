import type { IrDocument } from "@denreport/core";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DesignerChrome } from "../../api/designer";
import { MessagesContext } from "../../i18n/context";
import { en } from "../../i18n/messages/en";
import { EditorStore } from "../../state/store";
import { Toolbar } from "./Toolbar";

const BLANK: IrDocument = {
  version: "1.0",
  page: { width: 210, height: 297 },
  font: { regular: "NotoSansJP" },
  elements: [],
};

function makeChrome(overrides: Partial<DesignerChrome> = {}): DesignerChrome {
  return {
    resolvedTheme: "light",
    toggleTheme: vi.fn(),
    requestSave: vi.fn(),
    importIr: vi.fn(() => ({ ok: true }) as const),
    locale: "ja",
    toggleLocale: vi.fn(),
    ...overrides,
  };
}

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

async function renderToolbar(
  chrome: DesignerChrome,
  onPreview: () => void = () => {},
  onExport: () => void = () => {},
  store: EditorStore = new EditorStore(BLANK),
  onShowShortcuts: () => void = () => {},
  sidebarOpen = true,
  propsOpen = true,
  onToggleSidebar: () => void = () => {},
  onToggleProps: () => void = () => {},
  onManageStyles: () => void = () => {},
): Promise<EditorStore> {
  root.render(
    <Toolbar
      store={store}
      chrome={chrome}
      onPreview={onPreview}
      onExport={onExport}
      onManageStyles={onManageStyles}
      onShowShortcuts={onShowShortcuts}
      sidebarOpen={sidebarOpen}
      propsOpen={propsOpen}
      onToggleSidebar={onToggleSidebar}
      onToggleProps={onToggleProps}
    />,
  );
  await vi.waitFor(() => {
    if (container.querySelector(".dr-toolbar") === null) {
      throw new Error("ツールバーが未描画");
    }
  });
  return store;
}

function buttonByText(label: string): HTMLButtonElement {
  const button = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find((b) => (b.getAttribute("aria-label") ?? b.textContent) === label);
  if (button === undefined) {
    throw new Error(`ボタンがない: ${label}`);
  }
  return button;
}

function click(el: Element): void {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

// Real browsers dispatch pointerdown and click as separate tasks, letting the
// pointerdown-triggered state update flush before click runs; a same-tick
// dispatch (no macrotask between them) doesn't reproduce that ordering
async function realClick(el: Element): Promise<void> {
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("Toolbar", () => {
  it("calls chrome.requestSave once when clicking save", async () => {
    const chrome = makeChrome();
    await renderToolbar(chrome);
    click(buttonByText("保存"));
    expect(chrome.requestSave).toHaveBeenCalledOnce();
  });

  it("opens the menu via the more-actions button and shows a theme item matching resolvedTheme", async () => {
    await renderToolbar(makeChrome({ resolvedTheme: "dark" }));
    const trigger = buttonByText("その他の操作");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    click(trigger);
    await vi.waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
    });
    const themeItem = buttonByText("テーマを切り替え（現在: ダーク）");
    expect(themeItem.getAttribute("role")).toBe("menuitem");
  });

  it("a real click (pointerdown→click) on an open trigger leaves the menu closed", async () => {
    await renderToolbar(makeChrome());
    const trigger = buttonByText("その他の操作");
    await realClick(trigger);
    await vi.waitFor(() => {
      expect(container.querySelector('[role="menu"]')).not.toBeNull();
    });

    await realClick(trigger);
    await vi.waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    });
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it("calls chrome.toggleTheme and closes the menu when clicking the theme item", async () => {
    const chrome = makeChrome();
    await renderToolbar(chrome);
    click(buttonByText("その他の操作"));
    await vi.waitFor(() => {
      expect(container.querySelector('[role="menu"]')).not.toBeNull();
    });
    click(buttonByText("テーマを切り替え（現在: ライト）"));
    expect(chrome.toggleTheme).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(container.querySelector('[role="menu"]')).toBeNull();
    });
  });

  it("calls onPreview once when clicking preview", async () => {
    const onPreview = vi.fn();
    await renderToolbar(makeChrome(), onPreview);
    click(buttonByText("プレビュー"));
    expect(onPreview).toHaveBeenCalledOnce();
  });

  it("calls onExport once when clicking export", async () => {
    const onExport = vi.fn();
    await renderToolbar(makeChrome(), () => {}, onExport);
    click(buttonByText("書き出し"));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it("calls onManageStyles once when clicking styles", async () => {
    const onManageStyles = vi.fn();
    await renderToolbar(
      makeChrome(),
      () => {},
      () => {},
      new EditorStore(BLANK),
      () => {},
      true,
      true,
      () => {},
      () => {},
      onManageStyles,
    );
    click(buttonByText("スタイル"));
    expect(onManageStyles).toHaveBeenCalledOnce();
  });

  it("calls onShowShortcuts once when clicking the shortcuts item", async () => {
    const onShowShortcuts = vi.fn();
    await renderToolbar(
      makeChrome(),
      () => {},
      () => {},
      new EditorStore(BLANK),
      onShowShortcuts,
    );
    click(buttonByText("その他の操作"));
    await vi.waitFor(() => {
      expect(container.querySelector('[role="menu"]')).not.toBeNull();
    });
    click(buttonByText("ショートカット一覧"));
    expect(onShowShortcuts).toHaveBeenCalledOnce();
  });

  it("preview, export, styles, open, and save are all enabled", async () => {
    await renderToolbar(makeChrome());
    expect(buttonByText("プレビュー").disabled).toBe(false);
    expect(buttonByText("書き出し").disabled).toBe(false);
    expect(buttonByText("スタイル").disabled).toBe(false);
    expect(buttonByText("開く").disabled).toBe(false);
    expect(buttonByText("保存").disabled).toBe(false);
  });

  it("the select/pan segment follows canvasMode, and clicking calls setView", async () => {
    const store = await renderToolbar(makeChrome());
    const select = buttonByText("選択");
    const pan = buttonByText("移動");
    expect(select.classList.contains("is-active")).toBe(true);
    expect(pan.classList.contains("is-active")).toBe(false);

    click(pan);
    await vi.waitFor(() => {
      expect(store.getState().view.canvasMode).toBe("pan");
      expect(buttonByText("移動").classList.contains("is-active")).toBe(true);
      expect(buttonByText("選択").classList.contains("is-active")).toBe(false);
    });

    click(buttonByText("選択"));
    await vi.waitFor(() => {
      expect(store.getState().view.canvasMode).toBe("select");
    });
  });

  it("the save-state indicator is always mounted even when not dirty", async () => {
    await renderToolbar(makeChrome());
    const indicator = container.querySelector(".dr-doc-dirty");
    expect(indicator).not.toBeNull();
    expect(indicator?.classList.contains("is-on")).toBe(false);
    expect(indicator?.getAttribute("title")).toBeNull();
  });

  it("the indicator's class and title toggle on dirty transitions, and the element count stays at 1", async () => {
    const store = await renderToolbar(makeChrome());
    store.commit({ ...store.getState().document, elements: [] });
    await vi.waitFor(() => {
      const indicator = container.querySelector(".dr-doc-dirty");
      expect(indicator?.classList.contains("is-on")).toBe(true);
      expect(indicator?.getAttribute("title")).toBe("未保存の変更あり");
    });
    expect(container.querySelectorAll(".dr-doc-dirty")).toHaveLength(1);

    store.markSaved();
    await vi.waitFor(() => {
      const indicator = container.querySelector(".dr-doc-dirty");
      expect(indicator?.classList.contains("is-on")).toBe(false);
      expect(indicator?.getAttribute("title")).toBeNull();
    });
    expect(container.querySelectorAll(".dr-doc-dirty")).toHaveLength(1);

    store.commit({ ...store.getState().document, elements: [] });
    await vi.waitFor(() => {
      expect(
        container.querySelector(".dr-doc-dirty")?.classList.contains("is-on"),
      ).toBe(true);
    });
    expect(container.querySelectorAll(".dr-doc-dirty")).toHaveLength(1);
  });

  it("aria-expanded of the left/right panel toggles reflects props", async () => {
    await renderToolbar(
      makeChrome(),
      () => {},
      () => {},
      new EditorStore(BLANK),
      () => {},
      false,
      false,
    );
    expect(buttonByText("左パネルを開閉").getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(buttonByText("右パネルを開閉").getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("calls onToggleSidebar once when clicking the left-panel toggle", async () => {
    const onToggleSidebar = vi.fn();
    await renderToolbar(
      makeChrome(),
      () => {},
      () => {},
      new EditorStore(BLANK),
      () => {},
      true,
      true,
      onToggleSidebar,
    );
    click(buttonByText("左パネルを開閉"));
    expect(onToggleSidebar).toHaveBeenCalledOnce();
  });

  it("the export-target select follows state.selectedExportTarget, and selecting calls setSelectedExportTarget", async () => {
    const store = await renderToolbar(makeChrome());
    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="書き出しターゲット"]',
    );
    if (select === null) {
      throw new Error("書き出しターゲットの select がない");
    }
    expect(select.value).toBe("pdfme");

    Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )?.set?.call(select, "reportlab");
    select.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(() => {
      expect(store.getState().selectedExportTarget).toBe("reportlab");
    });
  });

  it("calls onToggleProps once when clicking the right-panel toggle", async () => {
    const onToggleProps = vi.fn();
    await renderToolbar(
      makeChrome(),
      () => {},
      () => {},
      new EditorStore(BLANK),
      () => {},
      true,
      true,
      () => {},
      onToggleProps,
    );
    click(buttonByText("右パネルを開閉"));
    expect(onToggleProps).toHaveBeenCalledOnce();
  });

  it("closes the menu on Esc and returns focus to the trigger", async () => {
    await renderToolbar(makeChrome());
    const trigger = buttonByText("その他の操作");
    click(trigger);
    const menu = await vi.waitFor(() => {
      const el = container.querySelector('[role="menu"]');
      if (el === null) {
        throw new Error("メニューが未描画");
      }
      return el;
    });
    menu.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    await vi.waitFor(() => {
      expect(container.querySelector('[role="menu"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  });

  it("calls toggleLocale when clicking the language item", async () => {
    const chrome = makeChrome();
    await renderToolbar(chrome);
    click(buttonByText("その他の操作"));
    await vi.waitFor(() => {
      expect(container.querySelector('[role="menu"]')).not.toBeNull();
    });
    click(buttonByText("言語を切り替え（現在: 日本語）"));
    expect(chrome.toggleLocale).toHaveBeenCalledOnce();
  });

  it("renders text in English under the en MessagesContext", async () => {
    root.render(
      <MessagesContext.Provider value={en}>
        <Toolbar
          store={new EditorStore(BLANK)}
          chrome={makeChrome()}
          onPreview={() => {}}
          onExport={() => {}}
          onManageStyles={() => {}}
          onShowShortcuts={() => {}}
          sidebarOpen={true}
          propsOpen={true}
          onToggleSidebar={() => {}}
          onToggleProps={() => {}}
        />
      </MessagesContext.Provider>,
    );
    await vi.waitFor(() => {
      expect(container.querySelector(".dr-toolbar")).not.toBeNull();
    });
    expect(buttonByText("Save").disabled).toBe(false);
    expect(buttonByText("Export").disabled).toBe(false);
    expect(container.querySelector(".dr-brand-name")?.textContent).toBe(
      "Report Designer",
    );
  });
});
