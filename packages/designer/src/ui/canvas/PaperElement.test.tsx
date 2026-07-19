import type { IrElement } from "@denreport/core";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PlacedElementView } from "../../state/geometry";
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

function renderEl(element: IrElement): void {
  act(() => {
    root.render(
      <PaperElement view={viewOf(element)} context="first" dragging={false} />,
    );
  });
}

function el(): HTMLElement {
  const node = container.querySelector(".apx-el");
  if (node === null) throw new Error(".apx-el がない");
  return node as HTMLElement;
}

describe("PaperElement — rect の CSS 変数", () => {
  it("スタイル属性なしでは色・塗り・角丸の CSS 変数を出さない", () => {
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

  it("枠線色・塗り色・角丸・線種が CSS 変数に写る", () => {
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

  it("dashdot / dashdotdot は dashed に近似する", () => {
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

  it("borderWidth 0（枠なし）では is-borderless クラスを付ける", () => {
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

  it("borderWidth 0 でなければ is-borderless クラスを付けない", () => {
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
  it("apx-el-ellipse クラスと枠線・塗りの CSS 変数を持つ", () => {
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
    expect(el().classList.contains("apx-el-ellipse")).toBe(true);
    expect(el().style.getPropertyValue("--bw")).toBe("0.4");
    expect(el().style.getPropertyValue("--bc")).toBe("#123456");
    expect(el().style.getPropertyValue("--fc")).toBe("#abcdef");
  });

  it("borderWidth 0（枠なし）では is-borderless クラスを付ける", () => {
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

describe("PaperElement — line の色・線種", () => {
  it("色・線種の指定なしでは --lc / --ls を出さない", () => {
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

  it("色・線種の指定が CSS 変数に写る", () => {
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

describe("PaperElement — text / pageNumber の文字色", () => {
  it("color の指定なしでは --tc を出さない", () => {
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

  it("text の color が --tc に写る", () => {
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

  it("pageNumber の color が --tc に写る", () => {
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

describe("PaperElement — rotate の CSS 変数", () => {
  it("rotate 指定なしでは --rot を出さない", () => {
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

  it("rotate が deg 付きで --rot に写る", () => {
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

  it("line の rotate も --rot に写る", () => {
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
