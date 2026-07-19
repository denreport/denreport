import type { IrDocument } from "@denreport/core";
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorStore } from "../../state/store";
import { useEditorState } from "../useEditorState";
import { FootnotesSection } from "./FootnotesSection";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeDocument(): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements: [],
  };
}

function Wrapper(props: { readonly store: EditorStore }): ReactNode {
  const state = useEditorState(props.store);
  const errors = state.validationErrors.filter((error) =>
    error.path.startsWith("footnotes."),
  );
  return (
    <FootnotesSection
      store={props.store}
      document={state.document}
      errors={errors}
    />
  );
}

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function render(store: EditorStore): void {
  act(() => {
    root.render(<Wrapper store={store} />);
  });
}

function click(el: Element): void {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function buttonByText(text: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === text,
  );
  if (button === undefined) {
    throw new Error(`ボタンがない: ${text}`);
  }
  return button;
}

function inputByLabel(text: string): HTMLInputElement | HTMLTextAreaElement {
  const label = [...container.querySelectorAll("label")].find(
    (l) => l.textContent === text,
  );
  const forId = label?.getAttribute("for");
  const el =
    forId === null || forId === undefined
      ? null
      : document.getElementById(forId);
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    throw new Error(`ラベル "${text}" の入力がない`);
  }
  return el;
}

function setValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function blur(el: HTMLElement): void {
  act(() => {
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}

describe("脚注未定義の状態", () => {
  it("「脚注を使う」ボタンのみを表示する", () => {
    const store = new EditorStore(makeDocument());
    render(store);
    expect(container.textContent).toContain("脚注を使う");
    expect(() => buttonByText("脚注を削除")).toThrow();
  });

  it("「脚注を使う」で既定値の footnotes を1 commit で追加する", () => {
    const store = new EditorStore(makeDocument());
    render(store);
    click(buttonByText("脚注を使う"));
    expect(store.getState().document.footnotes).toEqual({
      x: 15,
      w: 180,
      bottom: 10,
      fontSize: 8,
      lineHeight: 1.25,
      pages: "all",
      notes: [],
    });
    act(() => {
      store.undo();
    });
    expect(store.getState().document.footnotes).toBeUndefined();
  });
});

describe("脚注定義済みの状態", () => {
  function storeWithFootnotes(): EditorStore {
    return new EditorStore({
      ...makeDocument(),
      footnotes: {
        x: 15,
        w: 180,
        bottom: 10,
        fontSize: 8,
        lineHeight: 1.25,
        pages: "all",
        notes: [],
      },
    });
  }

  it("ブロック設定の編集が commit に到達する", () => {
    const store = storeWithFootnotes();
    render(store);
    const xInput = inputByLabel("x");
    setValue(xInput, "20");
    blur(xInput);
    expect(store.getState().document.footnotes?.x).toBe(20);
  });

  it("注記の追加・編集・削除が1 commitずつになる", () => {
    const store = storeWithFootnotes();
    render(store);

    click(buttonByText("＋ 注記を追加"));
    expect(store.getState().document.footnotes?.notes).toEqual([
      { id: "note1", text: "" },
    ]);

    const textArea = inputByLabel("本文");
    setValue(textArea, "本体価格は税抜表示です");
    blur(textArea);
    expect(store.getState().document.footnotes?.notes[0]?.text).toBe(
      "本体価格は税抜表示です",
    );

    const deleteButton = container.querySelector('[aria-label="注記1を削除"]');
    if (deleteButton === null) {
      throw new Error("削除ボタンがない: 注記1を削除");
    }
    click(deleteButton);
    expect(store.getState().document.footnotes?.notes).toEqual([]);

    act(() => {
      store.undo();
    });
    expect(store.getState().document.footnotes?.notes).toEqual([
      { id: "note1", text: "本体価格は税抜表示です" },
    ]);
  });

  it("「脚注を削除」で footnotes キーを除去する", () => {
    const store = storeWithFootnotes();
    render(store);
    click(buttonByText("脚注を削除"));
    expect(store.getState().document.footnotes).toBeUndefined();
  });

  it("footnotes.* の検証エラーをフィールドに対応付けて表示する", () => {
    const store = new EditorStore({
      ...makeDocument(),
      footnotes: {
        x: -1,
        w: 180,
        bottom: 10,
        fontSize: 8,
        lineHeight: 1.25,
        pages: "all",
        notes: [],
      },
    });
    render(store);
    expect(container.textContent).toContain("x は 0 以上である必要があります");
  });

  it("{#id} 構文と採番順の案内文を表示する", () => {
    const store = storeWithFootnotes();
    render(store);
    expect(container.textContent).toContain("{#id}");
    expect(container.textContent).toContain("出現順");
  });

  it("「id をコピー」「{#id} をコピー」でクリップボードへ書き込む", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const store = new EditorStore({
      ...makeDocument(),
      footnotes: {
        x: 15,
        w: 180,
        bottom: 10,
        fontSize: 8,
        lineHeight: 1.25,
        pages: "all",
        notes: [{ id: "fee", text: "振込手数料はお客様負担です" }],
      },
    });
    render(store);

    click(buttonByText("id をコピー"));
    expect(writeText).toHaveBeenCalledExactlyOnceWith("fee");

    click(buttonByText("{#id} をコピー"));
    expect(writeText).toHaveBeenCalledWith("{#fee}");
  });
});
