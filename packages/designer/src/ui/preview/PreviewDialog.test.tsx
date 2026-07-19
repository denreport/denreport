import type {
  IrDocument,
  IrElement,
  IrTableElement,
  IrTextElement,
} from "@denreport/core";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessagesContext } from "../../i18n/context";
import { en } from "../../i18n/messages/en";
import { generateSampleData } from "../../state/preview";
import { activeSampleJson } from "../../state/sample-scenarios";
import { EditorStore } from "../../state/store";
import { PreviewDialog } from "./PreviewDialog";
import { registerPreviewFace } from "./preview-font";

// jsdom は document.fonts / FontFace を実装しないため、実際の登録先である
// registerPreviewFace は PreviewDialog の配線を検証する対象としてモックする
// （その登録処理自体は preview-font.test.ts が擬似 doc.fonts で検証済み）
vi.mock("./preview-font", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./preview-font")>();
  return { ...actual, registerPreviewFace: vi.fn() };
});

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// readCharWidths が読める最小の TTF（head.unitsPerEm + hhea.numberOfHMetrics +
// hmtx 1本 + 空の cmap format4 サブテーブル）
function syntheticTtf(): Uint8Array {
  const headOffset = 12 + 4 * 16;
  const headLength = 20;
  const hheaOffset = headOffset + headLength;
  const hheaLength = 36;
  const hmtxOffset = hheaOffset + hheaLength;
  const hmtxLength = 4;
  const cmapOffset = hmtxOffset + hmtxLength;
  const cmapSubtableLength = 24; // format4、segCount=1（終端セグメントのみ）
  const cmapLength = 12 + cmapSubtableLength;
  const bytes = new Uint8Array(cmapOffset + cmapLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x00010000);
  view.setUint16(4, 4);
  view.setUint32(12, 0x68656164); // 'head'
  view.setUint32(12 + 8, headOffset);
  view.setUint32(12 + 12, headLength);
  view.setUint32(28, 0x68686561); // 'hhea'
  view.setUint32(28 + 8, hheaOffset);
  view.setUint32(28 + 12, hheaLength);
  view.setUint32(44, 0x686d7478); // 'hmtx'
  view.setUint32(44 + 8, hmtxOffset);
  view.setUint32(44 + 12, hmtxLength);
  view.setUint32(60, 0x636d6170); // 'cmap'
  view.setUint32(60 + 8, cmapOffset);
  view.setUint32(60 + 12, cmapLength);

  view.setUint16(headOffset + 18, 1000);
  view.setInt16(hheaOffset + 4, 800);
  view.setUint16(hheaOffset + 34, 1); // numberOfHMetrics

  view.setUint16(hmtxOffset, 500); // advanceWidth
  view.setInt16(hmtxOffset + 2, 0); // lsb

  view.setUint16(cmapOffset + 2, 1); // numTables
  view.setUint16(cmapOffset + 4, 3); // platformId
  view.setUint16(cmapOffset + 6, 1); // encodingId
  view.setUint32(cmapOffset + 8, 12); // subtable offset（cmap 先頭からの相対位置）
  const subtableAbs = cmapOffset + 12;
  view.setUint16(subtableAbs, 4); // format
  view.setUint16(subtableAbs + 2, cmapSubtableLength);
  view.setUint16(subtableAbs + 6, 2); // segCountX2（segCount=1）
  view.setUint16(subtableAbs + 14, 0xffff); // endCode[0]
  view.setUint16(subtableAbs + 18, 0xffff); // startCode[0]
  view.setInt16(subtableAbs + 20, 1); // idDelta[0]
  return bytes;
}

function makeDocument(
  elements: readonly IrElement[],
  fontName = "NotoSansJP",
): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: fontName },
    elements,
  };
}

function boundText(id: string, key: string): IrTextElement {
  return {
    type: "text",
    id,
    x: 10,
    y: 10,
    pages: "first",
    w: 80,
    h: 6,
    text: `{${key}}`,
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  };
}

