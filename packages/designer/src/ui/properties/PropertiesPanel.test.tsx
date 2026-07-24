import type { IrDocument, IrElement } from "@denreport/core";
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleContext, MessagesContext } from "../../i18n/context";
import { en } from "../../i18n/messages/en";
import { ja } from "../../i18n/messages/ja";
import { IMAGE_PLACEHOLDER_SRC } from "../../state/constants";
import { layoutDocument } from "../../state/geometry";
import { EditorStore } from "../../state/store";
import type { InteractionState } from "../canvas/interaction";
import { SelectionOverlay } from "../canvas/SelectionOverlay";
import { PropertiesPanel } from "./PropertiesPanel";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const IDLE: InteractionState = { kind: "idle" };

const ELEMENTS: readonly IrElement[] = [
  {
    type: "text",
    id: "t1",
    x: 10,
    y: 10,
    pages: "first",
    w: 40,
    h: 8,
    text: "見出し",
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  },
  {
    type: "line",
    id: "l1",
    x: 10,
    y: 30,
    pages: "first",
    orientation: "horizontal",
    length: 50,
    thickness: 0.3,
  },
  {
    type: "rect",
    id: "r1",
    x: 10,
    y: 40,
    pages: "first",
    w: 40,
    h: 20,
    borderWidth: 0.3,
  },
  {
    type: "ellipse",
    id: "e1",
    x: 150,
    y: 40,
    pages: "first",
    w: 30,
    h: 20,
    borderWidth: 0.3,
  },
  {
    type: "table",
    id: "tbl1",
    x: 10,
    y: 90,
    bind: "items",
    columns: [
      { key: "col1", label: "列1", width: 40, align: "left" },
      { key: "col2", label: "列2", width: 40, align: "left" },
    ],
    rowHeight: 8,
    headerHeight: 8,
    fontSize: 10,
    maxY: 240,
    continuationY: 20,
    minRows: 3,
  },
  {
    type: "image",
    id: "img1",
    x: 60,
    y: 10,
    pages: "first",
    w: 30,
    h: 30,
    src: IMAGE_PLACEHOLDER_SRC,
  },
  {
    type: "flex",
    id: "f1",
    x: 10,
    y: 200,
    pages: "first",
    direction: "column",
    gap: 2,
    justifyContent: "start",
    alignItems: "start",
    children: [
      {
        type: "text",
        id: "c1",
        w: 40,
        h: 8,
        text: "子",
        fontSize: 10,
        align: "left",
        lineHeight: 1.25,
      },
    ],
  },
  {
    type: "pageNumber",
    id: "p1",
    x: 150,
    y: 280,
    pages: "all",
    w: 30,
    h: 6,
    format: "{n} / {N}",
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  },
  {
    type: "barcode",
    id: "bc1",
    x: 60,
    y: 50,
    pages: "first",
    w: 30,
    h: 30,
    symbology: "qrcode",
    value: "{code}",
  },
];

function makeStore(): EditorStore {
  const document: IrDocument = {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements: ELEMENTS,
  };
  return new EditorStore(document);
}

