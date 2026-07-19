import type {
  IrPage,
  LoweredElement,
  LoweredTextElement,
} from "@denreport/core";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PT_TO_MM, textBaselinesMm } from "../../state/preview";
import { PreviewPage } from "./PreviewPage";
import type { PreviewFont, PreviewFontSet } from "./preview-font";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const PAGE: IrPage = { width: 210, height: 297 };
const FONT: PreviewFont = {
  family: "apx-embedded-notosansjp",
  ascentPerEm: 1.16,
  charWidths: () => 0.1,
};

function widthMmFor(widthPt: number): number {
  return widthPt * PT_TO_MM;
}

function textEl(
  overrides: Partial<LoweredTextElement> = {},
): LoweredTextElement {
  return {
    type: "text",
    sourceId: "t1",
    x: 10,
    y: 50,
    w: 100,
    h: 20,
    content: "甲",
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
    color: "#000000",
    fontWeight: "normal",
    fontStyle: "normal",
    underline: false,
    rotate: 0,
    ...overrides,
  } as LoweredTextElement;
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

function render(
  elements: readonly LoweredElement[],
  fonts: PreviewFontSet | null = { regular: FONT },
): void {
  act(() => {
    root.render(<PreviewPage elements={elements} page={PAGE} fonts={fonts} />);
  });
}

function attrOf(el: Element, name: string): number {
  return Number.parseFloat(el.getAttribute(name) ?? "NaN");
}

describe("PreviewPage", () => {
  it("viewBox が用紙の mm 寸法になる", () => {
    render([]);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(
      "0 0 210 297",
    );
  });

  it("text は行ごとの <text> になり、y は規範ベースライン式と一致する", () => {
    const el = textEl({ content: "甲\n乙" });
    render([el]);
    const texts = [...container.querySelectorAll("text")];
    const expected = textBaselinesMm(el, FONT.ascentPerEm, ["甲", "乙"]);
    expect(texts).toHaveLength(2);
    expect(texts.map((t) => t.textContent)).toEqual(["甲", "乙"]);
    expect(attrOf(texts[0] as Element, "y")).toBeCloseTo(
      expected[0]?.baselineY ?? Number.NaN,
      6,
    );
    expect(attrOf(texts[1] as Element, "y")).toBeCloseTo(
      expected[1]?.baselineY ?? Number.NaN,
      6,
    );
    expect(attrOf(texts[0] as Element, "font-size")).toBeCloseTo(
      10 * PT_TO_MM,
      6,
    );
    expect((texts[0] as Element).getAttribute("font-family")).toBe(FONT.family);
  });

  it("bold 要素は bold スロットの family / 計量で描画し、未定義スロットは regular に劣化する", () => {
    const boldFont: PreviewFont = {
      family: "apx-embedded-notosansjp-bold",
      ascentPerEm: 0.9,
      charWidths: () => 0.2,
    };
    const el = textEl({ fontWeight: "bold" });
    render([el], { regular: FONT, bold: boldFont });
    const text = container.querySelector("text");
    expect((text as Element).getAttribute("font-family")).toBe(boldFont.family);
    const expected = textBaselinesMm(el, boldFont.ascentPerEm, ["甲"]);
    expect(attrOf(text as Element, "y")).toBeCloseTo(
      expected[0]?.baselineY ?? Number.NaN,
      6,
    );

    render([textEl({ fontStyle: "italic" })], {
      regular: FONT,
      bold: boldFont,
    });
    const italicFallback = container.querySelector("text");
    expect((italicFallback as Element).getAttribute("font-family")).toBe(
      FONT.family,
    );
  });

  it("underline の text は text-decoration underline を持ち、非下線は持たない", () => {
    render([textEl({ underline: true }), textEl({ underline: false })]);
    const texts = [...container.querySelectorAll("text")];
    expect(texts[0]?.getAttribute("text-decoration")).toBe("underline");
    expect(texts[1]?.getAttribute("text-decoration")).toBeNull();
  });

  it("text の color が fill に写る", () => {
    const el = textEl({ color: "#ff0000" });
    render([el]);
    const text = container.querySelector("text");
    expect((text as Element).getAttribute("fill")).toBe("#ff0000");
  });

  it("align 4値が x と text-anchor に写像される", () => {
    render([
      textEl({ align: "left" }),
      textEl({ align: "center" }),
      textEl({ align: "right" }),
      textEl({ align: "justify" }),
    ]);
    const texts = [...container.querySelectorAll("text")];
    expect(texts.map((t) => t.getAttribute("text-anchor"))).toEqual([
      "start",
      "middle",
      "end",
      "start",
    ]);
    expect(texts.map((t) => attrOf(t, "x"))).toEqual([10, 60, 110, 10]);
  });

  it("幅を超える content は layoutTextLines で折り返され、複数の <text> になる", () => {
    const el = textEl({ content: "abcdef", w: widthMmFor(3.2), fontSize: 10 });
    render([el]);
    const texts = [...container.querySelectorAll("text")];
    expect(texts.map((t) => t.textContent)).toEqual(["abc", "def"]);
    expect(texts.every((t) => t.getAttribute("letter-spacing") === null)).toBe(
      true,
    );
  });

  it("justify の行は letter-spacing 属性（mm 換算）を持つ", () => {
    const el = textEl({
      content: "abcdef",
      w: widthMmFor(3.5),
      fontSize: 10,
      align: "justify",
    });
    render([el]);
    const texts = [...container.querySelectorAll("text")];
    expect(texts.map((t) => t.textContent)).toEqual(["abc", "def"]);
    const expectedCharSpacePt = (3.5 - 3) / (3 - 1);
    for (const text of texts) {
      expect(attrOf(text, "letter-spacing")).toBeCloseTo(
        expectedCharSpacePt * PT_TO_MM,
        6,
      );
    }
  });

  it("line は向きと長さが端点に、thickness が stroke-width に写る", () => {
    render([
      {
        type: "line",
        sourceId: "l1",
        x: 10,
        y: 20,
        orientation: "horizontal",
        length: 50,
        thickness: 0.3,
        color: "#000000",
        strokeStyle: "solid",
        rotate: 0,
      },
      {
        type: "line",
        sourceId: "l2",
        x: 30,
        y: 40,
        orientation: "vertical",
        length: 25,
        thickness: 0.5,
        color: "#000000",
        strokeStyle: "solid",
        rotate: 0,
      },
    ]);
    const lines = [...container.querySelectorAll("line")];
    expect(lines).toHaveLength(2);
    const [h, v] = lines;
    expect([attrOf(h as Element, "x1"), attrOf(h as Element, "y1")]).toEqual([
      10, 20,
    ]);
    expect([attrOf(h as Element, "x2"), attrOf(h as Element, "y2")]).toEqual([
      60, 20,
    ]);
    expect(attrOf(h as Element, "stroke-width")).toBeCloseTo(0.3, 6);
    expect([attrOf(v as Element, "x2"), attrOf(v as Element, "y2")]).toEqual([
      30, 65,
    ]);
    expect(attrOf(v as Element, "stroke-width")).toBeCloseTo(0.5, 6);
  });

  it("rect は塗りなしの枠線として写る", () => {
    render([
      {
        type: "rect",
        sourceId: "r1",
        x: 10,
        y: 40,
        w: 190,
        h: 30,
        borderWidth: 0.4,
        borderColor: "#000000",
        fillColor: null,
        borderStyle: "solid",
        cornerRadius: 0,
        rotate: 0,
      },
    ]);
    const rect = container.querySelector("rect");
    expect(rect).not.toBeNull();
    expect(attrOf(rect as Element, "x")).toBe(10);
    expect(attrOf(rect as Element, "y")).toBe(40);
    expect(attrOf(rect as Element, "width")).toBe(190);
    expect(attrOf(rect as Element, "height")).toBe(30);
    expect((rect as Element).getAttribute("fill")).toBe("none");
    expect(attrOf(rect as Element, "stroke-width")).toBeCloseTo(0.4, 6);
  });

  it("rect は塗り色・線色・角丸半径が反映される", () => {
    render([
      {
        type: "rect",
        sourceId: "r1",
        x: 10,
        y: 40,
        w: 190,
        h: 30,
        borderWidth: 0.4,
        borderColor: "#112233",
        fillColor: "#eeeeee",
        borderStyle: "solid",
        cornerRadius: 3,
        rotate: 0,
      },
    ]);
    const rect = container.querySelector("rect");
    expect((rect as Element).getAttribute("fill")).toBe("#eeeeee");
    expect((rect as Element).getAttribute("stroke")).toBe("#112233");
    expect(attrOf(rect as Element, "rx")).toBe(3);
  });

  it("line・rect の非実線が strokeDasharray に写る", () => {
    render([
      {
        type: "line",
        sourceId: "l1",
        x: 0,
        y: 0,
        orientation: "horizontal",
        length: 50,
        thickness: 0.3,
        color: "#000000",
        strokeStyle: "dashed",
        rotate: 0,
      },
    ]);
    const line = container.querySelector("line");
    expect((line as Element).getAttribute("stroke-dasharray")).toBe("2 1");
  });

  it("ellipse が cx/cy/rx/ry と塗り・線色に写る", () => {
    render([
      {
        type: "ellipse",
        sourceId: "e1",
        x: 10,
        y: 20,
        w: 40,
        h: 20,
        borderWidth: 0.4,
        borderColor: "#123456",
        fillColor: "#abcdef",
        rotate: 0,
      },
    ]);
    const ellipse = container.querySelector("ellipse");
    expect(ellipse).not.toBeNull();
    expect(attrOf(ellipse as Element, "cx")).toBe(30);
    expect(attrOf(ellipse as Element, "cy")).toBe(30);
    expect(attrOf(ellipse as Element, "rx")).toBe(20);
    expect(attrOf(ellipse as Element, "ry")).toBe(10);
    expect((ellipse as Element).getAttribute("fill")).toBe("#abcdef");
    expect((ellipse as Element).getAttribute("stroke")).toBe("#123456");
  });

  it("image は領域いっぱいに引き伸ばして写る", () => {
    const src = "data:image/png;base64,iVBORw0KGgo=";
    render([
      {
        type: "image",
        sourceId: "i1",
        x: 170,
        y: 10,
        w: 30,
        h: 12,
        src,
        rotate: 0,
      },
    ]);
    const image = container.querySelector("image");
    expect(image).not.toBeNull();
    expect((image as Element).getAttribute("href")).toBe(src);
    expect(attrOf(image as Element, "width")).toBe(30);
    expect(attrOf(image as Element, "height")).toBe(12);
    expect((image as Element).getAttribute("preserveAspectRatio")).toBe("none");
  });

  it("font が null でも描画され、font-family は付かない", () => {
    render([textEl()], null);
    const text = container.querySelector("text");
    expect(text).not.toBeNull();
    expect((text as Element).getAttribute("font-family")).toBeNull();
    expect(Number.isFinite(attrOf(text as Element, "y"))).toBe(true);
  });

  it("rotate 0 では <g> に transform を付けない", () => {
    render([textEl()]);
    const g = container.querySelector("svg > g");
    expect((g as Element).getAttribute("transform")).toBeNull();
  });

  it("rotate が外接箱中心周りの rotate(θ cx cy) として <g> に写る", () => {
    render([textEl({ x: 10, y: 50, w: 100, h: 20, rotate: 45 })]);
    const g = container.querySelector("svg > g");
    expect((g as Element).getAttribute("transform")).toBe("rotate(45 60 60)");
  });

  it("line の rotate は線分中点周りになる", () => {
    render([
      {
        type: "line",
        sourceId: "l1",
        x: 10,
        y: 20,
        orientation: "horizontal",
        length: 50,
        thickness: 0.3,
        color: "#000000",
        strokeStyle: "solid",
        rotate: 90,
      },
    ]);
    const g = container.querySelector("svg > g");
    expect((g as Element).getAttribute("transform")).toBe("rotate(90 35 20)");
  });

  it("barcode（qrcode）は枠・ファインダーパターン・解決済み content の文字列を描画する", () => {
    render([
      {
        type: "barcode",
        sourceId: "bc1",
        x: 15,
        y: 15,
        w: 30,
        h: 30,
        symbology: "qrcode",
        content: "ABC-123",
        rotate: 0,
      },
    ]);
    const rects = [...container.querySelectorAll("rect")];
    expect(rects.length).toBeGreaterThan(0);
    const text = container.querySelector("text");
    expect(text?.textContent).toBe("ABC-123");
  });

  it("barcode（1D 規格）は縦縞のバーを描画する", () => {
    render([
      {
        type: "barcode",
        sourceId: "bc1",
        x: 0,
        y: 0,
        w: 30,
        h: 30,
        symbology: "code128",
        content: "ABC-123",
        rotate: 0,
      },
    ]);
    const rects = [...container.querySelectorAll("rect")];
    expect(rects.length).toBeGreaterThan(1);
  });
});