// 先頭ページ容量 = 継続ページ容量 = 9 行
function itemsTable(overrides: Partial<IrTableElement> = {}): IrTableElement {
  return {
    type: "table",
    id: "items",
    x: 10,
    y: 20,
    bind: "items",
    columns: [
      { key: "name", label: "品名", width: 100, align: "left" },
      { key: "qty", label: "数量", width: 40, align: "right" },
    ],
    rowHeight: 8,
    headerHeight: 8,
    fontSize: 10,
    maxY: 100,
    continuationY: 20,
    minRows: 3,
    ...overrides,
  };
}

function sampleWithRows(n: number): string {
  return JSON.stringify({
    items: Array.from({ length: n }, (_, i) => ({
      name: `品${i + 1}`,
      qty: String(i + 1),
    })),
  });
}

let container: HTMLElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  // jsdom に FontFace がないため、フォント読込は失敗（システムフォント代替）経路で決定させる
  fetchMock = vi.fn(() => Promise.reject(new Error("フォントなし")));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
});

async function renderDialog(
  store: EditorStore,
  onClose: () => void = () => {},
): Promise<void> {
  await act(async () => {
    root.render(<PreviewDialog store={store} onClose={onClose} />);
  });
  // フォント読込の reject を消化して表示状態を確定させる
  await act(async () => {});
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

function click(el: Element): void {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function textarea(): HTMLTextAreaElement {
  const el = container.querySelector("textarea");
  if (el === null) {
    throw new Error("textarea がない");
  }
  return el;
}

function commitSample(json: string): void {
  const el = textarea();
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set?.call(el, json);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => {
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}

function svgPages(): NodeListOf<Element> {
  return container.querySelectorAll(".apx-preview-svg");
}

function scenarioSelect(): HTMLSelectElement {
  const el = container.querySelector<HTMLSelectElement>(
    'select[aria-label="サンプルデータのシナリオ"]',
  );
  if (el === null) {
    throw new Error("シナリオ select がない");
  }
  return el;
}

function scenarioNameInput(): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>(
    'input[aria-label="シナリオ名"]',
  );
  if (el === null) {
    throw new Error("シナリオ名入力がない");
  }
  return el;
}

function selectScenario(id: string): void {
  const el = scenarioSelect();
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )?.set?.call(el, id);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function commitName(value: string): void {
  const el = scenarioNameInput();
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => {
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}

describe("PreviewDialog", () => {
  it("検証エラーがあるとページを描画せずエラー状態を表示する", async () => {
    // x=500 は用紙幅 210mm を超えるため M02 になる
    const store = new EditorStore(
      makeDocument([{ ...boundText("t1", "customerName"), x: 500 }]),
    );
    await renderDialog(store);
    expect(svgPages()).toHaveLength(0);
    expect(container.textContent).toContain("検証エラー");
  });

  it("サンプル編集の blur 確定でページ数と表示が変わる", async () => {
    const store = new EditorStore(
      makeDocument([itemsTable()]),
      sampleWithRows(2),
    );
    await renderDialog(store);
    expect(svgPages()).toHaveLength(1);
    expect(container.textContent).toContain("1 ページ");

    commitSample(sampleWithRows(15));
    expect(activeSampleJson(store.getState().sampleScenarios)).toBe(
      sampleWithRows(15),
    );
    expect(svgPages()).toHaveLength(2);
    expect(container.textContent).toContain("2 ページ");
    expect(container.textContent).toContain("1 / 2");
    expect(container.textContent).toContain("2 / 2");
  });

  it("補完が起きると警告バナーに core のメッセージが列挙される", async () => {
    const store = new EditorStore(
      makeDocument([boundText("t1", "customerName"), itemsTable()]),
      "{}",
    );
    await renderDialog(store);
    const banner = container.querySelector(".apx-preview-warnings");
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain("customerName");
    expect(banner?.textContent).toContain("items");
    // 補完済みなのでページ自体は描画される
    expect(svgPages()).toHaveLength(1);
  });

  it("完全なデータではフォント警告以外の警告が出ない", async () => {
    const store = new EditorStore(
      makeDocument([itemsTable()]),
      sampleWithRows(2),
    );
    await renderDialog(store);
    const banner = container.querySelector(".apx-preview-warnings");
    // jsdom ではフォント読込失敗の警告のみが残る
    expect(banner?.textContent).toContain("フォント");
    expect(banner?.textContent).not.toContain("items");
  });

  it("C03（複数表の同時改ページ）は規則 ID 付きのエラー表示になる", async () => {
    const store = new EditorStore(
      makeDocument([
        itemsTable(),
        itemsTable({ id: "items2", bind: "items2" }),
      ]),
      JSON.stringify({
        items: Array.from({ length: 20 }, (_, i) => ({
          name: `品${i}`,
          qty: "1",
        })),
        items2: Array.from({ length: 20 }, (_, i) => ({
          name: `品${i}`,
          qty: "1",
        })),
      }),
    );
    await renderDialog(store);
    expect(svgPages()).toHaveLength(0);
    expect(container.querySelector(".apx-verr-rule")?.textContent).toBe("C03");
  });

  it("サンプルが空なら生成ボタンで即座に generateSampleData の結果になる", async () => {
    const document_ = makeDocument([itemsTable()]);
    const store = new EditorStore(document_);
    await renderDialog(store);

    click(buttonByText("bind キーから生成"));
    expect(activeSampleJson(store.getState().sampleScenarios)).toBe(
      generateSampleData(document_),
    );
    expect(textarea().value).toBe(generateSampleData(document_));
    expect(container.querySelector(".apx-dialog")).toBeNull();
  });

  it("既存サンプルがあるときは確認を挟み、キャンセルなら変更しない", async () => {
    const document_ = makeDocument([itemsTable()]);
    const store = new EditorStore(document_, sampleWithRows(1));
    await renderDialog(store);

    click(buttonByText("bind キーから生成"));
    expect(container.querySelector(".apx-dialog")).not.toBeNull();
    expect(activeSampleJson(store.getState().sampleScenarios)).toBe(
      sampleWithRows(1),
    );

    click(buttonByText("キャンセル"));
    expect(container.querySelector(".apx-dialog")).toBeNull();
    expect(activeSampleJson(store.getState().sampleScenarios)).toBe(
      sampleWithRows(1),
    );

    click(buttonByText("bind キーから生成"));
    click(buttonByText("置き換える"));
    expect(activeSampleJson(store.getState().sampleScenarios)).toBe(
      generateSampleData(document_),
    );
  });

  it("不正 JSON はパースエラーを表示しつつ確定は妨げない", async () => {
    const store = new EditorStore(makeDocument([itemsTable()]));
    await renderDialog(store);

    commitSample("{oops");
    expect(activeSampleJson(store.getState().sampleScenarios)).toBe("{oops");
    expect(container.querySelector(".apx-sample-err")).not.toBeNull();
    // 空データに補完されてページは出続ける
    expect(svgPages()).toHaveLength(1);
  });

  it("閉じるボタンで onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    const store = new EditorStore(makeDocument([]));
    await renderDialog(store, onClose);
    click(buttonByText("閉じる"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("シナリオ操作", () => {
  it("追加すると空 json の新規シナリオがアクティブになる", async () => {
    const store = new EditorStore(
      makeDocument([itemsTable()]),
      sampleWithRows(1),
    );
    await renderDialog(store);

    click(buttonByText("追加"));
    const scenarios = store.getState().sampleScenarios;
    expect(scenarios.items).toHaveLength(2);
    expect(scenarios.activeId).toBe(scenarios.items[1]?.id);
    expect(textarea().value).toBe("");
  });

  it("複製すると現在の json を引き継いだ新規シナリオがアクティブになる", async () => {
    const store = new EditorStore(
      makeDocument([itemsTable()]),
      sampleWithRows(1),
    );
    await renderDialog(store);

    click(buttonByText("複製"));
    const scenarios = store.getState().sampleScenarios;
    expect(scenarios.items).toHaveLength(2);
    expect(activeSampleJson(scenarios)).toBe(sampleWithRows(1));
  });

  it("シナリオ名を変更すると select の表示ラベルが変わる", async () => {
    const store = new EditorStore(makeDocument([itemsTable()]));
    await renderDialog(store);

    commitName("行数多");
    expect(store.getState().sampleScenarios.items[0]?.name).toBe("行数多");
    expect(scenarioSelect().selectedOptions[0]?.textContent).toBe("行数多");
  });

  it("select でシナリオを切り替えるとプレビューが切り替わる", async () => {
    const store = new EditorStore(
      makeDocument([itemsTable()]),
      sampleWithRows(2),
    );
    await renderDialog(store);
    expect(svgPages()).toHaveLength(1);

    const firstId = store.getState().sampleScenarios.items[0]?.id as string;
    click(buttonByText("追加"));
    commitSample(sampleWithRows(15));
    expect(svgPages()).toHaveLength(2);

    selectScenario(firstId);
    expect(store.getState().sampleScenarios.activeId).toBe(firstId);
    expect(textarea().value).toBe(sampleWithRows(2));
    expect(svgPages()).toHaveLength(1);
  });

  it("シナリオが1件のときは削除ボタンが無効", async () => {
    const store = new EditorStore(makeDocument([itemsTable()]));
    await renderDialog(store);
    expect(buttonByText("削除").disabled).toBe(true);
  });

  it("削除は確認を挟み、確定すると隣接シナリオがアクティブになる", async () => {
    const store = new EditorStore(
      makeDocument([itemsTable()]),
      sampleWithRows(1),
    );
    await renderDialog(store);
    click(buttonByText("追加"));
    expect(store.getState().sampleScenarios.items).toHaveLength(2);

    click(buttonByText("削除"));
    expect(container.querySelector(".apx-dialog")).not.toBeNull();
    expect(store.getState().sampleScenarios.items).toHaveLength(2);

    click(buttonByText("削除する"));
    expect(store.getState().sampleScenarios.items).toHaveLength(1);
    expect(activeSampleJson(store.getState().sampleScenarios)).toBe(
      sampleWithRows(1),
    );
  });

  it("「bind キーから生成」はアクティブシナリオのみを上書きする", async () => {
    const document_ = makeDocument([itemsTable()]);
    const store = new EditorStore(document_, sampleWithRows(1));
    await renderDialog(store);

    click(buttonByText("追加"));
    click(buttonByText("bind キーから生成"));

    const scenarios = store.getState().sampleScenarios;
    expect(scenarios.items).toHaveLength(2);
    expect(scenarios.items[0]?.json).toBe(sampleWithRows(1));
    expect(activeSampleJson(scenarios)).toBe(generateSampleData(document_));
  });
});

describe("フォント解決の反映", () => {
  it("registered 解決では選択フォントの family が描画に使われ、fetch は呼ばれない", async () => {
    vi.mocked(registerPreviewFace).mockResolvedValueOnce(
      "apx-local-MyLocalFont",
    );
    const font = {
      name: "MyLocalFont",
      displayName: "My Local Font",
      data: syntheticTtf(),
      ascentPerEm: 0.9,
    };
    const store = new EditorStore(
      makeDocument([itemsTable()], "MyLocalFont"),
      sampleWithRows(1),
    );
    store.registerFont(font);
    await renderDialog(store);

    await vi.waitFor(() => {
      const text = container.querySelector(".apx-preview-svg text");
      expect(text?.getAttribute("font-family")).toBe("apx-local-MyLocalFont");
    });
    expect(registerPreviewFace).toHaveBeenCalledWith(
      expect.anything(),
      "MyLocalFont",
      font.data,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("missing 解決では同梱フォールバックで描画し、再選択を促す警告バナーが出る", async () => {
    const store = new EditorStore(
      makeDocument([itemsTable()], "GoneFont"),
      sampleWithRows(1),
    );
    await renderDialog(store);

    const banner = container.querySelector(".apx-preview-warnings");
    expect(banner?.textContent).toContain(
      "フォント「GoneFont」の実データが未選択のため",
    );
    expect(banner?.textContent).toContain("PC のフォントから選択");
  });
});

describe("en の MessagesContext", () => {
  it("文言が英語で描画される", async () => {
    const store = new EditorStore(makeDocument([]));
    await act(async () => {
      root.render(
        <MessagesContext.Provider value={en}>
          <PreviewDialog store={store} onClose={() => {}} />
        </MessagesContext.Provider>,
      );
    });
    await act(async () => {});
    expect(container.querySelector(".apx-preview-title")?.textContent).toBe(
      "Preview",
    );
    expect(buttonByText("Close")).not.toBeNull();
  });
});