function makeStoreWithStyle(): EditorStore {
  const document: IrDocument = {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    styles: [{ name: "見出し", attrs: { fontSize: 20, align: "center" } }],
    elements: ELEMENTS,
  };
  return new EditorStore(document);
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

function render(node: ReactNode): void {
  act(() => {
    root.render(node);
  });
}

function select(store: EditorStore, ids: readonly string[]): void {
  act(() => {
    store.setSelection(ids);
  });
}

function elementById(store: EditorStore, id: string): IrElement {
  const el = store.getState().document.elements.find((e) => e.id === id);
  if (el === undefined) {
    throw new Error(`要素がない: ${id}`);
  }
  return el;
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

function selectByLabel(text: string): HTMLSelectElement | null {
  const label = [...container.querySelectorAll("label")].find(
    (l) => l.textContent === text,
  );
  const forId = label?.getAttribute("for");
  const el =
    forId === null || forId === undefined
      ? null
      : document.getElementById(forId);
  return el instanceof HTMLSelectElement ? el : null;
}

function setSelectValue(el: HTMLSelectElement, value: string): void {
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )?.set?.call(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
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

function requireSelectByLabel(text: string): HTMLSelectElement {
  const el = selectByLabel(text);
  if (el === null) {
    throw new Error(`セレクトがない: ${text}`);
  }
  return el;
}

describe("PropertiesPanel routing", () => {
  it("shows document settings when nothing is selected", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    expect(container.textContent).toContain("文書設定");
    expect(inputByLabel("幅").value).toBe("210.0");
    expect(inputByLabel("高さ").value).toBe("297.0");
    expect(inputByLabel("フォント名").value).toBe("NotoSansJP");
  });

  it("shows a type-specific form for a single selection (all 8 types)", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    const cases: readonly (readonly [string, keyof typeof ja.elementTypes])[] =
      [
        ["t1", "text"],
        ["l1", "line"],
        ["r1", "rect"],
        ["e1", "ellipse"],
        ["tbl1", "table"],
        ["img1", "image"],
        ["f1", "flex"],
        ["p1", "pageNumber"],
        ["bc1", "barcode"],
      ];
    for (const [id, type] of cases) {
      select(store, [id]);
      expect(container.querySelector(".dr-type-badge")?.textContent).toBe(
        ja.elementTypes[type],
      );
      expect(container.querySelector(".dr-props-id")?.textContent).toBe(id);
    }
  });

  it("shows a bulk-edit form with the selection count for a multi-selection", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["t1", "r1"]);
    expect(container.textContent).toContain("2 個の要素を選択中");
    expect(container.querySelector(".dr-field")).not.toBeNull();
    expect(container.querySelector(".dr-type-badge")).toBeNull();
  });

  it("treats a selected id absent from the document as no selection", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["ghost"]);
    expect(container.textContent).toContain("文書設定");
  });

  it("toggling the qualified-invoice checkbox adds/removes docType in a single commit", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    const checkbox = container.querySelector('input[type="checkbox"]');
    if (!(checkbox instanceof HTMLInputElement)) {
      throw new Error("チェックボックスがない");
    }
    expect(checkbox.checked).toBe(false);

    click(checkbox);
    expect(store.getState().document.docType).toBe("qualifiedInvoice");
    expect(store.canUndo()).toBe(true);

    store.undo();
    expect("docType" in store.getState().document).toBe(false);
    expect(store.canUndo()).toBe(false);
  });

  it("wraps the 「チェック」 part of the qualified-invoice label in nowrap so it isn't split mid-word", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    const labels = [...container.querySelectorAll(".dr-frow-label")];
    const label = labels.find((el) => el.textContent === "記載事項チェック");
    expect(label?.textContent).toBe("記載事項チェック");
    expect(label?.querySelector(".dr-nowrap")?.textContent).toBe("チェック");
  });

  it("hides x / y / page for a flex-child selection and shows a note instead", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["c1"]);
    expect(container.querySelector(".dr-type-badge")?.textContent).toBe(
      ja.elementTypes.text,
    );
    const labels = [...container.querySelectorAll("label")].map(
      (l) => l.textContent,
    );
    expect(labels).not.toContain("x");
    expect(labels).not.toContain("y");
    expect(container.querySelector('fieldset[aria-label="ページ"]')).toBeNull();
    expect(container.textContent).toContain("位置はフレックスが決定");
  });
});

