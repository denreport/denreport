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
  family: "dr-embedded-notosansjp",
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
  it("viewBox becomes the paper's mm dimensions", () => {
    render([]);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(
      "0 0 210 297",
    );
  });

  it("text becomes one <text> per line, and y matches the baseline formula", () => {
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

  it("bold elements render with the bold slot's family/metrics, and fall back to regular when the slot is undefined", () => {
    const boldFont: PreviewFont = {
      family: "dr-embedded-notosansjp-bold",
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

  it("underlined text has text-decoration underline, and non-underlined text does not", () => {
    render([textEl({ underline: true }), textEl({ underline: false })]);
    const texts = [...container.querySelectorAll("text")];
    expect(texts[0]?.getAttribute("text-decoration")).toBe("underline");
    expect(texts[1]?.getAttribute("text-decoration")).toBeNull();
  });

  it("text color maps to fill", () => {
    const el = textEl({ color: "#ff0000" });
    render([el]);
    const text = container.querySelector("text");
    expect((text as Element).getAttribute("fill")).toBe("#ff0000");
  });

  it("the 4 align values map to x and text-anchor", () => {
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

  it("content exceeding the width wraps via layoutTextLines into multiple <text> elements", () => {
    const el = textEl({ content: "abcdef", w: widthMmFor(3.2), fontSize: 10 });
    render([el]);
    const texts = [...container.querySelectorAll("text")];
    expect(texts.map((t) => t.textContent)).toEqual(["abc", "def"]);
    expect(texts.every((t) => t.getAttribute("letter-spacing") === null)).toBe(
      true,
    );
  });

  it("justified lines have a letter-spacing attribute (converted to mm)", () => {
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

  it("line orientation and length map to the endpoints, and thickness maps to stroke-width", () => {
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

  it("rect renders as an unfilled border", () => {
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

  it("rect reflects fill color, stroke color, and corner radius", () => {
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

  it("non-solid line/rect strokes map to strokeDasharray", () => {
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

  it("ellipse maps to cx/cy/rx/ry and fill/stroke color", () => {
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

  it("image stretches to fill its area", () => {
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

  it("renders even when font is null, without a font-family attribute", () => {
    render([textEl()], null);
    const text = container.querySelector("text");
    expect(text).not.toBeNull();
    expect((text as Element).getAttribute("font-family")).toBeNull();
    expect(Number.isFinite(attrOf(text as Element, "y"))).toBe(true);
  });

  it("does not add a transform to <g> when rotate is 0", () => {
    render([textEl()]);
    const g = container.querySelector("svg > g");
    expect((g as Element).getAttribute("transform")).toBeNull();
  });

  it("rotate maps to <g> as rotate(θ cx cy) around the bounding box center", () => {
    render([textEl({ x: 10, y: 50, w: 100, h: 20, rotate: 45 })]);
    const g = container.querySelector("svg > g");
    expect((g as Element).getAttribute("transform")).toBe("rotate(45 60 60)");
  });

  it("line rotate is around the segment's midpoint", () => {
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

  it("barcode (qrcode) renders the frame, finder pattern, and resolved content string", () => {
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

  it("barcode (1D symbology) renders vertical bars", () => {
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
