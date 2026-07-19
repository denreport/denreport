import type { IrDocument } from "@denreport/core";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { triggerDownload } from "../../api/download";
import { EditorStore } from "../../state/store";
import { ExportDialog } from "./ExportDialog";
import { fetchEmbeddedFontData } from "./export-font";

vi.mock("../../api/download", () => ({ triggerDownload: vi.fn() }));
vi.mock("./export-font", () => ({ fetchEmbeddedFontData: vi.fn() }));

// 現行マトリクスに unsupported のエントリが存在しないため、非対応表示の検証用に
// pdfme の image を unsupported に差し替える（他のエントリは実物のまま）
vi.mock("@denreport/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@denreport/core")>();
  return {
    ...actual,
    COMPAT_MATRICES: {
      ...actual.COMPAT_MATRICES,
      pdfme: {
        ...actual.COMPAT_MATRICES.pdfme,
        elements: {
          ...actual.COMPAT_MATRICES.pdfme.elements,
          image: {
            element: {
              level: "unsupported",
              note: "image element unsupported (test)",
              userMessage: "画像は書き出せません（テスト用）",
            },
          },
        },
      },
    },
  };
});

// readAscentPerEm/readCharWidths が読める最小の TTF（glyf + head.unitsPerEm +
// hhea.ascender/numberOfHMetrics + hmtx 1本 + 空の cmap format4 サブテーブル）
function syntheticTtf(): Uint8Array {
  const headOffset = 12 + 5 * 16;
  const headLength = 54;
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
  view.setUint16(4, 5);
  view.setUint32(12, 0x676c7966); // 'glyf'
  view.setUint32(28, 0x68656164); // 'head'
  view.setUint32(28 + 8, headOffset);
  view.setUint32(28 + 12, headLength);
  view.setUint32(44, 0x68686561); // 'hhea'
  view.setUint32(44 + 8, hheaOffset);
  view.setUint32(44 + 12, hheaLength);
  view.setUint32(60, 0x686d7478); // 'hmtx'
  view.setUint32(60 + 8, hmtxOffset);
  view.setUint32(60 + 12, hmtxLength);
  view.setUint32(76, 0x636d6170); // 'cmap'
  view.setUint32(76 + 8, cmapOffset);
  view.setUint32(76 + 12, cmapLength);

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

function syntheticCff(): Uint8Array {
  const bytes = new Uint8Array(12 + 16);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x4f54544f); // "OTTO"
  view.setUint16(4, 1);
  view.setUint32(12, 0x43464620); // "CFF "
  return bytes;
}

function staticText(
  id: string,
  overrides: Partial<
    Extract<IrDocument["elements"][number], { type: "text" }>
  > = {},
): IrDocument["elements"][number] {
  return {
    type: "text",
    id,
    x: 10,
    y: 10,
    pages: "first",
    w: 100,
    h: 10,
    text: "静的",
    fontSize: 10,
    align: "left",
    lineHeight: 1.2,
    ...overrides,
  } as Extract<IrDocument["elements"][number], { type: "text" }>;
}

function boundText(id: string, key: string): IrDocument["elements"][number] {
  return {
    type: "text",
    id,
    x: 10,
    y: 10,
    pages: "first",
    w: 100,
    h: 10,
    text: `{${key}}`,
    fontSize: 10,
    align: "left",
    lineHeight: 1.2,
  };
}

function imageEl(id: string): IrDocument["elements"][number] {
  return {
    type: "image",
    id,
    x: 10,
    y: 30,
    pages: "first",
    w: 40,
    h: 20,
    src: "data:image/png;base64,AAAA",
  };
}

function docOf(...elements: IrDocument["elements"]): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements,
  };
}

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  // 両ターゲットとも書き出しに fontData（字幅・計量）を要するため、既定で成功させる
  // （フォント取得の失敗・形式エラーを検証するテストは個別に上書きする）
  vi.mocked(fetchEmbeddedFontData).mockResolvedValue(syntheticTtf());
});

