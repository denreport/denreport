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

// jsdom doesn't implement document.fonts / FontFace, so registerPreviewFace — the actual
// registration target — is mocked here to verify PreviewDialog's wiring
// (the registration logic itself is already verified in preview-font.test.ts with a fake doc.fonts)
vi.mock("./preview-font", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./preview-font")>();
  return { ...actual, registerPreviewFace: vi.fn() };
});

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// A minimal TTF that readCharWidths can read (head.unitsPerEm + hhea.numberOfHMetrics +
// one hmtx entry + an empty cmap format4 subtable)
function syntheticTtf(): Uint8Array {
  const headOffset = 12 + 4 * 16;
  const headLength = 20;
  const hheaOffset = headOffset + headLength;
  const hheaLength = 36;
  const hmtxOffset = hheaOffset + hheaLength;
  const hmtxLength = 4;
  const cmapOffset = hmtxOffset + hmtxLength;
  const cmapSubtableLength = 24; // format4, segCount=1 (terminal segment only)
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
  view.setUint32(cmapOffset + 8, 12); // subtable offset (relative to the start of cmap)
  const subtableAbs = cmapOffset + 12;
  view.setUint16(subtableAbs, 4); // format
  view.setUint16(subtableAbs + 2, cmapSubtableLength);
  view.setUint16(subtableAbs + 6, 2); // segCountX2 (segCount=1)
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

// First-page capacity = continuation-page capacity = 9 rows
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
  // jsdom has no FontFace, so we force font loading down the failure (system-font fallback) path
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
  // Flush the font-loading rejection to settle the display state
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
  return container.querySelectorAll(".dr-preview-svg");
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
  it("shows an error state without rendering pages when there's a validation error", async () => {
    // x=500 exceeds the paper width of 210mm, so this becomes M02
    const store = new EditorStore(
      makeDocument([{ ...boundText("t1", "customerName"), x: 500 }]),
    );
    await renderDialog(store);
    expect(svgPages()).toHaveLength(0);
    expect(container.textContent).toContain("検証エラー");
  });

  it("changes the page count and display when sample editing is committed on blur", async () => {
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

  it("lists core's messages in the warning banner when completion occurs", async () => {
    const store = new EditorStore(
      makeDocument([boundText("t1", "customerName"), itemsTable()]),
      "{}",
    );
    await renderDialog(store);
    const banner = container.querySelector(".dr-preview-warnings");
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain("customerName");
    expect(banner?.textContent).toContain("items");
    // The page itself is still rendered since the data has been completed
    expect(svgPages()).toHaveLength(1);
  });

  it("shows no warnings other than the font warning when the data is complete", async () => {
    const store = new EditorStore(
      makeDocument([itemsTable()]),
      sampleWithRows(2),
    );
    await renderDialog(store);
    const banner = container.querySelector(".dr-preview-warnings");
    // In jsdom, only the font-load-failure warning remains
    expect(banner?.textContent).toContain("フォント");
    expect(banner?.textContent).not.toContain("items");
  });

  it("shows an error with the rule ID for C03 (simultaneous page breaks across multiple tables)", async () => {
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
    expect(container.querySelector(".dr-verr-rule")?.textContent).toBe("C03");
  });

  it("immediately applies generateSampleData's result via the generate button when the sample is empty", async () => {
    const document_ = makeDocument([itemsTable()]);
    const store = new EditorStore(document_);
    await renderDialog(store);

    click(buttonByText("bind キーから生成"));
    expect(activeSampleJson(store.getState().sampleScenarios)).toBe(
      generateSampleData(document_),
    );
    expect(textarea().value).toBe(generateSampleData(document_));
    expect(container.querySelector(".dr-dialog")).toBeNull();
  });

  it("prompts for confirmation when a sample already exists, and makes no change on cancel", async () => {
    const document_ = makeDocument([itemsTable()]);
    const store = new EditorStore(document_, sampleWithRows(1));
    await renderDialog(store);

    click(buttonByText("bind キーから生成"));
    expect(container.querySelector(".dr-dialog")).not.toBeNull();
    expect(activeSampleJson(store.getState().sampleScenarios)).toBe(
      sampleWithRows(1),
    );

    click(buttonByText("キャンセル"));
    expect(container.querySelector(".dr-dialog")).toBeNull();
    expect(activeSampleJson(store.getState().sampleScenarios)).toBe(
      sampleWithRows(1),
    );

    click(buttonByText("bind キーから生成"));
    click(buttonByText("置き換える"));
    expect(activeSampleJson(store.getState().sampleScenarios)).toBe(
      generateSampleData(document_),
    );
  });

  it("shows a parse error for invalid JSON without blocking the commit", async () => {
    const store = new EditorStore(makeDocument([itemsTable()]));
    await renderDialog(store);

    commitSample("{oops");
    expect(activeSampleJson(store.getState().sampleScenarios)).toBe("{oops");
    expect(container.querySelector(".dr-sample-err")).not.toBeNull();
    // The data is completed to empty, so the page keeps rendering
    expect(svgPages()).toHaveLength(1);
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    const store = new EditorStore(makeDocument([]));
    await renderDialog(store, onClose);
    click(buttonByText("閉じる"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("scenario operations", () => {
  it("activates a new scenario with empty json when added", async () => {
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

  it("activates a new scenario carrying over the current json when duplicated", async () => {
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

  it("changes the select's display label when the scenario name is changed", async () => {
    const store = new EditorStore(makeDocument([itemsTable()]));
    await renderDialog(store);

    commitName("行数多");
    expect(store.getState().sampleScenarios.items[0]?.name).toBe("行数多");
    expect(scenarioSelect().selectedOptions[0]?.textContent).toBe("行数多");
  });

  it("switches the preview when the scenario is switched via select", async () => {
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

  it("disables the delete button when there is only 1 scenario", async () => {
    const store = new EditorStore(makeDocument([itemsTable()]));
    await renderDialog(store);
    expect(buttonByText("削除").disabled).toBe(true);
  });

  it("prompts for confirmation on delete, and activates the adjacent scenario when confirmed", async () => {
    const store = new EditorStore(
      makeDocument([itemsTable()]),
      sampleWithRows(1),
    );
    await renderDialog(store);
    click(buttonByText("追加"));
    expect(store.getState().sampleScenarios.items).toHaveLength(2);

    click(buttonByText("削除"));
    expect(container.querySelector(".dr-dialog")).not.toBeNull();
    expect(store.getState().sampleScenarios.items).toHaveLength(2);

    click(buttonByText("削除する"));
    expect(store.getState().sampleScenarios.items).toHaveLength(1);
    expect(activeSampleJson(store.getState().sampleScenarios)).toBe(
      sampleWithRows(1),
    );
  });

  it("「bind キーから生成」 overwrites only the active scenario", async () => {
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

describe("reflecting font resolution", () => {
  it("uses the selected font's family for rendering under a registered resolution, without calling fetch", async () => {
    vi.mocked(registerPreviewFace).mockResolvedValueOnce(
      "dr-local-MyLocalFont",
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
      const text = container.querySelector(".dr-preview-svg text");
      expect(text?.getAttribute("font-family")).toBe("dr-local-MyLocalFont");
    });
    expect(registerPreviewFace).toHaveBeenCalledWith(
      expect.anything(),
      "MyLocalFont",
      font.data,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders with the bundled fallback under a missing resolution, showing a warning banner that prompts reselection", async () => {
    const store = new EditorStore(
      makeDocument([itemsTable()], "GoneFont"),
      sampleWithRows(1),
    );
    await renderDialog(store);

    const banner = container.querySelector(".dr-preview-warnings");
    expect(banner?.textContent).toContain(
      "フォント「GoneFont」の実データが未選択のため",
    );
    expect(banner?.textContent).toContain("文書設定のフォント欄");
  });
});

describe("en MessagesContext", () => {
  async function renderEn(): Promise<void> {
    const store = new EditorStore(
      makeDocument([itemsTable()]),
      sampleWithRows(1),
    );
    await act(async () => {
      root.render(
        <MessagesContext.Provider value={en}>
          <PreviewDialog store={store} onClose={() => {}} />
        </MessagesContext.Provider>,
      );
    });
    await act(async () => {});
  }

  it("renders text in English", async () => {
    await renderEn();
    expect(container.querySelector(".dr-preview-title")?.textContent).toBe(
      "Preview",
    );
    expect(buttonByText("Close")).not.toBeNull();
  });

  it("renders scenario operations, the sample data field, and pages in English too", async () => {
    await renderEn();
    expect(buttonByText("Add")).not.toBeNull();
    expect(buttonByText("Duplicate")).not.toBeNull();
    expect(buttonByText("Delete")).not.toBeNull();
    expect(buttonByText("Generate from bind keys")).not.toBeNull();
    expect(
      container.querySelector('select[aria-label="Sample data scenario"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('input[aria-label="Scenario name"]'),
    ).not.toBeNull();
    expect(container.querySelector(".dr-sample .dr-sect-h")?.textContent).toBe(
      "Sample data (JSON)",
    );
    expect(svgPages()[0]?.getAttribute("aria-label")).toBe("Preview page");
  });
});