describe("Paper size presets", () => {
  it("shows A3/A4/A5/B5(ISO)/Letter/Legal as options in the English UI, with the blank A4 default preselected", () => {
    const store = makeStore();
    // The preset candidate set and the labels both follow the UI locale (here, en)
    render(
      <LocaleContext.Provider value="en">
        <MessagesContext.Provider value={en}>
          <PropertiesPanel store={store} interaction={IDLE} />
        </MessagesContext.Provider>
      </LocaleContext.Provider>,
    );
    const select = requireSelectByLabel(en.propertiesBulk.document.size);
    expect(
      [...select.querySelectorAll("option")].map((o) => o.textContent),
    ).toEqual(["A3", "A4", "A5", "B5", "Letter", "Legal", "Custom"]);
    expect(select.value).toBe("a4");
  });

  it("shows A3/A4/A5/B4/B5/はがき/レター/カスタム as options in the Japanese UI", () => {
    const store = makeStore();
    render(
      <LocaleContext.Provider value="ja">
        <PropertiesPanel store={store} interaction={IDLE} />
      </LocaleContext.Provider>,
    );
    const select = requireSelectByLabel("サイズ");
    expect(
      [...select.querySelectorAll("option")].map((o) => o.textContent),
    ).toEqual(["A3", "A4", "A5", "B4", "B5", "はがき", "レター", "カスタム"]);
  });

  it("selecting a preset commits width and height together", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    setSelectValue(requireSelectByLabel("サイズ"), "b5jis");
    expect(store.getState().document.page).toEqual({ width: 182, height: 257 });
    expect(inputByLabel("幅").value).toBe("182.0");
    expect(inputByLabel("高さ").value).toBe("257.0");
  });

  it("selecting Letter commits the standard dimensions (215.9x279.4mm) as-is", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    setSelectValue(requireSelectByLabel("サイズ"), "letter");
    expect(store.getState().document.page).toEqual({
      width: 215.9,
      height: 279.4,
    });
    expect(inputByLabel("幅").value).toBe("215.9");
    expect(inputByLabel("高さ").value).toBe("279.4");
  });

  it("preselects Custom for dimensions that don't match any preset", () => {
    const store = makeStore();
    act(() => {
      store.commit({
        ...store.getState().document,
        page: { width: 200, height: 300 },
      });
    });
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    expect(requireSelectByLabel("サイズ").value).toBe("custom");
  });

  it("the select display follows when manually editing width/height to match a preset", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    setValue(inputByLabel("幅"), "148");
    blur(inputByLabel("幅"));
    setValue(inputByLabel("高さ"), "210");
    blur(inputByLabel("高さ"));
    expect(requireSelectByLabel("サイズ").value).toBe("a5");
  });

  it("switching locale at runtime updates the candidate set, falling back the select to Custom without altering the page size when the current preset isn't offered", () => {
    const store = makeStore();
    act(() => {
      store.commit({
        ...store.getState().document,
        page: { width: 100, height: 148 }, // postcard: only in the ja preset set
      });
    });
    // Both renders keep an identical provider tree shape (only the values change) so this
    // rerender exercises reactivity rather than an unmount/remount of PropertiesPanel
    render(
      <LocaleContext.Provider value="ja">
        <MessagesContext.Provider value={ja}>
          <PropertiesPanel store={store} interaction={IDLE} />
        </MessagesContext.Provider>
      </LocaleContext.Provider>,
    );
    expect(requireSelectByLabel("サイズ").value).toBe("postcard");

    render(
      <LocaleContext.Provider value="en">
        <MessagesContext.Provider value={en}>
          <PropertiesPanel store={store} interaction={IDLE} />
        </MessagesContext.Provider>
      </LocaleContext.Provider>,
    );
    const enSelect = requireSelectByLabel(en.propertiesBulk.document.size);
    expect(
      [...enSelect.querySelectorAll("option")].map((o) => o.textContent),
    ).toEqual(["A3", "A4", "A5", "B5", "Letter", "Legal", "Custom"]);
    expect(enSelect.value).toBe("custom");
    expect(store.getState().document.page).toEqual({ width: 100, height: 148 });
  });
});

describe("Name field", () => {
  it("input in the header's name field reaches commit and reverts with undo", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["r1"]);

    const nameInput = inputByLabel("名前");
    expect(nameInput.value).toBe("");
    setValue(nameInput, "見出し枠");
    blur(nameInput);
    expect(elementById(store, "r1")).toMatchObject({ name: "見出し枠" });

    act(() => {
      store.undo();
    });
    expect(elementById(store, "r1")).not.toHaveProperty("name");
  });

  it("changing to blank removes the name attribute", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["r1"]);

    const nameInput = inputByLabel("名前");
    setValue(nameInput, "見出し枠");
    blur(nameInput);
    expect(elementById(store, "r1")).toMatchObject({ name: "見出し枠" });

    setValue(nameInput, "  ");
    blur(nameInput);
    expect(elementById(store, "r1")).not.toHaveProperty("name");
  });

  it("shows and allows editing the name field for flex children too", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["c1"]);

    const nameInput = inputByLabel("名前");
    setValue(nameInput, "子要素名");
    blur(nameInput);
    const flex = elementById(store, "f1");
    expect(flex.type === "flex" ? flex.children[0] : null).toMatchObject({
      name: "子要素名",
    });
  });
});

describe("Rotate field", () => {
  it("shows the rotate field except for table / flex", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["r1"]);
    expect(inputByLabel("回転")).toBeDefined();

    select(store, ["tbl1"]);
    expect(
      [...container.querySelectorAll("label")].some(
        (l) => l.textContent === "回転",
      ),
    ).toBe(false);

    select(store, ["f1"]);
    expect(
      [...container.querySelectorAll("label")].some(
        (l) => l.textContent === "回転",
      ),
    ).toBe(false);
  });

  it("input reaches commit rounded to 0.1° and reverts with undo", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["r1"]);

    const input = inputByLabel("回転");
    expect(input.value).toBe("0.0");
    setValue(input, "45.04");
    blur(input);
    expect(elementById(store, "r1")).toMatchObject({ rotate: 45 });

    act(() => {
      store.undo();
    });
    expect(elementById(store, "r1")).not.toHaveProperty("rotate");
  });

  it("changing to 0 removes the rotate attribute", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["r1"]);

    const input = inputByLabel("回転");
    setValue(input, "90");
    blur(input);
    expect(elementById(store, "r1")).toMatchObject({ rotate: 90 });

    setValue(input, "0");
    blur(input);
    expect(elementById(store, "r1")).not.toHaveProperty("rotate");
  });

  it("shows and allows editing the rotate field for flex children too", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["c1"]);

    const input = inputByLabel("回転");
    setValue(input, "-15");
    blur(input);
    const flex = elementById(store, "f1");
    expect(flex.type === "flex" ? flex.children[0] : null).toMatchObject({
      rotate: -15,
    });
  });
});

