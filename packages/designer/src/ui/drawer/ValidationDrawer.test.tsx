import type { IrDocument, IrElement } from "@denreport/core";
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorStore } from "../../state/store";
import { ValidationDrawer } from "./ValidationDrawer";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeDocument(
  elements: readonly IrElement[],
  page = { width: 210, height: 297 },
): IrDocument {
  return {
    version: "1.0",
    page,
    font: { name: "NotoSansJP" },
    elements,
  };
}

function makeInvoiceDocument(elements: readonly IrElement[]): IrDocument {
  return { ...makeDocument(elements), docType: "qualifiedInvoice" };
}

function text(id: string, overrides: Partial<IrElement> = {}): IrElement {
  return {
    type: "text",
    id,
    x: 10,
    y: 10,
    pages: "first",
    w: 40,
    h: 8,
    text: "a",
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
    ...overrides,
  } as IrElement;
}

function imageEl(id: string): IrElement {
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

function click(el: Element): void {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function openDrawer(): void {
  const bar = container.querySelector(".apx-drawer-bar");
  if (bar === null) {
    throw new Error("ドロワーバーがない");
  }
  click(bar);
}

describe("折畳バー", () => {
  it("エラーなしでは ✓ 問題なし を表示する", () => {
    // text 要素は縦方向はみ出しの挙動注記が常に approximated になるため、
    // 互換性判定もゼロにするには要素なしの文書を使う
    const store = new EditorStore(makeDocument([]));
    render(<ValidationDrawer store={store} onReveal={() => {}} />);
    expect(container.querySelector(".apx-badge-ok")?.textContent).toContain(
      "問題なし",
    );
    expect(container.querySelector(".apx-drawer-body")).toBeNull();
  });

  it("エラーがあると件数バッジに切り替わり、展開で一覧が出る", () => {
    const store = new EditorStore(
      makeDocument([text("t1", { fontSize: 300 })]),
    );
    render(<ValidationDrawer store={store} onReveal={() => {}} />);
    expect(container.querySelector(".apx-badge-err")?.textContent).toBe("1");
    openDrawer();
    const row = container.querySelector(".apx-verr");
    expect(row?.textContent).toContain("M04");
    expect(row?.textContent).toContain("elements[0].fontSize");
  });

  it("警告のみのときは警告バッジと一覧を表示する", () => {
    const store = new EditorStore(makeInvoiceDocument([]));
    render(<ValidationDrawer store={store} onReveal={() => {}} />);
    expect(container.querySelector(".apx-badge-warn")?.textContent).toBe("6");
    expect(container.querySelector(".apx-badge-err")).toBeNull();
    openDrawer();
    const rows = container.querySelectorAll(".apx-verr");
    expect(rows).toHaveLength(6);
    expect([...rows].every((row) => row.textContent?.includes("Q01"))).toBe(
      true,
    );
  });

  it("検証エラー・警告がなくても互換性判定があれば問題なしにせず件数を出す", () => {
    const store = new EditorStore(makeDocument([imageEl("img1")]));
    store.setSelectedExportTarget("reportlab");
    render(<ValidationDrawer store={store} onReveal={() => {}} />);
    expect(container.querySelector(".apx-badge-ok")).toBeNull();
    expect(container.querySelector(".apx-badge-warn")?.textContent).toBe("1");
    expect(container.querySelector(".apx-drawer-body")).toBeNull();
  });

  it("エラーと警告が混在するとき、エラーバッジの件数に警告は混ざらず両方の一覧が並ぶ", () => {
    const store = new EditorStore(
      makeInvoiceDocument([text("t1", { fontSize: 300 })]),
    );
    render(<ValidationDrawer store={store} onReveal={() => {}} />);
    expect(container.querySelector(".apx-badge-err")?.textContent).toBe("1");
    expect(container.querySelector(".apx-badge-warn")).toBeNull();
    openDrawer();
    const lists = container.querySelectorAll(".apx-verr-list");
    expect(lists).toHaveLength(2);
    expect(lists[0]?.textContent).toContain("M04");
    expect(lists[1]?.textContent).toContain("Q01");
  });
});

describe("行クリックのナビゲーション", () => {
  it("該当要素を選択して onReveal を呼ぶ", () => {
    const store = new EditorStore(
      makeDocument([text("t1", { fontSize: 300 })]),
    );
    const onReveal = vi.fn();
    render(<ValidationDrawer store={store} onReveal={onReveal} />);
    openDrawer();
    const row = container.querySelector(".apx-verr");
    if (row === null) {
      throw new Error("エラー行がない");
    }
    click(row);
    expect(store.getState().selection).toEqual(["t1"]);
    expect(onReveal).toHaveBeenCalledExactlyOnceWith("t1");
  });

  it("現文脈で編集できない要素の行クリックは文脈を切り替える", () => {
    const store = new EditorStore(
      makeDocument([text("t1", { pages: "last", fontSize: 300 })]),
    );
    render(<ValidationDrawer store={store} onReveal={() => {}} />);
    openDrawer();
    const row = container.querySelector(".apx-verr");
    if (row === null) {
      throw new Error("エラー行がない");
    }
    click(row);
    expect(store.getState().view.pageContext).toBe("last");
    expect(store.getState().selection).toEqual(["t1"]);
  });

  it("要素に対応しない行（page の違反）では選択を変えず onReveal も呼ばない", () => {
    const store = new EditorStore(
      makeDocument([], { width: 9999, height: 297 }),
    );
    const onReveal = vi.fn();
    render(<ValidationDrawer store={store} onReveal={onReveal} />);
    openDrawer();
    const row = container.querySelector(".apx-verr");
    if (row === null) {
      throw new Error("エラー行がない");
    }
    expect(row.textContent).toContain("page.width");
    click(row);
    expect(store.getState().selection).toEqual([]);
    expect(onReveal).not.toHaveBeenCalled();
  });

  it("flex 子のエラー行は子 id を選択する", () => {
    const flex: IrElement = {
      type: "flex",
      id: "f1",
      x: 10,
      y: 10,
      pages: "first",
      direction: "column",
      gap: 0,
      justifyContent: "start",
      alignItems: "start",
      children: [
        {
          type: "text",
          id: "c1",
          w: 40,
          h: 8,
          text: "a",
          fontSize: 300,
          align: "left",
          lineHeight: 1.25,
        },
      ],
    };
    const store = new EditorStore(makeDocument([flex]));
    const onReveal = vi.fn();
    render(<ValidationDrawer store={store} onReveal={onReveal} />);
    openDrawer();
    const row = container.querySelector(".apx-verr");
    if (row === null) {
      throw new Error("エラー行がない");
    }
    click(row);
    expect(store.getState().selection).toEqual(["c1"]);
    expect(onReveal).toHaveBeenCalledExactlyOnceWith("c1");
  });
});

describe("書き出し互換性の常時表示", () => {
  it("既定ターゲット（pdfme）で問題がなければ案内文言を表示する", () => {
    const store = new EditorStore(makeDocument([imageEl("img1")]));
    render(<ValidationDrawer store={store} onReveal={() => {}} />);
    openDrawer();
    expect(container.querySelector(".apx-warn-card")).toBeNull();
    expect(container.textContent).toContain(
      "✓ 選択中のターゲットですべての要素を書き出せます。",
    );
  });

  it("選択中ターゲットの互換性判定をカードで表示する", () => {
    const store = new EditorStore(makeDocument([imageEl("img1")]));
    store.setSelectedExportTarget("reportlab");
    render(<ValidationDrawer store={store} onReveal={() => {}} />);
    openDrawer();
    const card = container.querySelector(".apx-warn-card");
    expect(card?.classList.contains("is-approximated")).toBe(true);
    expect(card?.querySelector(".apx-chip")?.textContent).toBe("img1");
  });

  it("互換性チップのクリックで該当要素を選択して onReveal を呼ぶ", () => {
    const store = new EditorStore(makeDocument([imageEl("img1")]));
    store.setSelectedExportTarget("reportlab");
    const onReveal = vi.fn();
    render(<ValidationDrawer store={store} onReveal={onReveal} />);
    openDrawer();
    const chip = container.querySelector<HTMLButtonElement>(".apx-chip");
    if (chip === null) {
      throw new Error("互換性チップがない");
    }
    click(chip);
    expect(store.getState().selection).toEqual(["img1"]);
    expect(onReveal).toHaveBeenCalledExactlyOnceWith("img1");
  });

  it("ターゲット切替で一覧が再計算される", () => {
    const store = new EditorStore(makeDocument([imageEl("img1")]));
    render(<ValidationDrawer store={store} onReveal={() => {}} />);
    openDrawer();
    expect(container.querySelector(".apx-warn-card")).toBeNull();

    act(() => {
      store.setSelectedExportTarget("reportlab");
    });
    expect(container.querySelector(".apx-warn-card")).not.toBeNull();
  });
});
