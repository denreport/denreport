import type { IrTableElement } from "@denreport/core";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MmBox } from "../../state/geometry";
import { TableSketch } from "./TableSketch";

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

function table(overrides: Partial<IrTableElement> = {}): IrTableElement {
  return {
    type: "table",
    id: "tbl1",
    x: 0,
    y: 0,
    bind: "items",
    columns: [{ key: "a", label: "A", width: 40, align: "left" }],
    rowHeight: 10,
    headerHeight: 10,
    fontSize: 10,
    maxY: 100,
    continuationY: 0,
    minRows: 0,
    ...overrides,
  };
}

function renderSketch(element: IrTableElement, box: MmBox): void {
  act(() => {
    root.render(
      <div>
        <TableSketch element={element} box={box} />
      </div>,
    );
  });
}

describe("TableSketch — stripeColor", () => {
  it("stripeColor がなければ縞を描画しない", () => {
    renderSketch(table(), { x: 0, y: 0, w: 40, h: 10 + 4 * 10 });
    expect(container.querySelectorAll(".apx-tbl-stripe")).toHaveLength(0);
  });

  it("奇数行インデックス（表示上の2, 4行目）にのみ縞を描画する", () => {
    renderSketch(table({ stripeColor: "#f0f0f0" }), {
      x: 0,
      y: 0,
      w: 40,
      h: 10 + 4 * 10,
    });
    const stripes = [...container.querySelectorAll(".apx-tbl-stripe")];
    expect(stripes).toHaveLength(2); // rows=4 → q=1,3 のみ縞
    expect(
      stripes.map((s) => (s as HTMLElement).style.getPropertyValue("--sy")),
    ).toEqual(["20", "40"]);
    expect(
      stripes.map((s) => (s as HTMLElement).style.getPropertyValue("--sh")),
    ).toEqual(["10", "10"]);
    expect(
      stripes.map((s) => (s as HTMLElement).style.getPropertyValue("--sc")),
    ).toEqual(["#f0f0f0", "#f0f0f0"]);
  });

  it("縞は罫線より先（背後）に描画される", () => {
    renderSketch(table({ stripeColor: "#f0f0f0" }), {
      x: 0,
      y: 0,
      w: 40,
      h: 10 + 2 * 10,
    });
    const nodes = [
      ...container.querySelectorAll(".apx-tbl-stripe, .apx-tbl-hline"),
    ];
    expect(nodes[0]?.classList.contains("apx-tbl-stripe")).toBe(true);
  });

  it("行数0（ヘッダのみ）では縞を描画しない", () => {
    renderSketch(table({ stripeColor: "#f0f0f0" }), {
      x: 0,
      y: 0,
      w: 40,
      h: 10,
    });
    expect(container.querySelectorAll(".apx-tbl-stripe")).toHaveLength(0);
  });
});
