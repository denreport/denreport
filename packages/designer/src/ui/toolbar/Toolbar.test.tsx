import type { IrDocument } from "@denreport/core";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DesignerChrome } from "../../api/designer";
import { EditorStore } from "../../state/store";
import { Toolbar } from "./Toolbar";

const BLANK: IrDocument = {
  version: "1.0",
  page: { width: 210, height: 297 },
  font: { name: "NotoSansJP" },
  elements: [],
};

function makeChrome(overrides: Partial<DesignerChrome> = {}): DesignerChrome {
  return {
    resolvedTheme: "light",
    toggleTheme: vi.fn(),
    requestSave: vi.fn(),
    importIr: vi.fn(() => ({ ok: true }) as const),
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
    if (container.querySelector(".apx-toolbar") === null) {
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

describe("Toolbar", () => {
  it("保存クリックで chrome.requestSave が1回呼ばれる", async () => {
    const chrome = makeChrome();
    await renderToolbar(chrome);
    click(buttonByText("保存"));
    expect(chrome.requestSave).toHaveBeenCalledOnce();
  });

  it("テーマボタンの aria-pressed と is-on は resolvedTheme に追従する", async () => {
    await renderToolbar(makeChrome({ resolvedTheme: "light" }));
    const light = buttonByText("テーマ");
    expect(light.getAttribute("aria-pressed")).toBe("false");
    expect(light.classList.contains("is-on")).toBe(false);
    expect(light.title).toBe("テーマを切り替え（現在: ライト）");
    const lightSvg = light.querySelector("svg");
    expect(lightSvg?.getAttribute("aria-hidden")).toBe("true");
    expect(light.querySelectorAll("svg")).toHaveLength(1);

    await renderToolbar(makeChrome({ resolvedTheme: "dark" }));
    await vi.waitFor(() => {
      const dark = buttonByText("テーマ");
      expect(dark.getAttribute("aria-pressed")).toBe("true");
      expect(dark.classList.contains("is-on")).toBe(true);
      expect(dark.title).toBe("テーマを切り替え（現在: ダーク）");
    });
    const dark = buttonByText("テーマ");
    const darkSvg = dark.querySelector("svg");
    expect(darkSvg?.getAttribute("aria-hidden")).toBe("true");
    expect(dark.querySelectorAll("svg")).toHaveLength(1);
  });

  it("テーマクリックで chrome.toggleTheme が呼ばれる", async () => {
    const chrome = makeChrome();
    await renderToolbar(chrome);
    click(buttonByText("テーマ"));
    expect(chrome.toggleTheme).toHaveBeenCalledOnce();
  });

  it("プレビュークリックで onPreview が1回呼ばれる", async () => {
    const onPreview = vi.fn();
    await renderToolbar(makeChrome(), onPreview);
    click(buttonByText("プレビュー"));
    expect(onPreview).toHaveBeenCalledOnce();
  });

  it("書き出しクリックで onExport が1回呼ばれる", async () => {
    const onExport = vi.fn();
    await renderToolbar(makeChrome(), () => {}, onExport);
    click(buttonByText("書き出し"));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it("スタイルクリックで onManageStyles が1回呼ばれる", async () => {
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

  it("ショートカット一覧クリックで onShowShortcuts が1回呼ばれる", async () => {
    const onShowShortcuts = vi.fn();
    await renderToolbar(
      makeChrome(),
      () => {},
      () => {},
      new EditorStore(BLANK),
      onShowShortcuts,
    );
    click(buttonByText("ショートカット一覧"));
    expect(onShowShortcuts).toHaveBeenCalledOnce();
  });

  it("プレビュー・書き出し・スタイル・開く・保存はすべて活性である", async () => {
    await renderToolbar(makeChrome());
    expect(buttonByText("プレビュー").disabled).toBe(false);
    expect(buttonByText("書き出し").disabled).toBe(false);
    expect(buttonByText("スタイル").disabled).toBe(false);
    expect(buttonByText("開く").disabled).toBe(false);
    expect(buttonByText("保存").disabled).toBe(false);
  });

  it("選択/移動セグメントは canvasMode に追従し、クリックで setView される", async () => {
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

  it("保存状態インジケータは非 dirty でも常にマウントされる", async () => {
    await renderToolbar(makeChrome());
    const indicator = container.querySelector(".apx-doc-dirty");
    expect(indicator).not.toBeNull();
    expect(indicator?.classList.contains("is-on")).toBe(false);
    expect(indicator?.getAttribute("title")).toBeNull();
  });

  it("dirty 遷移でインジケータのクラスと title が切り替わり、要素数は1のまま", async () => {
    const store = await renderToolbar(makeChrome());
    store.commit({ ...store.getState().document, elements: [] });
    await vi.waitFor(() => {
      const indicator = container.querySelector(".apx-doc-dirty");
      expect(indicator?.classList.contains("is-on")).toBe(true);
      expect(indicator?.getAttribute("title")).toBe("未保存の変更あり");
    });
    expect(container.querySelectorAll(".apx-doc-dirty")).toHaveLength(1);

    store.markSaved();
    await vi.waitFor(() => {
      const indicator = container.querySelector(".apx-doc-dirty");
      expect(indicator?.classList.contains("is-on")).toBe(false);
      expect(indicator?.getAttribute("title")).toBeNull();
    });
    expect(container.querySelectorAll(".apx-doc-dirty")).toHaveLength(1);

    store.commit({ ...store.getState().document, elements: [] });
    await vi.waitFor(() => {
      expect(
        container.querySelector(".apx-doc-dirty")?.classList.contains("is-on"),
      ).toBe(true);
    });
    expect(container.querySelectorAll(".apx-doc-dirty")).toHaveLength(1);
  });

  it("左右パネルトグルの aria-expanded は props を反映する", async () => {
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

  it("左パネルトグルのクリックで onToggleSidebar が1回呼ばれる", async () => {
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

  it("右パネルトグルのクリックで onToggleProps が1回呼ばれる", async () => {
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
});
