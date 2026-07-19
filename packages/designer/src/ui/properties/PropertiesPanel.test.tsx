import type { IrDocument, IrElement } from "@denreport/core";
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IMAGE_PLACEHOLDER_SRC } from "../../state/constants";
import { ELEMENT_TYPE_LABEL } from "../../state/element-labels";
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
    font: { name: "NotoSansJP" },
    elements: ELEMENTS,
  };
  return new EditorStore(document);
}

function makeStoreWithStyle(): EditorStore {
  const document: IrDocument = {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { name: "NotoSansJP" },
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

describe("PropertiesPanel の振り分け", () => {
  it("非選択では文書設定を表示する", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    expect(container.textContent).toContain("文書設定");
    expect(inputByLabel("幅").value).toBe("210.0");
    expect(inputByLabel("高さ").value).toBe("297.0");
    expect(inputByLabel("フォント名").value).toBe("NotoSansJP");
  });

  it("単一選択では型ごとのフォームを表示する（全8型）", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    const cases: readonly (readonly [
      string,
      keyof typeof ELEMENT_TYPE_LABEL,
    ])[] = [
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
      expect(container.querySelector(".apx-type-badge")?.textContent).toBe(
        ELEMENT_TYPE_LABEL[type],
      );
      expect(container.querySelector(".apx-props-id")?.textContent).toBe(id);
    }
  });

  it("複数選択では選択件数とともに一括編集フォームを表示する", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["t1", "r1"]);
    expect(container.textContent).toContain("2 個の要素を選択中");
    expect(container.querySelector(".apx-field")).not.toBeNull();
    expect(container.querySelector(".apx-type-badge")).toBeNull();
  });

  it("選択 id が文書に無い場合は非選択扱い", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["ghost"]);
    expect(container.textContent).toContain("文書設定");
  });

  it("適格請求書チェックのチェックボックス操作は1 commit で docType を付与・除去する", () => {
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

  it("適格請求書チェックのラベルは「チェック」部分が単語内分断されないよう nowrap で囲む", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    const label = container.querySelector(".apx-frow-label");
    expect(label?.textContent).toBe("記載事項チェック");
    expect(label?.querySelector(".apx-nowrap")?.textContent).toBe("チェック");
  });

  it("flex 子の選択では x / y / ページを出さず、注記を表示する", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["c1"]);
    expect(container.querySelector(".apx-type-badge")?.textContent).toBe(
      ELEMENT_TYPE_LABEL.text,
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

describe("用紙サイズプリセット", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function stubLanguage(language: string): void {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue(language);
  }

  it("英語圏 UI では A3/A4/A5/B5(ISO)/Letter/Legal を選択肢に出し、A4 の白紙初期値を選択済みにする", () => {
    stubLanguage("en-US");
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    const select = requireSelectByLabel("サイズ");
    expect(
      [...select.querySelectorAll("option")].map((o) => o.textContent),
    ).toEqual(["A3", "A4", "A5", "B5", "Letter", "Legal", "カスタム"]);
    expect(select.value).toBe("a4");
  });

  it("日本語 UI では A3/A4/A5/B4(JIS)/B5(JIS)/はがき/レターを選択肢に出す", () => {
    stubLanguage("ja-JP");
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    const select = requireSelectByLabel("サイズ");
    expect(
      [...select.querySelectorAll("option")].map((o) => o.textContent),
    ).toEqual(["A3", "A4", "A5", "B4", "B5", "はがき", "レター", "カスタム"]);
  });

  it("プリセットを選ぶと幅・高さが一括で commit される", () => {
    stubLanguage("ja-JP");
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    setSelectValue(requireSelectByLabel("サイズ"), "b5jis");
    expect(store.getState().document.page).toEqual({ width: 182, height: 257 });
    expect(inputByLabel("幅").value).toBe("182.0");
    expect(inputByLabel("高さ").value).toBe("257.0");
  });

  it("レターを選ぶと規格値（215.9x279.4mm）がそのまま commit される", () => {
    stubLanguage("ja-JP");
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

  it("どのプリセットとも一致しない寸法では「カスタム」を選択済みにする", () => {
    stubLanguage("ja-JP");
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

  it("幅・高さ欄を手動編集してプリセットに一致させると select 表示が追従する", () => {
    stubLanguage("ja-JP");
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    setValue(inputByLabel("幅"), "148");
    blur(inputByLabel("幅"));
    setValue(inputByLabel("高さ"), "210");
    blur(inputByLabel("高さ"));
    expect(requireSelectByLabel("サイズ").value).toBe("a5");
  });
});

describe("名前フィールド", () => {
  it("ヘッダーの名前欄への入力が commit に到達し、undo で戻る", () => {
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

  it("空欄への変更は name 属性を除去する", () => {
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

  it("flex 子でも名前欄を表示・編集できる", () => {
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

describe("回転フィールド", () => {
  it("table / flex 以外で回転欄を表示し、table / flex では表示しない", () => {
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

  it("入力が 0.1° 丸めで commit に到達し、undo で戻る", () => {
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

  it("0 への変更は rotate 属性を除去する", () => {
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

  it("flex 子でも回転欄を表示・編集できる", () => {
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

describe("スタイルセクション", () => {
  it("スタイル対象の型（text）でのみ select を表示し、対象外（image）では表示しない", () => {
    const store = makeStoreWithStyle();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["t1"]);
    expect(selectByLabel("スタイル")).not.toBeNull();
    select(store, ["img1"]);
    expect(selectByLabel("スタイル")).toBeNull();
  });

  it("select でスタイルを適用すると該当属性が反映され、undo で戻る", () => {
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

  it("スタイルなしを選ぶと style 属性のみ除去し、具体値は保持する", () => {
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

describe("代表的な編集経路", () => {
  it("テキスト欄への {key} 入力が commit に到達する", () => {
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

  it("テキスト編集欄に {#id} 構文の案内文を表示する", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["t1"]);
    expect(container.querySelector(".apx-fhint")?.textContent).toContain(
      "{#id}",
    );
  });

  it("未定義の脚注 id を参照する（F03）とテキスト編集欄にエラーを表示する", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["t1"]);

    const textInput = inputByLabel("テキスト");
    setValue(textInput, "見出し{#missing}");
    blur(textInput);

    expect(container.querySelector(".apx-field.is-error")).not.toBeNull();
    expect(container.querySelector(".apx-ferr")?.textContent).toContain(
      "missing",
    );
  });

  it("flex 内の text に脚注マークを書く（F04）とテキスト編集欄にエラーを表示する", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["c1"]);

    const textInput = inputByLabel("テキスト");
    setValue(textInput, "子{#note1}");
    blur(textInput);

    expect(container.querySelector(".apx-ferr")?.textContent).toBe(
      "脚注マークは flex 内の text には書けません",
    );
  });

  it("列追加 → width 変更で Σ列幅の表示が更新される", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["tbl1"]);
    expect(container.textContent).toContain("Σ列幅 = 80.0 mm");

    click(buttonByText("＋ 列を追加"));
    let table = elementById(store, "tbl1");
    expect(table.type === "table" ? table.columns.length : 0).toBe(3);
    expect(container.textContent).toContain("Σ列幅 = 120.0 mm");

    const widthInput = container
      .querySelectorAll(".apx-col-card")[2]
      ?.querySelector(".apx-col-w input");
    if (!(widthInput instanceof HTMLInputElement)) {
      throw new Error("幅の入力がない");
    }
    setValue(widthInput, "60");
    blur(widthInput);
    table = elementById(store, "tbl1");
    expect(table.type === "table" ? table.columns[2]?.width : 0).toBe(60);
    expect(container.textContent).toContain("Σ列幅 = 140.0 mm");
  });

  it("文字サイズと整列の編集が commit に到達する", () => {
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

  it("table の minRows / maxY の編集が commit に到達する", () => {
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

  it("flex の主軸寸法トグルは内容寸法を初期値に明示し、OFF で属性を除去する", () => {
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

  it("画像の読込完了前に別属性を編集しても src の commit が上書きしない", async () => {
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

    // FileReader の完了前に同じ要素の w を編集する
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

  it("バーコードの規格切替・値編集が commit に到達する", () => {
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

describe("図形スタイル（色・線種・角丸・網掛け）の編集経路", () => {
  it("line の色・線種の commit と、既定値への復帰による属性除去", () => {
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

  it("rect の枠線色・角丸半径の commit と、既定値への復帰による属性除去", () => {
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

  it("rect の線種の commit と、既定値への復帰による属性除去", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["r1"]);

    setSelectValue(requireSelectByLabel("線種"), "dotted");
    expect(elementById(store, "r1")).toMatchObject({ borderStyle: "dotted" });

    setSelectValue(requireSelectByLabel("線種"), "solid");
    const r1 = elementById(store, "r1");
    expect("borderStyle" in r1 && r1.borderStyle !== undefined).toBe(false);
  });

  it("rect の塗り色は allowNone トグルで属性の有無を切り替える", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["r1"]);

    const fillCheckbox = container.querySelector('input[type="checkbox"]');
    if (!(fillCheckbox instanceof HTMLInputElement)) {
      throw new Error("塗り「なし」チェックボックスがない");
    }
    expect(fillCheckbox.checked).toBe(true); // fillColor 未指定 = なし
    click(fillCheckbox);
    let r1 = elementById(store, "r1");
    expect(r1).toMatchObject({ fillColor: "#000000" });

    setValue(inputByLabel("塗り色"), "#eeeeee");
    expect(elementById(store, "r1")).toMatchObject({ fillColor: "#eeeeee" });

    click(container.querySelector('input[type="checkbox"]') as Element);
    r1 = elementById(store, "r1");
    expect("fillColor" in r1 && r1.fillColor !== undefined).toBe(false);
  });

  it("ellipse の配置・枠線・塗りの commit が到達する", () => {
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

  it("table の外枠・内部罫線の太さ・線種の commit と、既定値への復帰による属性除去", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    select(store, ["tbl1"]);

    const frameWidthInput = inputByLabel("外枠の太さ");
    expect(frameWidthInput.value).toBe("0.40"); // TABLE_FRAME_WIDTH 既定値の表示
    setValue(frameWidthInput, "1");
    blur(frameWidthInput);
    expect(elementById(store, "tbl1")).toMatchObject({ frameWidth: 1 });

    setSelectValue(requireSelectByLabel("外枠の線種"), "dashed");
    expect(elementById(store, "tbl1")).toMatchObject({ frameStyle: "dashed" });

    const gridWidthInput = inputByLabel("内部罫線の太さ");
    expect(gridWidthInput.value).toBe("0.25"); // TABLE_GRID_WIDTH 既定値の表示
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

  it("table の網掛けトグルは ON で既定色を設定し、OFF で stripeColor を除去する", () => {
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

  it("text / pageNumber の文字色の commit と、既定値への復帰による属性除去", () => {
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

describe("maxY ガイド線の表示条件", () => {
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

  it("table 単一選択中のみ表示する", () => {
    const store = makeStore();
    store.setSelection(["tbl1"]);
    renderOverlay(store);
    expect(container.querySelector(".apx-maxy-line")).not.toBeNull();
    expect(container.querySelector(".apx-maxy-chip")?.textContent).toBe(
      "maxY 240",
    );
  });

  it("table 以外の単一選択・複数選択では表示しない", () => {
    const store = makeStore();
    store.setSelection(["t1"]);
    renderOverlay(store);
    expect(container.querySelector(".apx-maxy-line")).toBeNull();

    store.setSelection(["tbl1", "t1"]);
    renderOverlay(store);
    expect(container.querySelector(".apx-maxy-line")).toBeNull();
  });
});

describe("ドラッグ中のライブ表示", () => {
  it("idle のときは committed 値を表示する", () => {
    const store = makeStore();
    select(store, ["r1"]);
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    expect(inputByLabel("x").value).toBe("10.0");
    expect(inputByLabel("w").value).toBe("40.0");
  });

  it("moving 中は選択中の id の x/y にオフセット加算後の値を表示する", () => {
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

  it("resizing 中は w/h に interaction.box の値を表示する", () => {
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

  it("table + rest 文脈 + moving では y はライブ表示しない", () => {
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

// readAscentPerEm が読める最小の TTF（glyf + head.unitsPerEm + hhea.ascender）
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

describe("PC のフォントから選択", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ボタンでダイアログが開き、選択確定で font.name が commit されレジストリに登録される", async () => {
    stubQueryLocalFonts();
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);

    click(buttonByText("PC のフォントから選択…"));
    await vi.waitFor(() => {
      expect(container.querySelector(".apx-dialog")).not.toBeNull();
    });
    await vi.waitFor(() => {
      expect(container.querySelector(".apx-font-name")).not.toBeNull();
    });

    const fontRow = [...container.querySelectorAll(".apx-font-name")]
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
      expect(store.getState().document.font.name).toBe("LocalFont");
    });
    expect(store.getState().dirty).toBe(true);
    expect(store.getState().fontRegistry.get("LocalFont")?.displayName).toBe(
      "Local Font",
    );
    expect(container.querySelector(".apx-dialog")).toBeNull();

    act(() => {
      store.undo();
    });
    expect(store.getState().document.font.name).toBe("NotoSansJP");
    expect(store.getState().fontRegistry.get("LocalFont")).toBeDefined();

    act(() => {
      store.redo();
    });
    expect(store.getState().document.font.name).toBe("LocalFont");
    expect(inputByLabel("フォント名").value).toBe("LocalFont");
  });

  it("非対応環境ではボタンの代わりに説明文が出る", () => {
    const store = makeStore();
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    expect(container.textContent).toContain(
      "PC 内フォントの一覧取得に対応していません",
    );
    expect(() => buttonByText("PC のフォントから選択…")).toThrow();
  });

  it("レジストリにも同梱名にも無い font.name は missing の注意表示になる", () => {
    const store = makeStore();
    act(() => {
      store.commit({
        ...store.getState().document,
        font: { name: "GoneFont" },
      });
    });
    render(<PropertiesPanel store={store} interaction={IDLE} />);
    expect(container.textContent).toContain(
      "実データ未選択（同梱フォントで代替されます）",
    );
  });
});
