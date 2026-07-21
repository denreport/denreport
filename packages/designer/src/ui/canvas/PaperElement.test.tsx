import type { IrElement, IrTableElement } from "@denreport/core";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PlacedElementView } from "../../state/geometry";
import type { FontMetricsSet } from "../fonts/font-metrics";
import { PaperElement } from "./PaperElement";

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

function viewOf(element: IrElement): PlacedElementView {
  return {
    id: element.id,
    element,
    box: { x: 0, y: 0, w: 40, h: 20 },
    pages: "pages" in element ? element.pages : null,
    parentFlexId: null,
    childIndex: null,
  };
}

function renderEl(element: IrElement, metrics?: FontMetricsSet | null): void {
  act(() => {
    root.render(
      <PaperElement
        view={viewOf(element)}
        context="first"
        dragging={false}
        metrics={metrics}
      />,
    );
  });
}

function el(): HTMLElement {
  const node = container.querySelector(".dr-el");
  if (node === null) throw new Error(".dr-el がない");
  return node as HTMLElement;
}

describe("PaperElement — rect CSS variables", () => {
  it("does not emit color/fill/corner-radius CSS variables without style attributes", () => {
    renderEl({
      type: "rect",
      id: "r1",
      x: 0,
      y: 0,
      pages: "first",
      w: 40,
      h: 20,
      borderWidth: 0.3,
    });
    expect(el().style.getPropertyValue("--bc")).toBe("");
    expect(el().style.getPropertyValue("--fc")).toBe("");
    expect(el().style.getPropertyValue("--rr")).toBe("");
    expect(el().style.getPropertyValue("--ls")).toBe("");
  });

  it("reflects border color, fill color, corner radius, and line style into CSS variables", () => {
    renderEl({
      type: "rect",
      id: "r1",
      x: 0,
      y: 0,
      pages: "first",
      w: 40,
      h: 20,
      borderWidth: 0.3,
      borderColor: "#112233",
      fillColor: "#eeeeee",
      borderStyle: "dotted",
      cornerRadius: 3,
    });
    expect(el().style.getPropertyValue("--bc")).toBe("#112233");
    expect(el().style.getPropertyValue("--fc")).toBe("#eeeeee");
    expect(el().style.getPropertyValue("--rr")).toBe("3");
    expect(el().style.getPropertyValue("--ls")).toBe("dotted");
  });

  it("approximates dashdot / dashdotdot as dashed", () => {
    renderEl({
      type: "rect",
      id: "r1",
      x: 0,
      y: 0,
      pages: "first",
      w: 40,
      h: 20,
      borderWidth: 0.3,
      borderStyle: "dashdotdot",
    });
    expect(el().style.getPropertyValue("--ls")).toBe("dashed");
  });

  it("adds the is-borderless class when borderWidth is 0 (no border)", () => {
    renderEl({
      type: "rect",
      id: "r1",
      x: 0,
      y: 0,
      pages: "first",
      w: 40,
      h: 20,
      borderWidth: 0,
    });
    expect(el().classList.contains("is-borderless")).toBe(true);
  });

  it("does not add the is-borderless class when borderWidth is not 0", () => {
    renderEl({
      type: "rect",
      id: "r1",
      x: 0,
      y: 0,
      pages: "first",
      w: 40,
      h: 20,
      borderWidth: 0.3,
    });
    expect(el().classList.contains("is-borderless")).toBe(false);
  });
});

describe("PaperElement — ellipse", () => {
  it("has the dr-el-ellipse class and border/fill CSS variables", () => {
    renderEl({
      type: "ellipse",
      id: "e1",
      x: 0,
      y: 0,
      pages: "first",
      w: 30,
      h: 20,
      borderWidth: 0.4,
      borderColor: "#123456",
      fillColor: "#abcdef",
    });
    expect(el().classList.contains("dr-el-ellipse")).toBe(true);
    expect(el().style.getPropertyValue("--bw")).toBe("0.4");
    expect(el().style.getPropertyValue("--bc")).toBe("#123456");
    expect(el().style.getPropertyValue("--fc")).toBe("#abcdef");
  });

  it("adds the is-borderless class when borderWidth is 0 (no border)", () => {
    renderEl({
      type: "ellipse",
      id: "e1",
      x: 0,
      y: 0,
      pages: "first",
      w: 30,
      h: 20,
      borderWidth: 0,
    });
    expect(el().classList.contains("is-borderless")).toBe(true);
  });
});

describe("PaperElement — line color and style", () => {
  it("does not emit --lc / --ls without color/style specified", () => {
    renderEl({
      type: "line",
      id: "l1",
      x: 0,
      y: 0,
      pages: "first",
      orientation: "horizontal",
      length: 50,
      thickness: 0.3,
    });
    expect(el().style.getPropertyValue("--lc")).toBe("");
    expect(el().style.getPropertyValue("--ls")).toBe("");
  });

  it("reflects color/style specification into CSS variables", () => {
    renderEl({
      type: "line",
      id: "l1",
      x: 0,
      y: 0,
      pages: "first",
      orientation: "horizontal",
      length: 50,
      thickness: 0.3,
      color: "#ff0000",
      strokeStyle: "dashed",
    });
    expect(el().style.getPropertyValue("--lc")).toBe("#ff0000");
    expect(el().style.getPropertyValue("--ls")).toBe("dashed");
  });
});

