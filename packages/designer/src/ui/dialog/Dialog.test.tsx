import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog";

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

async function renderDialog(onClose: () => void): Promise<HTMLElement> {
  root.render(
    <Dialog
      title="テスト用"
      onClose={onClose}
      footer={
        <>
          <button type="button">キャンセル</button>
          <button type="button">実行</button>
        </>
      }
    >
      <p>本文</p>
      <button type="button">本文ボタン</button>
    </Dialog>,
  );
  await vi.waitFor(() => {
    if (container.querySelector(".dr-dialog") === null) {
      throw new Error("ダイアログが未描画");
    }
  });
  const dialog = container.querySelector<HTMLElement>(".dr-dialog");
  if (dialog === null) {
    throw new Error("ダイアログがない");
  }
  return dialog;
}

function pressKey(
  target: Element,
  key: string,
  shiftKey = false,
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

function buttonByText(label: string): HTMLButtonElement {
  const button = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find((b) => b.textContent === label);
  if (button === undefined) {
    throw new Error(`ボタンがない: ${label}`);
  }
  return button;
}

describe("Dialog", () => {
  it("role / aria-modal / aria-label と見出し・本文・フッタを描画する", async () => {
    const dialog = await renderDialog(() => {});
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe("テスト用");
    expect(dialog.querySelector(".dr-dialog-h")?.textContent).toBe("テスト用");
    expect(dialog.querySelector(".dr-dialog-b")?.textContent).toContain("本文");
    expect(dialog.querySelector(".dr-dialog-f")?.textContent).toContain("実行");
  });

  it("wide 指定で dr-dialog-wide が付く", async () => {
    root.render(
      <Dialog title="広い" onClose={() => {}} footer={null} wide>
        <p>本文</p>
      </Dialog>,
    );
    await vi.waitFor(() => {
      expect(container.querySelector(".dr-dialog-wide")).not.toBeNull();
    });
  });

  it("Esc で onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    const dialog = await renderDialog(onClose);
    pressKey(dialog, "Escape");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("スクリムクリックでは閉じない", async () => {
    const onClose = vi.fn();
    await renderDialog(onClose);
    const scrim = container.querySelector(".dr-dialog-scrim");
    scrim?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("表示時に最初のフォーカス可能要素へフォーカスする", async () => {
    await renderDialog(() => {});
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(buttonByText("本文ボタン"));
    });
  });

  it("末尾で Tab すると先頭に巡回する（フォーカストラップ）", async () => {
    const dialog = await renderDialog(() => {});
    const last = buttonByText("実行");
    last.focus();
    const event = pressKey(dialog, "Tab");
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttonByText("本文ボタン"));
  });

  it("先頭で Shift+Tab すると末尾に巡回する", async () => {
    const dialog = await renderDialog(() => {});
    buttonByText("本文ボタン").focus();
    const event = pressKey(dialog, "Tab", true);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttonByText("実行"));
  });

  it("中間要素の Tab はブラウザ既定に任せる（preventDefault しない）", async () => {
    const dialog = await renderDialog(() => {});
    buttonByText("キャンセル").focus();
    const event = pressKey(dialog, "Tab");
    expect(event.defaultPrevented).toBe(false);
  });
});
