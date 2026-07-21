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
    font: { regular: "NotoSansJP" },
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
  const bar = container.querySelector(".dr-drawer-bar");
  if (bar === null) {
    throw new Error("ドロワーバーがない");
  }
  click(bar);
}

describe("collapse bar", () => {
  it("shows ✓ no issues when there are no errors", () => {
    // text elements always get an "approximated" note for vertical overflow behavior,
    // so use a document with no elements to also get zero compat findings
    const store = new EditorStore(makeDocument([]));
    render(<ValidationDrawer store={store} onReveal={() => {}} />);
    expect(container.querySelector(".dr-badge-ok")?.textContent).toContain(
      "問題なし",
    );
    expect(container.querySelector(".dr-drawer-body")).toBeNull();
  });

  it("switches to a count badge when there are errors, and expanding shows the list", () => {
    const store = new EditorStore(
      makeDocument([text("t1", { fontSize: 300 })]),
    );
    render(<ValidationDrawer store={store} onReveal={() => {}} />);
    expect(container.querySelector(".dr-badge-err")?.textContent).toBe("1");
    openDrawer();
    const row = container.querySelector(".dr-verr");
    expect(row?.textContent).toContain("M04");
    expect(row?.textContent).toContain("elements[0].fontSize");
  });

  it("shows a warning badge and list when there are only warnings", () => {
    const store = new EditorStore(makeInvoiceDocument([]));
    render(<ValidationDrawer store={store} onReveal={() => {}} />);
    expect(container.querySelector(".dr-badge-warn")?.textContent).toBe("6");
    expect(container.querySelector(".dr-badge-err")).toBeNull();
    openDrawer();
    const rows = container.querySelectorAll(".dr-verr");
    expect(rows).toHaveLength(6);
    expect([...rows].every((row) => row.textContent?.includes("Q01"))).toBe(
      true,
    );
  });

  it("shows a count instead of no issues when there's a compatibility finding, even without validation errors or warnings", () => {
    const store = new EditorStore(makeDocument([imageEl("img1")]));
    store.setSelectedExportTarget("reportlab");
    render(<ValidationDrawer store={store} onReveal={() => {}} />);
    expect(container.querySelector(".dr-badge-ok")).toBeNull();
    expect(container.querySelector(".dr-badge-warn")?.textContent).toBe("1");
    expect(container.querySelector(".dr-drawer-body")).toBeNull();
  });

  it("when errors and warnings coexist, warnings don't mix into the error badge's count and both lists appear", () => {
    const store = new EditorStore(
      makeInvoiceDocument([text("t1", { fontSize: 300 })]),
    );
    render(<ValidationDrawer store={store} onReveal={() => {}} />);
    expect(container.querySelector(".dr-badge-err")?.textContent).toBe("1");
    expect(container.querySelector(".dr-badge-warn")).toBeNull();
    openDrawer();
    const lists = container.querySelectorAll(".dr-verr-list");
    expect(lists).toHaveLength(2);
    expect(lists[0]?.textContent).toContain("M04");
    expect(lists[1]?.textContent).toContain("Q01");
  });
});

describe("row-click navigation", () => {
  it("selects the matching element and calls onReveal", () => {
    const store = new EditorStore(
      makeDocument([text("t1", { fontSize: 300 })]),
    );
    const onReveal = vi.fn();
    render(<ValidationDrawer store={store} onReveal={onReveal} />);
    openDrawer();
    const row = container.querySelector(".dr-verr");
    if (row === null) {
      throw new Error("エラー行がない");
    }
    click(row);
    expect(store.getState().selection).toEqual(["t1"]);
    expect(onReveal).toHaveBeenCalledExactlyOnceWith("t1");
  });

  it("clicking a row for an element not editable in the current context switches context", () => {
    const store = new EditorStore(
      makeDocument([text("t1", { pages: "last", fontSize: 300 })]),
    );
    render(<ValidationDrawer store={store} onReveal={() => {}} />);
    openDrawer();
    const row = container.querySelector(".dr-verr");
    if (row === null) {
      throw new Error("エラー行がない");
    }
    click(row);
    expect(store.getState().view.pageContext).toBe("last");
    expect(store.getState().selection).toEqual(["t1"]);
  });

  it("a row that doesn't correspond to an element (a page violation) doesn't change the selection or call onReveal", () => {
    const store = new EditorStore(
      makeDocument([], { width: 9999, height: 297 }),
    );
    const onReveal = vi.fn();
    render(<ValidationDrawer store={store} onReveal={onReveal} />);
    openDrawer();
    const row = container.querySelector(".dr-verr");
    if (row === null) {
      throw new Error("エラー行がない");
    }
    expect(row.textContent).toContain("page.width");
    click(row);
    expect(store.getState().selection).toEqual([]);
    expect(onReveal).not.toHaveBeenCalled();
  });

  it("an error row for a flex child selects the child's id", () => {
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
    const row = container.querySelector(".dr-verr");
    if (row === null) {
      throw new Error("エラー行がない");
    }
    click(row);
    expect(store.getState().selection).toEqual(["c1"]);
    expect(onReveal).toHaveBeenCalledExactlyOnceWith("c1");
  });
});

describe("always-on export compatibility display", () => {
  it("shows the guidance text when there are no problems with the default target (pdfme)", () => {
    const store = new EditorStore(makeDocument([imageEl("img1")]));
    render(<ValidationDrawer store={store} onReveal={() => {}} />);
    openDrawer();
    expect(container.querySelector(".dr-warn-card")).toBeNull();
    expect(container.textContent).toContain(
      "✓ 選択中のターゲットですべての要素を書き出せます。",
    );
  });

  it("shows the selected target's compatibility finding in a card", () => {
    const store = new EditorStore(makeDocument([imageEl("img1")]));
    store.setSelectedExportTarget("reportlab");
    render(<ValidationDrawer store={store} onReveal={() => {}} />);
    openDrawer();
    const card = container.querySelector(".dr-warn-card");
    expect(card?.classList.contains("is-approximated")).toBe(true);
    expect(card?.querySelector(".dr-chip")?.textContent).toBe("img1");
  });

  it("clicking the compatibility chip selects the matching element and calls onReveal", () => {
    const store = new EditorStore(makeDocument([imageEl("img1")]));
    store.setSelectedExportTarget("reportlab");
    const onReveal = vi.fn();
    render(<ValidationDrawer store={store} onReveal={onReveal} />);
    openDrawer();
    const chip = container.querySelector<HTMLButtonElement>(".dr-chip");
    if (chip === null) {
      throw new Error("互換性チップがない");
    }
    click(chip);
    expect(store.getState().selection).toEqual(["img1"]);
    expect(onReveal).toHaveBeenCalledExactlyOnceWith("img1");
  });

  it("the list is recalculated when the target is switched", () => {
    const store = new EditorStore(makeDocument([imageEl("img1")]));
    render(<ValidationDrawer store={store} onReveal={() => {}} />);
    openDrawer();
    expect(container.querySelector(".dr-warn-card")).toBeNull();

    act(() => {
      store.setSelectedExportTarget("reportlab");
    });
    expect(container.querySelector(".dr-warn-card")).not.toBeNull();
  });
});