describe("Style section", () => {
  it("shows the select only for style-eligible types (text), not for ineligible ones (image)", () => {
    const store = makeStoreWithStyle();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["t1"]);
    expect(selectByLabel("スタイル")).not.toBeNull();
    select(store, ["img1"]);
    expect(selectByLabel("スタイル")).toBeNull();
  });

  it("applying a style via select reflects the matching attributes and reverts with undo", () => {
    const store = makeStoreWithStyle();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["t1"]);
    const styleSelect = selectByLabel("スタイル");
    if (styleSelect === null) throw new Error("スタイル select がない");

    setSelectValue(styleSelect, "見出し");
    expect(elementById(store, "t1")).toMatchObject({
      style: "見出し",
      fontSize: 20,
      align: "center",
    });

    act(() => {
      store.undo();
    });
    const reverted = elementById(store, "t1");
    expect(reverted).not.toHaveProperty("style");
    expect(reverted).toMatchObject({ fontSize: 10, align: "left" });
  });

  it("selecting no style removes only the style attribute and keeps the concrete values", () => {
    const store = makeStoreWithStyle();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["t1"]);
    const styleSelect = selectByLabel("スタイル");
    if (styleSelect === null) throw new Error("スタイル select がない");

    setSelectValue(styleSelect, "見出し");
    setSelectValue(styleSelect, "");
    const el = elementById(store, "t1");
    expect(el).not.toHaveProperty("style");
    expect(el).toMatchObject({ fontSize: 20, align: "center" });
  });
});

describe("Representative edit paths", () => {
  it("{key} input in the text field reaches commit", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["t1"]);

    const textInput = inputByLabel("テキスト");
    setValue(textInput, "{customerName}");
    blur(textInput);
    const el = elementById(store, "t1");
    expect(el).toMatchObject({ text: "{customerName}" });

    act(() => {
      store.undo();
    });
    expect(elementById(store, "t1")).toMatchObject({ text: "見出し" });
  });

  it("shows guidance text for {#id} syntax in the text edit field", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["t1"]);
    expect(container.querySelector(".dr-fhint")?.textContent).toContain(
      "{#id}",
    );
  });

  it("referencing an undefined footnote id (F03) shows an error in the text edit field", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["t1"]);

    const textInput = inputByLabel("テキスト");
    setValue(textInput, "見出し{#missing}");
    blur(textInput);

    expect(container.querySelector(".dr-field.is-error")).not.toBeNull();
    expect(container.querySelector(".dr-ferr")?.textContent).toContain(
      "missing",
    );
  });

  it("writing a footnote mark on text inside flex (F04) shows an error in the text edit field", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["c1"]);

    const textInput = inputByLabel("テキスト");
    setValue(textInput, "子{#note1}");
    blur(textInput);

    expect(container.querySelector(".dr-ferr")?.textContent).toBe(
      "脚注マークは flex 内の text には書けません",
    );
  });

  it("adding a column then changing width updates the sum-of-column-widths display", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["tbl1"]);
    expect(container.textContent).toContain("Σ列幅 = 80.0 mm");

    click(buttonByText("＋ 列を追加"));
    let table = elementById(store, "tbl1");
    expect(table.type === "table" ? table.columns.length : 0).toBe(3);
    expect(container.textContent).toContain("Σ列幅 = 120.0 mm");

    const widthInput = container
      .querySelectorAll(".dr-col-card")[2]
      ?.querySelector(".dr-col-w input");
    if (!(widthInput instanceof HTMLInputElement)) {
      throw new Error("幅の入力がない");
    }
    setValue(widthInput, "60");
    blur(widthInput);
    table = elementById(store, "tbl1");
    expect(table.type === "table" ? table.columns[2]?.width : 0).toBe(60);
    expect(container.textContent).toContain("Σ列幅 = 140.0 mm");
  });

  it("editing font size and alignment reaches commit", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["t1"]);

    const fontSizeInput = inputByLabel("文字サイズ");
    setValue(fontSizeInput, "14");
    blur(fontSizeInput);
    expect(elementById(store, "t1")).toMatchObject({ fontSize: 14 });

    click(buttonByText("右"));
    expect(elementById(store, "t1")).toMatchObject({ align: "right" });
  });

  it("editing table minRows / maxY reaches commit", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["tbl1"]);

    const minRowsInput = inputByLabel("最低行数");
    setValue(minRowsInput, "5");
    blur(minRowsInput);
    expect(elementById(store, "tbl1")).toMatchObject({ minRows: 5 });

    const maxYInput = inputByLabel("下端（maxY）");
    setValue(maxYInput, "250");
    blur(maxYInput);
    expect(elementById(store, "tbl1")).toMatchObject({ maxY: 250 });
  });

  it("the flex main-axis size toggle shows the content size as the explicit initial value, and OFF removes the attribute", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["f1"]);
    expect(container.textContent).toContain("導出 = 8.0 mm");

    const checkbox = container.querySelector('input[type="checkbox"]');
    if (!(checkbox instanceof HTMLInputElement)) {
      throw new Error("チェックボックスがない");
    }
    click(checkbox);
    expect(elementById(store, "f1")).toMatchObject({ h: 8 });

    const mainInput = inputByLabel("h");
    setValue(mainInput, "40");
    blur(mainInput);
    expect(elementById(store, "f1")).toMatchObject({ h: 40 });

    const checkbox2 = container.querySelector('input[type="checkbox"]');
    if (!(checkbox2 instanceof HTMLInputElement)) {
      throw new Error("チェックボックスがない");
    }
    click(checkbox2);
    const flex = elementById(store, "f1");
    expect("h" in flex && flex.h !== undefined).toBe(false);
  });

  it("editing another attribute before the image finishes loading doesn't overwrite the src commit", async () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["img1"]);

    const fileInput = inputByLabel("ファイル");
    const file = new File([new Uint8Array([137, 80, 78, 71])], "logo.png", {
      type: "image/png",
    });
    Object.defineProperty(fileInput, "files", { value: [file] });
    act(() => {
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Edit w on the same element before FileReader completes
    const widthInput = inputByLabel("w");
    setValue(widthInput, "50");
    blur(widthInput);
    expect(elementById(store, "img1")).toMatchObject({ w: 50 });

    await act(async () => {
      await vi.waitFor(() => {
        const img = elementById(store, "img1");
        expect(
          img.type === "image" && img.src.startsWith("data:image/png"),
        ).toBe(true);
      });
    });
    expect(elementById(store, "img1")).toMatchObject({ w: 50 });
  });

  it("switching barcode symbology and editing the value reaches commit", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["bc1"]);

    click(buttonByText("EAN13"));
    expect(elementById(store, "bc1")).toMatchObject({ symbology: "ean13" });

    const valueInput = inputByLabel("値");
    setValue(valueInput, "4912345678904");
    blur(valueInput);
    expect(elementById(store, "bc1")).toMatchObject({
      value: "4912345678904",
    });
  });
});

