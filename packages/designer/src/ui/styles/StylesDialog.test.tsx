import type { IrDocument, IrTextElement } from "@denreport/core";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditorStore } from "../../state/store";
import { StylesDialog } from "./StylesDialog";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function textElement(overrides: Partial<IrTextElement> = {}): IrTextElement {
  return {
    type: "text",
    id: "t1",
    x: 10,
    y: 10,
    pages: "first",
    w: 40,
    h: 8,
    text: "見本",
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
    ...overrides,
  };
}

function makeStore(document?: Partial<IrDocument>): EditorStore {
  const base: IrDocument = {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements: [textElement()],
  };
  return new EditorStore({ ...base, ...document });
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

function render(store: EditorStore, onClose = (): void => {}): void {
  act(() => {
    root.render(<StylesDialog store={store} onClose={onClose} />);
  });
}

function buttonByText(text: string): HTMLButtonElement {
  const button = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find((b) => (b.getAttribute("aria-label") ?? b.textContent) === text);
  if (button === undefined) {
    throw new Error(`ボタンがない: ${text}`);
  }
  return button;
}

function click(el: Element): void {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** htmlFor で紐づく入力（NumberField / TextField）のみを対象とする。
    チェックボックスラベル（for なし）とは別扱い */
function inputByLabel(text: string): HTMLInputElement {
  const label = [...container.querySelectorAll("label[for]")].find(
    (l) => l.textContent === text,
  );
  const forId = label?.getAttribute("for");
  const el =
    forId === null || forId === undefined
      ? null
      : document.getElementById(forId);
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`ラベル "${text}" の入力がない`);
  }
  return el;
}

