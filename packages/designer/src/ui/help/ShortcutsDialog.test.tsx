import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShortcutsDialog } from "./ShortcutsDialog";

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
  root.render(<ShortcutsDialog onClose={onClose} />);
  await vi.waitFor(() => {
    if (container.querySelector(".apx-dialog") === null) {
      throw new Error("ダイアログが未描画");
    }
  });
  const dialog = container.querySelector<HTMLElement>(".apx-dialog");
  if (dialog === null) {
    throw new Error("ダイアログがない");
  }
  return dialog;
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

describe("ShortcutsDialog", () => {
  it("タイトルと代表的な行を描画する", async () => {
    const dialog = await renderDialog(() => {});
    expect(dialog.getAttribute("aria-label")).toBe("キーボードショートカット");
    expect(dialog.textContent).toContain("Ctrl/⌘+D");
    expect(dialog.textContent).toContain("複製");
  });

  it("閉じるボタンで onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    await renderDialog(onClose);
    buttonByText("閉じる").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("Escape で onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    const dialog = await renderDialog(onClose);
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });
});