describe("Shape style (color, stroke style, corner radius, stripe) edit paths", () => {
  it("line color/stroke-style commit, and attribute removal on reverting to defaults", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["l1"]);

    setValue(inputByLabel("色"), "#ff0000");
    expect(elementById(store, "l1")).toMatchObject({ color: "#ff0000" });

    setSelectValue(requireSelectByLabel("線種"), "dashed");
    expect(elementById(store, "l1")).toMatchObject({ strokeStyle: "dashed" });

    setValue(inputByLabel("色"), "#000000");
    let l1 = elementById(store, "l1");
    expect("color" in l1 && l1.color !== undefined).toBe(false);

    setSelectValue(requireSelectByLabel("線種"), "solid");
    l1 = elementById(store, "l1");
    expect("strokeStyle" in l1 && l1.strokeStyle !== undefined).toBe(false);
  });

  it("rect border color/corner radius commit, and attribute removal on reverting to defaults", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["r1"]);

    setValue(inputByLabel("枠線色"), "#112233");
    expect(elementById(store, "r1")).toMatchObject({ borderColor: "#112233" });

    const radiusInput = inputByLabel("角丸半径");
    setValue(radiusInput, "3");
    blur(radiusInput);
    expect(elementById(store, "r1")).toMatchObject({ cornerRadius: 3 });

    setValue(radiusInput, "0");
    blur(radiusInput);
    let r1 = elementById(store, "r1");
    expect("cornerRadius" in r1 && r1.cornerRadius !== undefined).toBe(false);

    setValue(inputByLabel("枠線色"), "#000000");
    r1 = elementById(store, "r1");
    expect("borderColor" in r1 && r1.borderColor !== undefined).toBe(false);
  });

  it("rect stroke style commit, and attribute removal on reverting to the default", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["r1"]);

    setSelectValue(requireSelectByLabel("線種"), "dotted");
    expect(elementById(store, "r1")).toMatchObject({ borderStyle: "dotted" });

    setSelectValue(requireSelectByLabel("線種"), "solid");
    const r1 = elementById(store, "r1");
    expect("borderStyle" in r1 && r1.borderStyle !== undefined).toBe(false);
  });

  it("rect fill color toggles attribute presence via the allowNone toggle", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["r1"]);

    const fillCheckbox = container.querySelector('input[type="checkbox"]');
    if (!(fillCheckbox instanceof HTMLInputElement)) {
      throw new Error("塗り「なし」チェックボックスがない");
    }
    expect(fillCheckbox.checked).toBe(true); // fillColor unspecified = none
    click(fillCheckbox);
    let r1 = elementById(store, "r1");
    expect(r1).toMatchObject({ fillColor: "#000000" });

    setValue(inputByLabel("塗り色"), "#eeeeee");
    expect(elementById(store, "r1")).toMatchObject({ fillColor: "#eeeeee" });

    click(container.querySelector('input[type="checkbox"]') as Element);
    r1 = elementById(store, "r1");
    expect("fillColor" in r1 && r1.fillColor !== undefined).toBe(false);
  });

  it("ellipse placement/border/fill commits reach the store", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["e1"]);

    const wInput = inputByLabel("w");
    setValue(wInput, "50");
    blur(wInput);
    expect(elementById(store, "e1")).toMatchObject({ w: 50 });

    setValue(inputByLabel("枠線色"), "#123456");
    expect(elementById(store, "e1")).toMatchObject({ borderColor: "#123456" });

    const fillCheckbox = container.querySelector('input[type="checkbox"]');
    if (!(fillCheckbox instanceof HTMLInputElement)) {
      throw new Error("塗り「なし」チェックボックスがない");
    }
    click(fillCheckbox);
    setValue(inputByLabel("塗り色"), "#abcdef");
    expect(elementById(store, "e1")).toMatchObject({ fillColor: "#abcdef" });
  });

  it("table frame/grid line width and style commit, and attribute removal on reverting to defaults", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["tbl1"]);

    const frameWidthInput = inputByLabel("外枠の太さ");
    expect(frameWidthInput.value).toBe("0.40"); // Display of the TABLE_FRAME_WIDTH default value
    setValue(frameWidthInput, "1");
    blur(frameWidthInput);
    expect(elementById(store, "tbl1")).toMatchObject({ frameWidth: 1 });

    setSelectValue(requireSelectByLabel("外枠の線種"), "dashed");
    expect(elementById(store, "tbl1")).toMatchObject({ frameStyle: "dashed" });

    const gridWidthInput = inputByLabel("内部罫線の太さ");
    expect(gridWidthInput.value).toBe("0.25"); // Display of the TABLE_GRID_WIDTH default value
    setValue(gridWidthInput, "0.6");
    blur(gridWidthInput);
    expect(elementById(store, "tbl1")).toMatchObject({ gridWidth: 0.6 });

    setSelectValue(requireSelectByLabel("内部罫線の線種"), "dotted");
    expect(elementById(store, "tbl1")).toMatchObject({ gridStyle: "dotted" });

    setValue(frameWidthInput, "0.4");
    blur(frameWidthInput);
    setValue(gridWidthInput, "0.25");
    blur(gridWidthInput);
    setSelectValue(requireSelectByLabel("外枠の線種"), "solid");
    setSelectValue(requireSelectByLabel("内部罫線の線種"), "solid");
    const tbl1 = elementById(store, "tbl1");
    expect("frameWidth" in tbl1 && tbl1.frameWidth !== undefined).toBe(false);
    expect("gridWidth" in tbl1 && tbl1.gridWidth !== undefined).toBe(false);
    expect("frameStyle" in tbl1 && tbl1.frameStyle !== undefined).toBe(false);
    expect("gridStyle" in tbl1 && tbl1.gridStyle !== undefined).toBe(false);
  });

  it("the table stripe toggle sets the default color when ON and removes stripeColor when OFF", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["tbl1"]);

    let tbl1 = elementById(store, "tbl1");
    expect("stripeColor" in tbl1).toBe(false);
    expect(container.querySelector('input[type="checkbox"]')).not.toBeNull();

    const toggle = container.querySelector('input[type="checkbox"]');
    if (!(toggle instanceof HTMLInputElement)) {
      throw new Error("網掛けトグルがない");
    }
    click(toggle);
    tbl1 = elementById(store, "tbl1");
    expect(tbl1).toMatchObject({ stripeColor: "#f0f0f0" });

    setValue(inputByLabel("縞の色"), "#e0e0e0");
    expect(elementById(store, "tbl1")).toMatchObject({
      stripeColor: "#e0e0e0",
    });

    click(container.querySelector('input[type="checkbox"]') as Element);
    tbl1 = elementById(store, "tbl1");
    expect("stripeColor" in tbl1).toBe(false);
  });

  it("text / pageNumber font-color commit, and attribute removal on reverting to the default", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);

    select(store, ["t1"]);
    setValue(inputByLabel("文字色"), "#ff0000");
    expect(elementById(store, "t1")).toMatchObject({ color: "#ff0000" });
    setValue(inputByLabel("文字色"), "#000000");
    const t1 = elementById(store, "t1");
    expect("color" in t1 && t1.color !== undefined).toBe(false);

    select(store, ["p1"]);
    setValue(inputByLabel("文字色"), "#00ff00");
    expect(elementById(store, "p1")).toMatchObject({ color: "#00ff00" });
    setValue(inputByLabel("文字色"), "#000000");
    const p1 = elementById(store, "p1");
    expect("color" in p1 && p1.color !== undefined).toBe(false);
  });
});

