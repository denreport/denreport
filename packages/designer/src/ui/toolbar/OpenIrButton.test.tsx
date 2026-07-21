import type { IrError } from "@denreport/core";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoadIrResult } from "../../api/designer";
import { OpenIrButton } from "./OpenIrButton";

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
  vi.restoreAllMocks();
});

async function renderButton(props: {
  readonly dirty: boolean;
  readonly importIr: (json: string) => LoadIrResult;
}): Promise<void> {
  root.render(<OpenIrButton dirty={props.dirty} importIr={props.importIr} />);
  await vi.waitFor(() => {
    if (openButton() === undefined) {
      throw new Error("開くボタンが未描画");
    }
  });
}

function openButton(): HTMLButtonElement | undefined {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent === "開く",
  );
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

function click(el: Element | undefined): void {
  if (el === undefined) {
    throw new Error("クリック対象がない");
  }
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function spyFilePicker() {
  return vi
    .spyOn(HTMLInputElement.prototype, "click")
    .mockImplementation(() => {});
}

function selectFile(content: string): void {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) {
    throw new Error("file input がない");
  }
  const file = new File([content], "doc.json", { type: "application/json" });
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("open flow", () => {
  it("proceeds to file selection without confirmation when not dirty", async () => {
    const picker = spyFilePicker();
    await renderButton({
      dirty: false,
      importIr: vi.fn((): LoadIrResult => ({ ok: true })),
    });
    click(openButton());
    expect(picker).toHaveBeenCalledOnce();
    expect(container.querySelector(".dr-dialog")).toBeNull();
  });

  it("shows confirmation when dirty, and cancel does nothing", async () => {
    const picker = spyFilePicker();
    const importIr = vi.fn((): LoadIrResult => ({ ok: true }));
    await renderButton({ dirty: true, importIr });

    click(openButton());
    await vi.waitFor(() => {
      expect(container.querySelector(".dr-dialog")).not.toBeNull();
    });
    expect(container.textContent).toContain("未保存の変更は失われます");

    click(buttonByText("キャンセル"));
    await vi.waitFor(() => {
      expect(container.querySelector(".dr-dialog")).toBeNull();
    });
    expect(picker).not.toHaveBeenCalled();
    expect(importIr).not.toHaveBeenCalled();
  });

  it("proceeds to file selection when continuing past the dirty confirmation", async () => {
    const picker = spyFilePicker();
    await renderButton({
      dirty: true,
      importIr: vi.fn((): LoadIrResult => ({ ok: true })),
    });

    click(openButton());
    await vi.waitFor(() => {
      expect(container.querySelector(".dr-dialog")).not.toBeNull();
    });
    click(buttonByText("続行"));
    expect(picker).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(container.querySelector(".dr-dialog")).toBeNull();
    });
  });

  it("lists rule ID / path / message when importIr returns ok: false, and closing dismisses it", async () => {
    const errors: readonly IrError[] = [
      {
        rule: "S03",
        path: "version",
        message: "バージョンが対応していません",
      },
    ];
    const importIr = vi.fn((): LoadIrResult => ({ ok: false, errors }));
    await renderButton({ dirty: false, importIr });

    selectFile('{"version":"9.0"}');
    await vi.waitFor(() => {
      const dialog = container.querySelector(".dr-dialog");
      expect(dialog).not.toBeNull();
      expect(dialog?.textContent).toContain("S03");
      expect(dialog?.textContent).toContain("version");
      expect(dialog?.textContent).toContain("バージョンが対応していません");
      expect(dialog?.textContent).toContain("文書は変更されていません");
    });
    expect(importIr).toHaveBeenCalledExactlyOnceWith('{"version":"9.0"}');

    click(buttonByText("閉じる"));
    await vi.waitFor(() => {
      expect(container.querySelector(".dr-dialog")).toBeNull();
    });
  });

  it("shows no dialog when importIr returns ok: true", async () => {
    const importIr = vi.fn((): LoadIrResult => ({ ok: true }));
    await renderButton({ dirty: false, importIr });

    selectFile('{"version":"1.0"}');
    await vi.waitFor(() => {
      expect(importIr).toHaveBeenCalledExactlyOnceWith('{"version":"1.0"}');
    });
    expect(container.querySelector(".dr-dialog")).toBeNull();
  });

  it("shows a one-line message dialog when the file read itself fails", async () => {
    class FailingFileReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsText(): void {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal("FileReader", FailingFileReader);
    const importIr = vi.fn((): LoadIrResult => ({ ok: true }));
    await renderButton({ dirty: false, importIr });

    selectFile("{}");
    await vi.waitFor(() => {
      const dialog = container.querySelector(".dr-dialog");
      expect(dialog?.textContent).toContain("ファイルを読み取れませんでした");
      expect(dialog?.textContent).toContain("文書は変更されていません");
    });
    expect(importIr).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