afterEach(() => {
  root.unmount();
  container.remove();
  vi.clearAllMocks();
});

interface Mounted {
  readonly store: EditorStore;
  readonly onClose: ReturnType<typeof vi.fn>;
  readonly onReveal: ReturnType<typeof vi.fn>;
}

async function mount(
  document_: IrDocument,
  sampleData = "{}",
): Promise<Mounted> {
  const store = new EditorStore(document_, sampleData);
  const onClose = vi.fn();
  const onReveal = vi.fn();
  root.render(
    <ExportDialog store={store} onClose={onClose} onReveal={onReveal} />,
  );
  await vi.waitFor(() => {
    if (container.querySelector(".apx-dialog") === null) {
      throw new Error("ダイアログが未描画");
    }
  });
  return { store, onClose, onReveal };
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
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function targetCard(name: string): HTMLButtonElement {
  const card = [
    ...container.querySelectorAll<HTMLButtonElement>(".apx-tcard"),
  ].find((b) => b.querySelector(".apx-tcard-name")?.textContent === name);
  if (card === undefined) {
    throw new Error(`ターゲットカードがない: ${name}`);
  }
  return card;
}

async function selectReportlab(): Promise<void> {
  click(targetCard("ReportLab"));
  await vi.waitFor(() => {
    expect(targetCard("ReportLab").getAttribute("aria-pressed")).toBe("true");
  });
}

describe("警告一覧", () => {
  it("非対応・近似を含む文書で警告カードが level 色・重大度ラベル・平易文・件数バッジつきで表示される", async () => {
    await mount(docOf(staticText("t1"), imageEl("img1")));

    const cards = [...container.querySelectorAll(".apx-warn-card")];
    expect(cards.length).toBeGreaterThanOrEqual(2);
    // unsupported グループが先頭
    expect(cards[0]?.classList.contains("is-unsupported")).toBe(true);
    expect(cards[0]?.querySelector(".apx-warn-level")?.textContent).toBe(
      "非対応",
    );
    expect(cards[0]?.textContent).toContain("画像は書き出せません（テスト用）");
    expect(cards[0]?.querySelector(".apx-chip")?.textContent).toBe("img1");
    expect(cards[1]?.classList.contains("is-approximated")).toBe(true);
    expect(cards[1]?.querySelector(".apx-warn-level")?.textContent).toBe(
      "近似",
    );
    // ヘッダの件数バッジは延べ判定件数
    expect(container.querySelector(".apx-badge-warn")?.textContent).toBe("2");
  });

  it("警告ゼロでは案内文言を表示する", async () => {
    await mount(docOf());
    expect(container.querySelector(".apx-warn-card")).toBeNull();
    expect(container.textContent).toContain(
      "✓ 選択中のターゲットですべての要素を書き出せます。",
    );
  });

  it("ターゲット切替で一覧が再計算される", async () => {
    await mount(docOf(imageEl("img1")));
    expect(
      container.querySelector(".apx-warn-card.is-unsupported"),
    ).not.toBeNull();

    click(targetCard("ReportLab"));
    await vi.waitFor(() => {
      expect(
        container.querySelector(".apx-warn-card.is-unsupported"),
      ).toBeNull();
    });
    // ReportLab では image.src が近似
    expect(container.textContent).toContain("Pillow");
    expect(targetCard("ReportLab").getAttribute("aria-pressed")).toBe("true");
  });

  it("要素チップのクリックで 閉じる → 文脈切替 → 選択 → reveal の順にジャンプする", async () => {
    const { store, onClose, onReveal } = await mount(
      docOf(staticText("t1", { pages: "last" })),
    );
    const sequence: string[] = [];
    onClose.mockImplementation(() => sequence.push("close"));
    onReveal.mockImplementation(() => sequence.push("reveal"));
    vi.spyOn(store, "setView").mockImplementation((view) => {
      sequence.push("setView");
      EditorStore.prototype.setView.call(store, view);
    });
    vi.spyOn(store, "setSelection").mockImplementation((ids) => {
      sequence.push("setSelection");
      EditorStore.prototype.setSelection.call(store, ids);
    });

    const chip = container.querySelector<HTMLButtonElement>(".apx-chip");
    expect(chip?.textContent).toBe("t1");
    if (chip) click(chip);

    expect(sequence).toEqual(["close", "setView", "setSelection", "reveal"]);
    expect(store.getState().view.pageContext).toBe("last");
    expect(store.getState().selection).toEqual(["t1"]);
    expect(onReveal).toHaveBeenCalledExactlyOnceWith("t1");
  });
});

describe("実行可否", () => {
  it("検証エラーがあると主ボタン disabled + フッタ注記", async () => {
    await mount(docOf(staticText("dup"), staticText("dup")));
    expect(buttonByText("書き出す").disabled).toBe(true);
    expect(container.querySelector(".apx-dialog-f")?.textContent).toContain(
      "検証エラーが 2 件あるため実行できません。",
    );
  });

  it("検証エラーがなければ警告があっても実行できる", async () => {
    await mount(docOf(staticText("t1")));
    expect(container.querySelector(".apx-warn-card")).not.toBeNull();
    expect(buttonByText("書き出す").disabled).toBe(false);
    expect(container.querySelector(".apx-dialog-f")?.textContent).toContain(
      "警告は書き出しを妨げません。",
    );
  });

  it("Q01（適格請求書の記載事項欠落）警告があっても主ボタンは disabled にならない", async () => {
    await mount({ ...docOf(staticText("t1")), docType: "qualifiedInvoice" });
    expect(buttonByText("書き出す").disabled).toBe(false);
  });
});

describe("サンプルデータの厳格パース", () => {
  it.each([
    ['{"a":', "JSON として解釈できません"],
    ["[]", "オブジェクトではありません"],
  ])("不正データ %j はダイアログ内エラーになる", async (json, phrase) => {
    await mount(docOf(staticText("t1")), json);
    click(buttonByText("書き出す"));
    await vi.waitFor(() => {
      const error = container.querySelector(".apx-export-error");
      expect(error).not.toBeNull();
      expect(error?.textContent).toContain(phrase);
      expect(error?.textContent).toContain("プレビューのサンプルデータ欄");
      expect(error?.textContent).toContain("生成物は作成されていません。");
    });
    expect(vi.mocked(triggerDownload)).not.toHaveBeenCalled();
  });
});

describe("実行エラーの表示", () => {
  it("C 群エラーを 規則ID / path / message で列挙し、生成物なしを明記する", async () => {
    await mount(docOf(staticText("t1", { text: "{title}" })), '{"title": 123}');
    click(buttonByText("書き出す"));
    await vi.waitFor(() => {
      const error = container.querySelector(".apx-export-error");
      expect(error).not.toBeNull();
      expect(error?.textContent).toContain("C01");
      expect(error?.textContent).toContain("elements[0].text");
      expect(error?.textContent).toContain("生成物は作成されていません。");
    });
    expect(vi.mocked(triggerDownload)).not.toHaveBeenCalled();
  });

  it("フォント形式エラー（fontIssues）を format + message で表示する", async () => {
    vi.mocked(fetchEmbeddedFontData).mockResolvedValue(syntheticCff());
    await mount(docOf(staticText("t1")));
    await selectReportlab();
    click(buttonByText("書き出す"));
    await vi.waitFor(() => {
      const error = container.querySelector(".apx-export-error");
      expect(error).not.toBeNull();
      expect(error?.textContent).toContain("cff");
      expect(error?.textContent).toContain("CFF（OTF）アウトライン");
      expect(error?.textContent).toContain("生成物は作成されていません。");
    });
    expect(vi.mocked(triggerDownload)).not.toHaveBeenCalled();
  });

  it("フォント取得の失敗はダイアログ内エラーになる", async () => {
    vi.mocked(fetchEmbeddedFontData).mockRejectedValue(new Error("不通"));
    await mount(docOf(staticText("t1")));
    await selectReportlab();
    click(buttonByText("書き出す"));
    await vi.waitFor(() => {
      expect(
        container.querySelector(".apx-export-error")?.textContent,
      ).toContain("同梱フォントを取得できませんでした");
    });
    expect(vi.mocked(triggerDownload)).not.toHaveBeenCalled();
  });
});

describe("書き出しの実行", () => {
  it("pdfme 成功時は triggerDownload が正しいファイル名で1回だけ呼ばれ、閉じる", async () => {
    const { onClose } = await mount(docOf(staticText("t1")));
    click(buttonByText("書き出す"));
    await vi.waitFor(() => {
      expect(vi.mocked(triggerDownload)).toHaveBeenCalledOnce();
    });
    const call = vi.mocked(triggerDownload).mock.calls.at(0);
    expect(call?.[1]).toBe("report-pdfme.json");
    expect(call?.[2]?.type).toBe("application/json");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("ReportLab 成功時は zip が1回だけダウンロードされ、閉じる", async () => {
    vi.mocked(fetchEmbeddedFontData).mockResolvedValue(syntheticTtf());
    const { onClose } = await mount(docOf(staticText("t1")));
    await selectReportlab();
    click(buttonByText("書き出す"));
    await vi.waitFor(() => {
      expect(vi.mocked(triggerDownload)).toHaveBeenCalledOnce();
    });
    const call = vi.mocked(triggerDownload).mock.calls.at(0);
    expect(call?.[1]).toBe("report-reportlab.zip");
    expect(call?.[2]?.type).toBe("application/zip");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("registered 解決では fetch なしに選択バイト列で書き出し、zip 内フォント名が <name>.ttf になる", async () => {
    const { store } = await mount({
      ...docOf(staticText("t1")),
      font: { regular: "MyLocalFont" },
    });
    store.registerFont({
      name: "MyLocalFont",
      displayName: "My Local Font",
      data: syntheticTtf(),
      ascentPerEm: 0.8,
    });
    await selectReportlab();
    click(buttonByText("書き出す"));
    await vi.waitFor(() => {
      expect(vi.mocked(triggerDownload)).toHaveBeenCalledOnce();
    });
    expect(vi.mocked(fetchEmbeddedFontData)).not.toHaveBeenCalled();

    const blob = vi.mocked(triggerDownload).mock.calls.at(0)?.[2];
    if (blob === undefined) throw new Error("ダウンロードされていない");
    const zipBytes = new Uint8Array(await blob.arrayBuffer());
    const zipText = new TextDecoder("latin1").decode(zipBytes);
    expect(zipText).toContain("MyLocalFont.ttf");
  });

  it("bold スロットが registered なら zip に2つのフォントファイルが入る", async () => {
    const { store } = await mount({
      ...docOf(staticText("t1")),
      font: { regular: "MyLocalFont", bold: "MyLocalBold" },
    });
    store.registerFont({
      name: "MyLocalFont",
      displayName: "My Local Font",
      data: syntheticTtf(),
      ascentPerEm: 0.8,
    });
    store.registerFont({
      name: "MyLocalBold",
      displayName: "My Local Bold",
      data: syntheticTtf(),
      ascentPerEm: 0.8,
    });
    await selectReportlab();
    click(buttonByText("書き出す"));
    await vi.waitFor(() => {
      expect(vi.mocked(triggerDownload)).toHaveBeenCalledOnce();
    });
    const blob = vi.mocked(triggerDownload).mock.calls.at(0)?.[2];
    if (blob === undefined) throw new Error("ダウンロードされていない");
    const zipBytes = new Uint8Array(await blob.arrayBuffer());
    const zipText = new TextDecoder("latin1").decode(zipBytes);
    expect(zipText).toContain("MyLocalFont.ttf");
    expect(zipText).toContain("MyLocalBold.ttf");
  });

  it("bold スロットの missing はスロット名付きエラーになり、ダウンロードしない", async () => {
    await mount({
      ...docOf(staticText("t1")),
      font: { regular: "NotoSansJP", bold: "GoneBold" },
    });
    await selectReportlab();
    click(buttonByText("書き出す"));
    await vi.waitFor(() => {
      const error = container.querySelector(".apx-export-error");
      expect(error).not.toBeNull();
      expect(error?.textContent).toContain(
        "太字フォント「GoneBold」の実データがありません",
      );
    });
    expect(vi.mocked(triggerDownload)).not.toHaveBeenCalled();
  });

  it("missing 解決ではダウンロードせず font-missing エラーを表示する", async () => {
    await mount({ ...docOf(staticText("t1")), font: { regular: "GoneFont" } });
    await selectReportlab();
    click(buttonByText("書き出す"));
    await vi.waitFor(() => {
      const error = container.querySelector(".apx-export-error");
      expect(error).not.toBeNull();
      expect(error?.textContent).toContain(
        "フォント「GoneFont」の実データがありません",
      );
      expect(error?.textContent).toContain("生成物は作成されていません。");
    });
    expect(vi.mocked(triggerDownload)).not.toHaveBeenCalled();
    expect(vi.mocked(fetchEmbeddedFontData)).not.toHaveBeenCalled();
  });

  it("running 中は主ボタンが disabled になり二重実行しない", async () => {
    let resolveFont: (data: Uint8Array) => void = () => {};
    vi.mocked(fetchEmbeddedFontData).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFont = resolve;
        }),
    );
    await mount(docOf(staticText("t1")));
    await selectReportlab();
    click(buttonByText("書き出す"));
    await vi.waitFor(() => {
      expect(buttonByText("書き出す").disabled).toBe(true);
      expect(container.textContent).toContain("書き出しています…");
    });
    buttonByText("書き出す").click();
    expect(vi.mocked(fetchEmbeddedFontData)).toHaveBeenCalledOnce();

    resolveFont(syntheticTtf());
    await vi.waitFor(() => {
      expect(vi.mocked(triggerDownload)).toHaveBeenCalledOnce();
    });
  });
});

describe("雛形モード", () => {
  it("サンプルデータ空でも pdfme を書き出せる（data-error にならない）", async () => {
    const { onClose } = await mount(docOf(staticText("t1")), "");
    click(buttonByText("書き出す"));
    await vi.waitFor(() => {
      expect(vi.mocked(triggerDownload)).toHaveBeenCalledOnce();
    });
    const call = vi.mocked(triggerDownload).mock.calls.at(0);
    expect(call?.[1]).toBe("report-pdfme.json");
    expect(container.querySelector(".apx-export-error")).toBeNull();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("サンプルデータ空でも ReportLab を書き出せる（data-error にならない）", async () => {
    vi.mocked(fetchEmbeddedFontData).mockResolvedValue(syntheticTtf());
    const { onClose } = await mount(docOf(staticText("t1")), "");
    await selectReportlab();
    click(buttonByText("書き出す"));
    await vi.waitFor(() => {
      expect(vi.mocked(triggerDownload)).toHaveBeenCalledOnce();
    });
    const call = vi.mocked(triggerDownload).mock.calls.at(0);
    expect(call?.[1]).toBe("report-reportlab.zip");
    expect(container.querySelector(".apx-export-error")).toBeNull();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("サンプルデータが空のときは雛形モードの注記を表示する", async () => {
    await mount(docOf(staticText("t1")), "");
    expect(container.textContent).toContain("雛形として書き出します");
    expect(container.textContent).toContain("build(出力パス, data)");
  });

  it("サンプルデータが入力済みのときは雛形モードの注記を表示しない", async () => {
    await mount(docOf(staticText("t1")), "{}");
    expect(container.textContent).not.toContain("雛形として書き出します");
  });
});

describe("フォント全体埋め込み切替", () => {
  it("pdfme 選択時のみチェックボックスが表示される", async () => {
    await mount(docOf(staticText("t1")));
    expect(container.querySelector('input[type="checkbox"]')).not.toBeNull();

    await selectReportlab();
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it("チェックしていない既定では書き出した JSON に font ブロックを含まない", async () => {
    await mount(docOf(staticText("t1")));
    click(buttonByText("書き出す"));
    await vi.waitFor(() => {
      expect(vi.mocked(triggerDownload)).toHaveBeenCalledOnce();
    });
    const blob = vi.mocked(triggerDownload).mock.calls.at(0)?.[2];
    if (blob === undefined) throw new Error("ダウンロードされていない");
    const parsed = JSON.parse(await blob.text());
    expect(Object.keys(parsed).sort()).toEqual(["inputs", "template"]);
  });

  it("チェックすると書き出した JSON に font: { names, subset: false } を含む", async () => {
    await mount(docOf(staticText("t1")));
    const checkbox = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    if (checkbox === null) throw new Error("チェックボックスがない");
    click(checkbox);
    click(buttonByText("書き出す"));
    await vi.waitFor(() => {
      expect(vi.mocked(triggerDownload)).toHaveBeenCalledOnce();
    });
    const blob = vi.mocked(triggerDownload).mock.calls.at(0)?.[2];
    if (blob === undefined) throw new Error("ダウンロードされていない");
    const parsed = JSON.parse(await blob.text());
    expect(parsed.font).toEqual({ names: ["NotoSansJP"], subset: false });
  });
});

describe("欠落キー警告", () => {
  it("bind キー欠落でも pdfme はダウンロードを実行し、ダイアログを閉じずに警告一覧を表示する", async () => {
    const { onClose } = await mount(docOf(boundText("t1", "title")), "{}");
    click(buttonByText("書き出す"));
    await vi.waitFor(() => {
      expect(vi.mocked(triggerDownload)).toHaveBeenCalledOnce();
    });
    expect(onClose).not.toHaveBeenCalled();
    const warning = container.querySelector('[role="status"]');
    expect(warning).not.toBeNull();
    expect(warning?.textContent).toContain("生成物は作成されています");
    expect(warning?.textContent).toContain("C01");
    expect(warning?.textContent).toContain("elements[0].text");
  });

  it("bind キー欠落でも ReportLab はダウンロードを実行し、ダイアログを閉じずに警告一覧を表示する", async () => {
    vi.mocked(fetchEmbeddedFontData).mockResolvedValue(syntheticTtf());
    const { onClose } = await mount(docOf(boundText("t1", "title")), "{}");
    await selectReportlab();
    click(buttonByText("書き出す"));
    await vi.waitFor(() => {
      expect(vi.mocked(triggerDownload)).toHaveBeenCalledOnce();
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "C01",
    );
  });

  it("完全なデータでは警告が表示されず、従来どおり閉じる", async () => {
    const { onClose } = await mount(
      docOf(boundText("t1", "title")),
      '{"title": "請求書"}',
    );
    click(buttonByText("書き出す"));
    await vi.waitFor(() => {
      expect(vi.mocked(triggerDownload)).toHaveBeenCalledOnce();
    });
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("ターゲット切替で警告状態がリセットされる", async () => {
    await mount(docOf(boundText("t1", "title")), "{}");
    click(buttonByText("書き出す"));
    await vi.waitFor(() => {
      expect(container.querySelector('[role="status"]')).not.toBeNull();
    });
    click(targetCard("ReportLab"));
    await vi.waitFor(() => {
      expect(container.querySelector('[role="status"]')).toBeNull();
    });
  });
});