describe("Conditions for showing the maxY guide line", () => {
  function renderOverlay(store: EditorStore): void {
    const state = store.getState();
    render(
      <SelectionOverlay
        state={state}
        layout={layoutDocument(state.document, state.view.pageContext)}
        interaction={{ kind: "idle" }}
      />,
    );
  }

  it("shows only while a single table is selected", () => {
    const store = makeStore();
    store.setSelection(["tbl1"]);
    renderOverlay(store);
    expect(container.querySelector(".dr-maxy-line")).not.toBeNull();
    expect(container.querySelector(".dr-maxy-chip")?.textContent).toBe(
      "maxY 240",
    );
  });

  it("doesn't show for a non-table single selection or a multi-selection", () => {
    const store = makeStore();
    store.setSelection(["t1"]);
    renderOverlay(store);
    expect(container.querySelector(".dr-maxy-line")).toBeNull();

    store.setSelection(["tbl1", "t1"]);
    renderOverlay(store);
    expect(container.querySelector(".dr-maxy-line")).toBeNull();
  });
});

describe("Live display while dragging", () => {
  it("shows the committed value when idle", () => {
    const store = makeStore();
    select(store, ["r1"]);
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    expect(inputByLabel("x").value).toBe("10.0");
    expect(inputByLabel("w").value).toBe("40.0");
  });

  it("shows the offset-added x/y for the selected id while moving", () => {
    const store = makeStore();
    select(store, ["t1"]);
    const interaction: InteractionState = {
      kind: "moving",
      ids: ["t1"],
      start: { x: 10, y: 10 },
      offset: { x: 5, y: 3 },
      guides: [],
      flexId: null,
      insertIndex: null,
    };
    render(<PropertiesPanel store={store} interaction={interaction} />);
    expect(inputByLabel("x").value).toBe("15.0");
    expect(inputByLabel("y").value).toBe("13.0");
  });

  it("shows interaction.box's values for w/h while resizing", () => {
    const store = makeStore();
    select(store, ["r1"]);
    const interaction: InteractionState = {
      kind: "resizing",
      id: "r1",
      handle: "se",
      start: { x: 0, y: 0 },
      box: { x: 10, y: 40, w: 60, h: 25 },
      guides: [],
    };
    render(<PropertiesPanel store={store} interaction={interaction} />);
    expect(inputByLabel("w").value).toBe("60.0");
    expect(inputByLabel("h").value).toBe("25.0");
  });

  it("doesn't show y live for table + rest context + moving", () => {
    const store = makeStore();
    act(() => {
      store.setView({ pageContext: "rest" });
    });
    select(store, ["tbl1"]);
    const interaction: InteractionState = {
      kind: "moving",
      ids: ["tbl1"],
      start: { x: 0, y: 0 },
      offset: { x: 5, y: 30 },
      guides: [],
      flexId: null,
      insertIndex: null,
    };
    render(<PropertiesPanel store={store} interaction={interaction} />);
    expect(inputByLabel("x").value).toBe("15.0");
    expect(inputByLabel("y（1ページ目）").value).toBe("90.0");
  });
});

