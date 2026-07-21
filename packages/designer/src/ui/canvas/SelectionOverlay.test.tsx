import type { IrDocument, IrElement } from "@denreport/core";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { layoutDocument } from "../../state/geometry";
import { EditorStore } from "../../state/store";
import type { InteractionState } from "./interaction";
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

function tableElement(id: string): IrElement {
  return {
    type: "table",
    id,
    x: 10,
    y: 10,
    bind: "items",
    columns: [{ key: "name", label: "品目", width: 50, align: "left" }],
    rowHeight: 8,
    headerHeight: 8,
    fontSize: 10,
    maxY: 100,
    continuationY: 10,
    minRows: 2,
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

function renderRectWithInteraction(
  rotate: number | undefined,
  interaction: InteractionState,
): void {
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
        interaction={interaction}
      />,
    );
  });
}

function dragGhost(): HTMLElement {
  const node = container.querySelector(".dr-drag-ghost");
  if (node === null) throw new Error(".dr-drag-ghost がない");
  return node as HTMLElement;
}

function handle(id: string): HTMLElement {
  const node = container.querySelector(`.dr-h[data-dr-handle="${id}"]`);
  if (node === null) throw new Error(`ハンドル ${id} がない`);
  return node as HTMLElement;
}

function selBox(): HTMLElement {
  const node = container.querySelector(".dr-sel-box");
  if (node === null) throw new Error(".dr-sel-box がない");
  return node as HTMLElement;
}

function cssVar(el: HTMLElement, name: string): string {
  return el.style.getPropertyValue(name);
}

describe("SelectionOverlay — selection box and handles follow rotation", () => {
  it("when rotate: 90, the selection box and handles have coordinates rotated around the center", () => {
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

  it("when rotate is unspecified, coordinates remain non-rotated (regression guard)", () => {
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

  it("rotates correctly around the center (segment midpoint) even for a line (degenerate box)", () => {
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

describe("SelectionOverlay — drag ghost follows rotation", () => {
  it("while moving, a rotated element has dr-drag-ghost--rotated and --rot", () => {
    renderRectWithInteraction(45, {
      kind: "moving",
      ids: ["r1"],
      start: { x: 10, y: 20 },
      offset: { x: 5, y: 5 },
      guides: [],
      flexId: null,
      insertIndex: null,
    });

    const ghost = dragGhost();
    expect(ghost.classList.contains("dr-drag-ghost--rotated")).toBe(true);
    expect(cssVar(ghost, "--rot")).toBe("45deg");
  });

  it("while moving, a non-rotated element does not have dr-drag-ghost--rotated", () => {
    renderRectWithInteraction(undefined, {
      kind: "moving",
      ids: ["r1"],
      start: { x: 10, y: 20 },
      offset: { x: 5, y: 5 },
      guides: [],
      flexId: null,
      insertIndex: null,
    });

    const ghost = dragGhost();
    expect(ghost.classList.contains("dr-drag-ghost--rotated")).toBe(false);
    expect(cssVar(ghost, "--rot")).toBe("");
  });

  it("while resizing, a rotated element has dr-drag-ghost--rotated and --rot", () => {
    renderRectWithInteraction(30, {
      kind: "resizing",
      id: "r1",
      handle: "se",
      start: { x: 50, y: 40 },
      box: { x: 10, y: 20, w: 60, h: 30 },
      guides: [],
    });

    const ghost = dragGhost();
    expect(ghost.classList.contains("dr-drag-ghost--rotated")).toBe(true);
    expect(cssVar(ghost, "--rot")).toBe("30deg");
  });

  it("while resizing, a non-rotated element does not have dr-drag-ghost--rotated", () => {
    renderRectWithInteraction(undefined, {
      kind: "resizing",
      id: "r1",
      handle: "se",
      start: { x: 50, y: 40 },
      box: { x: 10, y: 20, w: 60, h: 30 },
      guides: [],
    });

    const ghost = dragGhost();
    expect(ghost.classList.contains("dr-drag-ghost--rotated")).toBe(false);
    expect(cssVar(ghost, "--rot")).toBe("");
  });
});

describe("SelectionOverlay — move bands when a table is selected", () => {
  it("selecting a single table renders 4-sided move bands with the data-dr-move-band attribute", () => {
    const document: IrDocument = {
      version: "1.0",
      page: { width: 210, height: 297 },
      font: { regular: "NotoSansJP" },
      elements: [tableElement("tbl1")],
    };
    const store = new EditorStore(document);
    store.setSelection(["tbl1"]);
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

    const bands = container.querySelectorAll("[data-dr-move-band]");
    expect(bands.length).toBe(4);
    for (const band of bands) {
      expect(band.getAttribute("data-dr-id")).toBe("tbl1");
      expect(band.classList.contains("dr-move-band")).toBe(true);
    }
    const sides = [...bands].map((band) =>
      [...band.classList].find((c) => c.startsWith("dr-move-band--")),
    );
    expect(sides.sort()).toEqual(
      [
        "dr-move-band--top",
        "dr-move-band--right",
        "dr-move-band--bottom",
        "dr-move-band--left",
      ].sort(),
    );
  });

  it("move bands are not rendered when a non-table element is selected", () => {
    renderRect(undefined);

    expect(container.querySelectorAll("[data-dr-move-band]").length).toBe(0);
  });
});
