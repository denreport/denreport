import type { IrDocument, IrElement } from "@denreport/core";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { layoutDocument } from "../../state/geometry";
import { EditorStore } from "../../state/store";
import { SelectionOverlay } from "./SelectionOverlay";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

function rectElement(rotate: number | undefined): IrElement {
  return {
    type: "rect",
    id: "r1",
    x: 10,
    y: 20,
    w: 40,
    h: 20,
    pages: "first",
    borderWidth: 0.3,
    ...(rotate !== undefined ? { rotate } : {}),
  };
}

function renderRect(rotate: number | undefined): void {
  const document: IrDocument = {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements: [rectElement(rotate)],
  };
  const store = new EditorStore(document);
  store.setSelection(["r1"]);
  const state = store.getState();
  const layout = layoutDocument(document, state.view.pageContext);
  act(() => {
    root.render(
      <SelectionOverlay
        state={state}
        layout={layout}
        interaction={{ kind: "idle" }}
      />,
    );
  });
}

function handle(id: string): HTMLElement {
  const node = container.querySelector(`.apx-h[data-apx-handle="${id}"]`);
  if (node === null) throw new Error(`ハンドル ${id} がない`);
  return node as HTMLElement;
}

function selBox(): HTMLElement {
  const node = container.querySelector(".apx-sel-box");
  if (node === null) throw new Error(".apx-sel-box がない");
  return node as HTMLElement;
}

function cssVar(el: HTMLElement, name: string): string {
  return el.style.getPropertyValue(name);
}

describe("SelectionOverlay — 回転に追従する選択枠・ハンドル", () => {
  it("rotate: 90 のとき選択枠とハンドルが中心周りに回転した座標を持つ", () => {
    renderRect(90);

    expect(cssVar(selBox(), "--rot")).toBe("90deg");

    const nw = handle("nw");
    expect(parseFloat(cssVar(nw, "--hx"))).toBeCloseTo(40);
    expect(parseFloat(cssVar(nw, "--hy"))).toBeCloseTo(10);
    expect(cssVar(nw, "--rot")).toBe("90deg");

    const rotateHandle = handle("rotate");
    expect(parseFloat(cssVar(rotateHandle, "--hx"))).toBeCloseTo(40);
    expect(parseFloat(cssVar(rotateHandle, "--hy"))).toBeCloseTo(30);
    expect(cssVar(rotateHandle, "--rot")).toBe("90deg");
  });

  it("rotate 未指定のときは非回転座標のまま（回帰ガード）", () => {
    renderRect(undefined);

    expect(cssVar(selBox(), "--rot")).toBe("");

    const nw = handle("nw");
    expect(cssVar(nw, "--hx")).toBe("10");
    expect(cssVar(nw, "--hy")).toBe("20");
    expect(cssVar(nw, "--rot")).toBe("");

    const rotateHandle = handle("rotate");
    expect(cssVar(rotateHandle, "--hx")).toBe("30");
    expect(cssVar(rotateHandle, "--hy")).toBe("20");
    expect(cssVar(rotateHandle, "--rot")).toBe("");
  });

  it("line（退化した箱）でも中心（線分中点）周りに正しく回転する", () => {
    const document: IrDocument = {
      version: "1.0",
      page: { width: 210, height: 297 },
      font: { regular: "NotoSansJP" },
      elements: [
        {
          type: "line",
          id: "l1",
          x: 10,
          y: 20,
          pages: "first",
          orientation: "horizontal",
          length: 40,
          thickness: 0.3,
          rotate: 90,
        },
      ],
    };
    const store = new EditorStore(document);
    store.setSelection(["l1"]);
    const state = store.getState();
    const layout = layoutDocument(document, state.view.pageContext);
    act(() => {
      root.render(
        <SelectionOverlay
          state={state}
          layout={layout}
          interaction={{ kind: "idle" }}
        />,
      );
    });

    const start = handle("line-start");
    expect(parseFloat(cssVar(start, "--hx"))).toBeCloseTo(30);
    expect(parseFloat(cssVar(start, "--hy"))).toBeCloseTo(0);

    const end = handle("line-end");
    expect(parseFloat(cssVar(end, "--hx"))).toBeCloseTo(30);
    expect(parseFloat(cssVar(end, "--hy"))).toBeCloseTo(40);
  });
});