// The minimal TTF that readAscentPerEm can read (glyf + head.unitsPerEm + hhea.ascender)
function localTtf(): Uint8Array<ArrayBuffer> {
  const headOffset = 12 + 3 * 16;
  const hheaOffset = headOffset + 54;
  const bytes = new Uint8Array(hheaOffset + 36);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x00010000);
  view.setUint16(4, 3);
  view.setUint32(12, 0x676c7966); // 'glyf'
  view.setUint32(28, 0x68656164); // 'head'
  view.setUint32(28 + 8, headOffset);
  view.setUint32(28 + 12, 54);
  view.setUint32(44, 0x68686561); // 'hhea'
  view.setUint32(44 + 8, hheaOffset);
  view.setUint32(44 + 12, 36);
  view.setUint16(headOffset + 18, 1000);
  view.setInt16(hheaOffset + 4, 800);
  return bytes;
}

function stubQueryLocalFonts(): void {
  vi.stubGlobal("queryLocalFonts", () =>
    Promise.resolve([
      {
        postscriptName: "Local-Regular",
        fullName: "Local Font",
        family: "Local",
        style: "Regular",
        blob: async () => new Blob([localTtf()]),
      },
    ]),
  );
}

describe("Selecting from PC fonts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("the button opens the dialog, and confirming a selection commits font.regular and registers it", async () => {
    stubQueryLocalFonts();
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);

    click(buttonByText("標準のフォントを選択…"));
    await vi.waitFor(() => {
      expect(container.querySelector(".dr-dialog")).not.toBeNull();
    });
    await vi.waitFor(() => {
      expect(container.querySelector(".dr-font-name")).not.toBeNull();
    });

    const fontRow = [...container.querySelectorAll(".dr-font-name")]
      .find((el) => el.textContent === "Local Font")
      ?.closest("button");
    if (!(fontRow instanceof HTMLButtonElement)) {
      throw new Error("フォント行がない: Local Font");
    }
    click(fontRow);
    await vi.waitFor(() => {
      expect(buttonByText("このフォントを使う").disabled).toBe(false);
    });
    click(buttonByText("このフォントを使う"));

    await vi.waitFor(() => {
      expect(store.getState().document.font.regular).toBe("LocalFont");
    });
    expect(store.getState().dirty).toBe(true);
    expect(store.getState().fontRegistry.get("LocalFont")?.displayName).toBe(
      "Local Font",
    );
    expect(container.querySelector(".dr-dialog")).toBeNull();

    act(() => {
      store.undo();
    });
    expect(store.getState().document.font.regular).toBe("NotoSansJP");
    expect(store.getState().fontRegistry.get("LocalFont")).toBeDefined();

    act(() => {
      store.redo();
    });
    expect(store.getState().document.font.regular).toBe("LocalFont");
    expect(inputByLabel("フォント名").value).toBe("LocalFont");
  });

  it("shows explanatory text instead of the button in unsupported environments", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    expect(container.textContent).toContain(
      "PC 内フォントの一覧取得に対応していません",
    );
    expect(() => buttonByText("PC のフォントから選択…")).toThrow();
  });

  it("a font.name absent from both the registry and bundled names shows a missing notice", () => {
    const store = makeStore();
    act(() => {
      store.commit({
        ...store.getState().document,
        font: { regular: "GoneFont" },
      });
    });
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    expect(container.textContent).toContain(
      "実データ未選択（同梱フォントで代替されます）",
    );
  });
});