function setValue(el: HTMLInputElement, value: string): void {
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function blur(el: HTMLElement): void {
  act(() => {
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}

function checkboxByLabel(text: string): HTMLInputElement {
  const label = [...container.querySelectorAll("label:not([for])")].find(
    (l) => l.textContent === text,
  );
  const el = label?.querySelector('input[type="checkbox"]');
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`チェックボックスラベル "${text}" がない`);
  }
  return el;
}

describe("一覧表示", () => {
  it("スタイルが無ければ空である旨を表示する", () => {
    const store = makeStore();
    render(store);
    expect(container.textContent).toContain("スタイルはまだありません");
  });

  it("定義済みスタイルの name と属性要約を表示する", () => {
    const store = makeStore({
      styles: [{ name: "見出し", attrs: { fontSize: 14, align: "center" } }],
    });
    render(store);
    expect(inputByLabel("名前").value).toBe("見出し");
    expect(container.textContent).toContain("14pt");
    expect(container.textContent).toContain("中央");
  });
});

describe("新規作成", () => {
  it("「新しいスタイル」で未使用名・fontSize のみのスタイルを追加する", () => {
    const store = makeStore();
    render(store);
    click(buttonByText("＋ 新しいスタイル"));
    expect(store.getState().document.styles).toEqual([
      { name: "スタイル1", attrs: { fontSize: 10 } },
    ]);
  });

  it("選択が無いときは「選択要素から作成」が無効", () => {
    const store = makeStore();
    render(store);
    expect(buttonByText("選択要素から作成").disabled).toBe(true);
  });

  it("単一選択時に「選択要素から作成」で要素の属性を引き継いだスタイルを追加する", () => {
    const store = makeStore();
    act(() => {
      store.setSelection(["t1"]);
    });
    render(store);
    expect(buttonByText("選択要素から作成").disabled).toBe(false);
    click(buttonByText("選択要素から作成"));
    expect(store.getState().document.styles).toEqual([
      {
        name: "スタイル1",
        attrs: { fontSize: 10, align: "left", lineHeight: 1.25 },
      },
    ]);
  });
});

describe("属性編集", () => {
  it("属性編集が1 commit で参照要素へ反映される", () => {
    const store = makeStore({
      styles: [{ name: "見出し", attrs: { fontSize: 14 } }],
      elements: [textElement({ style: "見出し", fontSize: 14 })],
    });
    render(store);
    const before = store.canUndo();
    const fontSizeInput = inputByLabel("文字サイズ");
    setValue(fontSizeInput, "20");
    blur(fontSizeInput);

    expect(store.getState().document.styles).toEqual([
      { name: "見出し", attrs: { fontSize: 20 } },
    ]);
    expect(store.getState().document.elements[0]).toMatchObject({
      style: "見出し",
      fontSize: 20,
    });
    expect(before).toBe(false);
    expect(store.canUndo()).toBe(true);
    act(() => {
      store.undo();
    });
    expect(store.getState().document.elements[0]).toMatchObject({
      fontSize: 14,
    });
  });

  it("属性チェックを外すと attrs からキーを除去する", () => {
    const store = makeStore({
      styles: [{ name: "見出し", attrs: { fontSize: 14, align: "center" } }],
    });
    render(store);
    const checkbox = checkboxByLabel("整列");
    click(checkbox);
    expect(store.getState().document.styles).toEqual([
      { name: "見出し", attrs: { fontSize: 14 } },
    ]);
  });

  it("属性チェックを入れると既定値付きでキーを追加する", () => {
    const store = makeStore({
      styles: [{ name: "見出し", attrs: { fontSize: 14 } }],
    });
    render(store);
    const checkbox = checkboxByLabel("行間");
    click(checkbox);
    expect(store.getState().document.styles).toEqual([
      { name: "見出し", attrs: { fontSize: 14, lineHeight: 1.25 } },
    ]);
  });

  it("整列に「均等」を選べ、要約にも反映される", () => {
    const store = makeStore({
      styles: [{ name: "見出し", attrs: { fontSize: 14, align: "left" } }],
    });
    render(store);
    click(buttonByText("均等"));
    expect(store.getState().document.styles).toEqual([
      { name: "見出し", attrs: { fontSize: 14, align: "justify" } },
    ]);
    expect(container.textContent).toContain("均等");
  });
});

describe("名称変更・削除", () => {
  it("名称変更は参照要素の style も追随させる", () => {
    const store = makeStore({
      styles: [{ name: "見出し", attrs: { fontSize: 14 } }],
      elements: [textElement({ style: "見出し", fontSize: 14 })],
    });
    render(store);
    const nameInput = inputByLabel("名前");
    setValue(nameInput, "タイトル");
    blur(nameInput);
    expect(store.getState().document.styles).toEqual([
      { name: "タイトル", attrs: { fontSize: 14 } },
    ]);
    expect(store.getState().document.elements[0]).toMatchObject({
      style: "タイトル",
    });
  });

  it("空名は確定させない", () => {
    const store = makeStore({
      styles: [{ name: "見出し", attrs: { fontSize: 14 } }],
    });
    render(store);
    const nameInput = inputByLabel("名前");
    setValue(nameInput, "   ");
    blur(nameInput);
    expect(store.getState().document.styles).toEqual([
      { name: "見出し", attrs: { fontSize: 14 } },
    ]);
  });

  it("重複名は確定させない", () => {
    const store = makeStore({
      styles: [
        { name: "見出し", attrs: { fontSize: 14 } },
        { name: "本文", attrs: { fontSize: 10 } },
      ],
    });
    render(store);
    const nameInputs = [...container.querySelectorAll("label")]
      .filter((l) => l.textContent === "名前")
      .map((l) => document.getElementById(l.getAttribute("for") ?? ""));
    const first = nameInputs[0];
    if (!(first instanceof HTMLInputElement)) throw new Error("名前欄がない");
    setValue(first, "本文");
    blur(first);
    expect(store.getState().document.styles).toEqual([
      { name: "見出し", attrs: { fontSize: 14 } },
      { name: "本文", attrs: { fontSize: 10 } },
    ]);
  });

  it("削除は定義と参照の両方を除去し、要素の具体値は保持する", () => {
    const store = makeStore({
      styles: [{ name: "見出し", attrs: { fontSize: 14 } }],
      elements: [textElement({ style: "見出し", fontSize: 14 })],
    });
    render(store);
    click(buttonByText('スタイル "見出し" を削除'));
    expect(store.getState().document.styles).toBeUndefined();
    const el = store.getState().document.elements[0];
    expect(el).not.toHaveProperty("style");
    expect(el).toMatchObject({ fontSize: 14 });
  });
});