describe("PaperElement — text / pageNumber text color", () => {
  it("does not emit --tc without color specified", () => {
    renderEl({
      type: "text",
      id: "t1",
      x: 0,
      y: 0,
      pages: "first",
      w: 40,
      h: 20,
      text: "本文",
      fontSize: 10,
      align: "left",
      lineHeight: 1.25,
    });
    expect(el().style.getPropertyValue("--tc")).toBe("");
  });

  it("reflects text's color into --tc", () => {
    renderEl({
      type: "text",
      id: "t1",
      x: 0,
      y: 0,
      pages: "first",
      w: 40,
      h: 20,
      text: "本文",
      fontSize: 10,
      align: "left",
      lineHeight: 1.25,
      color: "#ff0000",
    });
    expect(el().style.getPropertyValue("--tc")).toBe("#ff0000");
  });

  it("reflects pageNumber's color into --tc", () => {
    renderEl({
      type: "pageNumber",
      id: "p1",
      x: 0,
      y: 0,
      pages: "all",
      w: 40,
      h: 20,
      format: "{n} / {N}",
      fontSize: 10,
      align: "left",
      lineHeight: 1.25,
      color: "#112233",
    });
    expect(el().style.getPropertyValue("--tc")).toBe("#112233");
  });
});

describe("PaperElement — rotate CSS variable", () => {
  it("does not emit --rot without rotate specified", () => {
    renderEl({
      type: "rect",
      id: "r1",
      x: 0,
      y: 0,
      pages: "first",
      w: 40,
      h: 20,
      borderWidth: 0.3,
    });
    expect(el().style.getPropertyValue("--rot")).toBe("");
  });

  it("reflects rotate into --rot with a deg suffix", () => {
    renderEl({
      type: "rect",
      id: "r1",
      x: 0,
      y: 0,
      pages: "first",
      w: 40,
      h: 20,
      borderWidth: 0.3,
      rotate: -30.5,
    });
    expect(el().style.getPropertyValue("--rot")).toBe("-30.5deg");
  });

  it("reflects line's rotate into --rot too", () => {
    renderEl({
      type: "line",
      id: "l1",
      x: 0,
      y: 0,
      pages: "first",
      orientation: "horizontal",
      length: 40,
      thickness: 0.3,
      rotate: 45,
    });
    expect(el().style.getPropertyValue("--rot")).toBe("45deg");
  });
});

describe("PaperElement — table CSS variables", () => {
  function tableEl(overrides: Partial<IrTableElement> = {}): IrTableElement {
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

  it("does not emit CSS variables without border attributes specified", () => {
    renderEl(tableEl());
    expect(el().style.getPropertyValue("--frame-w")).toBe("");
    expect(el().style.getPropertyValue("--grid-w")).toBe("");
    expect(el().style.getPropertyValue("--frame-ls")).toBe("");
    expect(el().style.getPropertyValue("--grid-ls")).toBe("");
  });

  it("reflects frameWidth / gridWidth / frameStyle / gridStyle into CSS variables", () => {
    renderEl(
      tableEl({
        frameWidth: 1,
        gridWidth: 0.5,
        frameStyle: "dashed",
        gridStyle: "dotted",
      }),
    );
    expect(el().style.getPropertyValue("--frame-w")).toBe("1");
    expect(el().style.getPropertyValue("--grid-w")).toBe("0.5");
    expect(el().style.getPropertyValue("--frame-ls")).toBe("dashed");
    expect(el().style.getPropertyValue("--grid-ls")).toBe("dotted");
  });

  it("approximates frameStyle: dashdot as dashed", () => {
    renderEl(tableEl({ frameStyle: "dashdot" }));
    expect(el().style.getPropertyValue("--frame-ls")).toBe("dashed");
  });
});

describe("PaperElement — text / pageNumber rendering with and without font metrics", () => {
  const METRICS: FontMetricsSet = { regular: () => 0.5 };

  it("renders as plain text as before when metrics is not specified", () => {
    renderEl({
      type: "text",
      id: "t1",
      x: 0,
      y: 0,
      pages: "first",
      w: 40,
      h: 20,
      text: "本文",
      fontSize: 10,
      align: "left",
      lineHeight: 1.25,
    });
    expect(el().querySelectorAll(".dr-text-line")).toHaveLength(0);
    expect(el().textContent).toBe("本文");
  });

  it("renders text split into lines via .dr-text-line when metrics is specified", () => {
    renderEl(
      {
        type: "text",
        id: "t1",
        x: 0,
        y: 0,
        pages: "first",
        w: 40,
        h: 20,
        text: "本文",
        fontSize: 10,
        align: "left",
        lineHeight: 1.25,
      },
      METRICS,
    );
    expect(el().querySelectorAll(".dr-text-line")).toHaveLength(1);
    expect(el().textContent).toBe("本文");
  });

  it("renders pageNumber as .dr-text-line > .dr-bind when metrics is specified", () => {
    renderEl(
      {
        type: "pageNumber",
        id: "p1",
        x: 0,
        y: 0,
        pages: "all",
        w: 40,
        h: 20,
        format: "{n} / {N}",
        fontSize: 10,
        align: "left",
        lineHeight: 1.25,
      },
      METRICS,
    );
    const line = el().querySelector(".dr-text-line");
    expect(line?.querySelector(".dr-bind")?.textContent).toBe("{n} / {N}");
  });
});
