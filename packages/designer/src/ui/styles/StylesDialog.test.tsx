import type { IrDocument, IrTextElement } from "@denreport/core";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MessagesContext } from "../../i18n/context";
import { en } from "../../i18n/messages/en";
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

/** Targets only inputs linked via htmlFor (NumberField / TextField).
    Checkbox labels (without for) are handled separately */
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

describe("list display", () => {
  it("shows an empty-state message when there are no styles", () => {
    const store = makeStore();
    render(store);
    expect(container.textContent).toContain("スタイルはまだありません");
  });

  it("shows the name and attribute summary of defined styles", () => {
    const store = makeStore({
      styles: [{ name: "見出し", attrs: { fontSize: 14, align: "center" } }],
    });
    render(store);
    expect(inputByLabel("名前").value).toBe("見出し");
    expect(container.textContent).toContain("14pt");
    expect(container.textContent).toContain("中央");
  });
});

describe("creating new", () => {
  it("adds a style with an unused name and only fontSize via 「＋ 新しいスタイル」", () => {
    const store = makeStore();
    render(store);
    click(buttonByText("＋ 新しいスタイル"));
    expect(store.getState().document.styles).toEqual([
      { name: "スタイル1", attrs: { fontSize: 10 } },
    ]);
  });

  it("「選択要素から作成」 is disabled when there is no selection", () => {
    const store = makeStore();
    render(store);
    expect(buttonByText("選択要素から作成").disabled).toBe(true);
  });

  it("adds a style inheriting the element's attributes via 「選択要素から作成」 when a single element is selected", () => {
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

describe("attribute editing", () => {
  it("an attribute edit is reflected to referencing elements in a single commit", () => {
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

  it("unchecking an attribute removes the key from attrs", () => {
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

  it("checking an attribute adds the key with a default value", () => {
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

  it("「均等」 can be selected for alignment and is reflected in the summary", () => {
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

describe("rename/delete", () => {
  it("renaming also updates the style of referencing elements", () => {
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

  it("does not commit an empty name", () => {
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

  it("does not commit a duplicate name", () => {
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

  it("deleting removes both the definition and the reference, keeping the element's concrete values", () => {
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

describe("en MessagesContext", () => {
  it("renders text in English, and generated names are also in English", () => {
    const store = makeStore();
    act(() => {
      root.render(
        <MessagesContext.Provider value={en}>
          <StylesDialog store={store} onClose={() => {}} />
        </MessagesContext.Provider>,
      );
    });
    expect(container.textContent).toContain("No styles yet.");
    click(buttonByText("+ New style"));
    expect(store.getState().document.styles).toEqual([
      { name: "Style 1", attrs: { fontSize: 10 } },
    ]);
  });

  it("alignment options and attribute summary are also in English", () => {
    const store = makeStore({
      styles: [{ name: "Heading", attrs: { fontSize: 14, align: "center" } }],
    });
    act(() => {
      root.render(
        <MessagesContext.Provider value={en}>
          <StylesDialog store={store} onClose={() => {}} />
        </MessagesContext.Provider>,
      );
    });
    expect(container.textContent).toContain("Center");
    click(buttonByText("Justify"));
    expect(store.getState().document.styles).toEqual([
      { name: "Heading", attrs: { fontSize: 14, align: "justify" } },
    ]);
  });
});
