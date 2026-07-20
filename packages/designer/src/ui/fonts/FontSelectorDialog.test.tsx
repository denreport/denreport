import type { IrFontSlot } from "@denreport/core";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessagesContext } from "../../i18n/context";
import { en } from "../../i18n/messages/en";
import { FontSelectorDialog } from "./FontSelectorDialog";

// In jsdom, globalThis === window, so growing queryLocalFonts via vi.stubGlobal makes it
// observable as window.queryLocalFonts
function stubQueryLocalFonts(
  impl: () => Promise<
    readonly {
      readonly postscriptName: string;
      readonly fullName: string;
      readonly family: string;
      readonly style: string;
      readonly bytes: Uint8Array<ArrayBuffer>;
    }[]
  >,
): void {
  vi.stubGlobal("queryLocalFonts", () =>
    impl().then((list) =>
      list.map((font) => ({
        ...font,
        blob: async () => new Blob([font.bytes]),
      })),
    ),
  );
}

function stubQueryLocalFontsRejecting(error: Error): void {
  vi.stubGlobal("queryLocalFonts", () => Promise.reject(error));
}

// A minimal TTF that readAscentPerEm can read (glyf + head.unitsPerEm + hhea.ascender)
function embeddedTtf(): Uint8Array<ArrayBuffer> {
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

function syntheticCff(): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(12 + 16);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x4f54544f); // "OTTO"
  view.setUint16(4, 1);
  view.setUint32(12, 0x43464620); // "CFF "
  return bytes;
}

const TTF_A = {
  postscriptName: "A-Regular",
  fullName: "A Font",
  family: "A",
  style: "Regular",
  bytes: embeddedTtf(),
};
const TTF_B = {
  postscriptName: "B-Bold",
  fullName: "B Font Bold",
  family: "B Font",
  style: "Bold",
  bytes: embeddedTtf(),
};

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
  vi.unstubAllGlobals();
});

interface Handlers {
  readonly onSelect: ReturnType<typeof vi.fn>;
  readonly onSelectEmbedded: ReturnType<typeof vi.fn>;
  readonly onClear: ReturnType<typeof vi.fn>;
  readonly onClose: ReturnType<typeof vi.fn>;
}

async function renderDialog(
  currentName: string | undefined = "NotoSansJP",
  slot: IrFontSlot = "regular",
): Promise<Handlers> {
  const onSelect = vi.fn();
  const onSelectEmbedded = vi.fn();
  const onClear = vi.fn();
  const onClose = vi.fn();
  root.render(
    <FontSelectorDialog
      slot={slot}
      currentName={currentName}
      onSelect={onSelect}
      onSelectEmbedded={onSelectEmbedded}
      onClear={onClear}
      onClose={onClose}
    />,
  );
  await vi.waitFor(() => {
    if (container.querySelector(".dr-dialog") === null) {
      throw new Error("ダイアログが未描画");
    }
  });
  return { onSelect, onSelectEmbedded, onClear, onClose };
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

// A font row button has two spans, fullName and a subtext, so textContent doesn't match exactly
function fontRowButton(fullName: string): HTMLButtonElement {
  const name = [...container.querySelectorAll(".dr-font-name")].find(
    (el) => el.textContent === fullName,
  );
  const button = name?.closest("button");
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`フォント行がない: ${fullName}`);
  }
  return button;
}