describe("en locale display", () => {
  it("the per-element panel renders with an English MessagesContext", () => {
    const store = makeStore();
    render(
      <MessagesContext.Provider value={en}>
        <PropertiesPanel store={store} interaction={IDLE} />
      </MessagesContext.Provider>,
    );

    select(store, ["t1"]);
    expect(container.textContent).toContain("Content");
    expect(container.textContent).toContain("Placement");
    expect(container.textContent).toContain("Decoration");
    expect(inputByLabel("Name").value).toBe("");
    expect(inputByLabel("Rotate").value).toBe("0.0");

    select(store, ["l1"]);
    expect(container.textContent).toContain("Shape");

    select(store, ["f1"]);
    expect(container.textContent).toContain("Layout");
    expect(container.textContent).toContain("Set explicitly");

    select(store, ["bc1"]);
    expect(container.textContent).toContain("Barcode");
    expect(container.textContent).toContain("Symbology");
  });

  it("the document settings panel's font slot names render in English", () => {
    const store = makeStore();
    render(
      <MessagesContext.Provider value={en}>
        <PropertiesPanel store={store} interaction={IDLE} />
      </MessagesContext.Provider>,
    );

    expect(container.textContent).toContain("Document settings");
    expect(container.textContent).toContain("Regular:");
    expect(container.textContent).toContain("Bold:");
    expect(container.textContent).toContain("Italic:");
    expect(container.textContent).not.toContain("標準");
    expect(container.textContent).not.toContain("太字");
  });

  it("the panel's aria-label is in English", () => {
    render(
      <MessagesContext.Provider value={en}>
        <PropertiesPanel store={makeStore()} interaction={IDLE} />
      </MessagesContext.Provider>,
    );

    expect(
      container.querySelector(".dr-props")?.getAttribute("aria-label"),
    ).toBe("Properties");
  });
});