function click(el: Element): void {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("一覧表示・検索", () => {
  it("候補一覧を表示し、検索で絞り込む", async () => {
    stubQueryLocalFonts(async () => [TTF_A, TTF_B]);
    await renderDialog();
    await vi.waitFor(() => {
      expect(container.textContent).toContain("A Font");
      expect(container.textContent).toContain("B Font Bold");
    });

    const search = container.querySelector("input[type=search]");
    if (!(search instanceof HTMLInputElement)) throw new Error("検索欄がない");
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(search, "bold");
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(container.textContent).not.toContain("A Font");
    expect(container.textContent).toContain("B Font Bold");
  });
});

describe("確定", () => {
  it("TTF 候補の確定で検証済み RegisteredFont が onSelect に渡る", async () => {
    stubQueryLocalFonts(async () => [TTF_A]);
    const { onSelect } = await renderDialog();
    await vi.waitFor(() => fontRowButton("A Font"));

    click(fontRowButton("A Font"));
    await vi.waitFor(() => {
      expect(buttonByText("このフォントを使う").disabled).toBe(false);
    });
    click(buttonByText("このフォントを使う"));
    await vi.waitFor(() => {
      expect(onSelect).toHaveBeenCalledOnce();
    });
    const font = onSelect.mock.calls[0]?.[0];
    expect(font.displayName).toBe("A Font");
    expect(font.ascentPerEm).toBeCloseTo(0.8, 6);
  });

  it("非 TTF の確定は issues を表示し閉じない", async () => {
    stubQueryLocalFonts(async () => [{ ...TTF_A, bytes: syntheticCff() }]);
    const { onSelect, onClose } = await renderDialog();
    await vi.waitFor(() => fontRowButton("A Font"));

    click(fontRowButton("A Font"));
    await vi.waitFor(() => {
      expect(buttonByText("このフォントを使う").disabled).toBe(false);
    });
    click(buttonByText("このフォントを使う"));
    await vi.waitFor(() => {
      expect(container.textContent).toContain("CFF（OTF）アウトライン");
    });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("「同梱フォントに戻す」で onSelectEmbedded にスロットの同梱名が渡る", async () => {
    stubQueryLocalFonts(async () => [TTF_A]);
    const { onSelectEmbedded } = await renderDialog();
    await vi.waitFor(() => buttonByText("同梱フォント（NotoSansJP）に戻す"));

    click(buttonByText("同梱フォント（NotoSansJP）に戻す"));
    expect(onSelectEmbedded).toHaveBeenCalledExactlyOnceWith("NotoSansJP");
  });

  it("bold スロットでは同梱行が NotoSansJPBold になり、「未設定に戻す」で onClear が呼ばれる", async () => {
    stubQueryLocalFonts(async () => [TTF_A]);
    const { onSelectEmbedded, onClear } = await renderDialog(
      "NotoSansJPBold",
      "bold",
    );
    await vi.waitFor(() =>
      buttonByText("同梱フォント（NotoSansJPBold）に戻す"),
    );

    click(buttonByText("同梱フォント（NotoSansJPBold）に戻す"));
    expect(onSelectEmbedded).toHaveBeenCalledExactlyOnceWith("NotoSansJPBold");

    click(buttonByText("未設定に戻す（標準フォントで代替）"));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("italic スロットでは同梱行を出さず、「未設定に戻す」行だけ出す", async () => {
    stubQueryLocalFonts(async () => [TTF_A]);
    await renderDialog(undefined, "italic");
    await vi.waitFor(() => buttonByText("未設定に戻す（標準フォントで代替）"));
    expect(container.textContent).not.toContain("同梱フォント（");
  });

  it("regular スロットでは「未設定に戻す」行を出さない", async () => {
    stubQueryLocalFonts(async () => [TTF_A]);
    await renderDialog();
    await vi.waitFor(() => buttonByText("同梱フォント（NotoSansJP）に戻す"));
    expect(container.textContent).not.toContain("未設定に戻す");
  });

  it("キャンセルで onClose が呼ばれる", async () => {
    stubQueryLocalFonts(async () => [TTF_A]);
    const { onClose } = await renderDialog();

    click(buttonByText("キャンセル"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("非対応・拒否・失敗の表示", () => {
  it("unsupported: queryLocalFonts が無い環境の説明文を表示する", async () => {
    await renderDialog();
    await vi.waitFor(() => {
      expect(container.textContent).toContain(
        "PC 内フォントの一覧取得に対応していません",
      );
    });
  });

  it("denied: NotAllowedError で許可されなかった旨を表示する", async () => {
    stubQueryLocalFontsRejecting(
      Object.assign(new Error("denied"), { name: "NotAllowedError" }),
    );
    await renderDialog();
    await vi.waitFor(() => {
      expect(container.textContent).toContain("許可されませんでした");
    });
  });

  it("error: その他の失敗は再試行ボタン付きで表示する", async () => {
    stubQueryLocalFontsRejecting(new Error("boom"));
    await renderDialog();
    await vi.waitFor(() => {
      expect(container.textContent).toContain("取得できませんでした");
      buttonByText("再試行");
    });
  });
});

describe("en の MessagesContext", () => {
  it("文言が英語で描画される", async () => {
    stubQueryLocalFonts(async () => []);
    root.render(
      <MessagesContext.Provider value={en}>
        <FontSelectorDialog
          slot="regular"
          currentName="NotoSansJP"
          onSelect={vi.fn()}
          onSelectEmbedded={vi.fn()}
          onClear={vi.fn()}
          onClose={vi.fn()}
        />
      </MessagesContext.Provider>,
    );
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Choose the regular font");
    });
    expect(buttonByText("Cancel")).not.toBeNull();
    expect(buttonByText("Revert to bundled font (NotoSansJP)")).not.toBeNull();
  });
});
