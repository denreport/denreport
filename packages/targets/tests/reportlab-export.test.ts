import type { IrData, IrDocument } from "@denreport/core";
import { PT_TO_MM } from "@denreport/core";
import { describe, expect, it } from "vitest";
import { exportReportlab } from "../src/reportlab/export";
import { pyNumber, pyRgb, pyString } from "../src/reportlab/python";
import {
  buildHeadTable,
  buildHheaTable,
  buildSfnt,
  buildUniformWidthTtf,
  syntheticCff,
  syntheticTtf,
} from "./helpers/sfnt";

const FONT = syntheticTtf();
const UNIT_WIDTH_FONT = buildUniformWidthTtf(1, 1);

function widthMmFor(widthPt: number): number {
  return widthPt * PT_TO_MM;
}

function docOf(...elements: IrDocument["elements"]): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { name: "NotoSansJP" },
    elements,
  };
}

describe("python.ts — literal formatting", () => {
  it("escapes backslash, double quote and control characters", () => {
    expect(pyString('a\\b"c')).toBe('"a\\\\b\\"c"');
    expect(pyString("\t\n")).toBe('"\\x09\\x0a"');
  });

  it("passes non-control characters through unescaped, including Japanese", () => {
    expect(pyString("請求書")).toBe('"請求書"');
  });

  it("formats integers, decimals and boundary exponential forms", () => {
    expect(pyNumber(15)).toBe("15");
    expect(pyNumber(0.4)).toBe("0.4");
    expect(pyNumber(1e21)).toBe("1e+21");
    expect(pyNumber(1e-7)).toBe("1e-7");
  });

  it("converts #rrggbb to a 0..1 RGB tuple literal", () => {
    expect(pyRgb("#000000")).toBe("(0, 0, 0)");
    expect(pyRgb("#ffffff")).toBe("(1, 1, 1)");
    expect(pyRgb("#0033ff")).toBe("(0, 0.2, 1)");
  });
});

describe("exportReportlab — mapping rules", () => {
  it("transcribes font name and page size into constants", () => {
    const result = exportReportlab(docOf(), {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain('FONT_NAME = "NotoSansJP"');
    expect(result.code).toContain('FONT_FILE = "NotoSansJP.ttf"');
    expect(result.code).toContain("PAGE_WIDTH = 210 * mm");
    expect(result.code).toContain("PAGE_HEIGHT = 297 * mm");
    expect(result.code).toContain("PAGE_COUNT = 1");
  });

  it("maps text geometry, align and content lines to a _text call", () => {
    const doc = docOf({
      type: "text",
      id: "title",
      x: 10,
      y: 20,
      pages: "first",
      w: 100,
      h: 12,
      text: "{title}",
      fontSize: 22,
      align: "center",
      lineHeight: 1.5,
    });
    const result = exportReportlab(doc, { title: "請求書" }, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      '_text(c, font, 10, 20, 100, 22, "center", 1.5, ["請求書"])',
    );
  });

  it.each([
    ["left", "left"],
    ["center", "center"],
    ["right", "right"],
  ] as const)("maps align %s to the literal %s", (align, expected) => {
    const doc = docOf({
      type: "text",
      id: "label",
      x: 0,
      y: 0,
      pages: "first",
      w: 50,
      h: 10,
      text: "x",
      fontSize: 10,
      align,
      lineHeight: 1.25,
    });
    const result = exportReportlab(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(`"${expected}"`);
  });

  it("splits multi-line content into a Python list of lines", () => {
    const doc = docOf({
      type: "text",
      id: "note",
      x: 0,
      y: 0,
      pages: "first",
      w: 50,
      h: 20,
      text: "{note}",
      fontSize: 10,
      align: "left",
      lineHeight: 1.2,
    });
    const result = exportReportlab(doc, { note: "行1\n行2" }, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain('["行1", "行2"]');
  });

  it("maps horizontal and vertical lines to their endpoint pairs", () => {
    const doc = docOf(
      {
        type: "line",
        id: "h",
        x: 0,
        y: 0,
        pages: "first",
        orientation: "horizontal",
        length: 90,
        thickness: 0.4,
      },
      {
        type: "line",
        id: "v",
        x: 5,
        y: 5,
        pages: "first",
        orientation: "vertical",
        length: 40,
        thickness: 0.5,
      },
    );
    const result = exportReportlab(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      "_line(c, 0, 0, 90, 0, 0.4, (0, 0, 0), None)",
    );
    expect(result.code).toContain(
      "_line(c, 5, 5, 5, 45, 0.5, (0, 0, 0), None)",
    );
  });

  it("maps rect geometry and border width to a _rect call", () => {
    const doc = docOf({
      type: "rect",
      id: "box",
      x: 0,
      y: 0,
      pages: "first",
      w: 89,
      h: 12,
      borderWidth: 0.5,
    });
    const result = exportReportlab(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      "_rect(c, 0, 0, 89, 12, 0.5, (0, 0, 0), None, None, 0)",
    );
  });

  it("maps a dashed, colored, filled, rounded rect to the full _rect argument list", () => {
    const doc = docOf({
      type: "rect",
      id: "box",
      x: 0,
      y: 0,
      pages: "first",
      w: 40,
      h: 20,
      borderWidth: 0.5,
      borderColor: "#0033ff",
      fillColor: "#eeeeee",
      borderStyle: "dashed",
      cornerRadius: 3,
    });
    const result = exportReportlab(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      "_rect(c, 0, 0, 40, 20, 0.5, (0, 0.2, 1), (0.9333333333333333, 0.9333333333333333, 0.9333333333333333), [2 * mm, 1 * mm], 3)",
    );
  });

  it("maps a dotted colored line to a _line call with the dash literal", () => {
    const doc = docOf({
      type: "line",
      id: "ln",
      x: 0,
      y: 0,
      pages: "first",
      orientation: "horizontal",
      length: 10,
      thickness: 0.3,
      color: "#ff0000",
      strokeStyle: "dotted",
    });
    const result = exportReportlab(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      "_line(c, 0, 0, 10, 0, 0.3, (1, 0, 0), [0.4 * mm, 0.8 * mm])",
    );
  });

  it("maps an ellipse to an _ellipse call and includes the _ellipse helper", () => {
    const doc = docOf({
      type: "ellipse",
      id: "el",
      x: 0,
      y: 0,
      pages: "first",
      w: 30,
      h: 20,
      borderWidth: 0.4,
      borderColor: "#123456",
      fillColor: "#abcdef",
    });
    const result = exportReportlab(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain("def _ellipse(c, x, y, w, h,");
    expect(result.code).toContain(
      `_ellipse(c, 0, 0, 30, 20, 0.4, ${pyRgb("#123456")}, ${pyRgb("#abcdef")})`,
    );
  });

  it("omits the _ellipse helper for a document without ellipse elements", () => {
    const result = exportReportlab(docOf(), {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).not.toContain("_ellipse(");
  });

  it("extracts the base64 payload from a data URI for image calls", () => {
    const doc = docOf({
      type: "image",
      id: "logo",
      x: 15,
      y: 15,
      pages: "first",
      w: 20,
      h: 20,
      src: "data:image/png;base64,AAAA",
    });
    const result = exportReportlab(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain('_image(c, 15, 15, 20, 20, "AAAA")');
  });

  it.each([
    ["qrcode", "QR"],
    ["code39", "Standard39"],
    ["code128", "Code128"],
    ["ean13", "EAN13"],
  ] as const)(
    "maps barcode geometry and resolved content to a _barcode call (%s → %s)",
    (symbology, reportlabName) => {
      const doc = docOf({
        type: "barcode",
        id: "bc1",
        x: 15,
        y: 15,
        pages: "first",
        w: 30,
        h: 30,
        symbology,
        value: "{code}",
      });
      const result = exportReportlab(doc, { code: "ABC-123" }, FONT);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected success");
      expect(result.code).toContain(
        `_barcode(c, "${reportlabName}", "ABC-123", 15, 15, 30, 30)`,
      );
    },
  );

  it("keeps the page's statement order equal to the element order", () => {
    const doc = docOf(
      {
        type: "text",
        id: "a",
        x: 0,
        y: 0,
        pages: "first",
        w: 10,
        h: 10,
        text: "a",
        fontSize: 10,
        align: "left",
        lineHeight: 1.25,
      },
      {
        type: "rect",
        id: "b",
        x: 0,
        y: 10,
        pages: "first",
        w: 10,
        h: 10,
        borderWidth: 0.3,
      },
      {
        type: "line",
        id: "c",
        x: 0,
        y: 20,
        pages: "first",
        orientation: "horizontal",
        length: 10,
        thickness: 0.3,
      },
    );
    const result = exportReportlab(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const pageBody = result.code.slice(result.code.indexOf("def _page_1"));
    const textIndex = pageBody.indexOf("_text(c, font,");
    const rectIndex = pageBody.indexOf("_rect(c, 0, 10");
    const lineIndex = pageBody.indexOf("_line(c, 0, 20");
    expect(textIndex).toBeGreaterThan(-1);
    expect(textIndex).toBeLessThan(rectIndex);
    expect(rectIndex).toBeLessThan(lineIndex);
  });

  it("renders an element-less page body as pass", () => {
    const result = exportReportlab(docOf(), {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain("def _page_1(c, font):\n    pass");
  });

  it("emits one _page_N function per page and serializes build() in order", () => {
    const doc = docOf({
      type: "table",
      id: "items",
      x: 15,
      y: 0,
      bind: "items",
      columns: [{ key: "name", label: "品目", width: 90, align: "left" }],
      rowHeight: 10,
      headerHeight: 10,
      fontSize: 10,
      maxY: 100,
      continuationY: 0,
      minRows: 10,
    });
    const data: IrData = { items: [] };
    const result = exportReportlab(doc, data, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain("PAGE_COUNT = 2");
    expect(result.code).toContain("def _page_1(c, font):");
    expect(result.code).toContain("def _page_2(c, font):");
    expect(result.code).not.toContain("def _page_3(c, font):");
    expect(result.code).toContain(
      [
        "def build(output_path):",
        "    font = _register_font()",
        "    c = Canvas(output_path, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))",
        "    _page_1(c, font)",
        "    c.showPage()",
        "    _page_2(c, font)",
        "    c.showPage()",
        "    c.save()",
      ].join("\n"),
    );
  });
});

describe("exportReportlab — conditional output", () => {
  it("omits base64/BytesIO/ImageReader imports, _image and the Pillow requirement without images", () => {
    const doc = docOf({
      type: "rect",
      id: "box",
      x: 0,
      y: 0,
      pages: "first",
      w: 10,
      h: 10,
      borderWidth: 0.3,
    });
    const result = exportReportlab(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).not.toContain("import base64");
    expect(result.code).not.toContain("from io import BytesIO");
    expect(result.code).not.toContain("ImageReader");
    expect(result.code).not.toContain("def _image(");
    expect(result.code).not.toContain("Pillow");
  });

  it("includes base64/BytesIO/ImageReader imports, _image and the Pillow requirement with an image", () => {
    const doc = docOf({
      type: "image",
      id: "logo",
      x: 0,
      y: 0,
      pages: "first",
      w: 10,
      h: 10,
      src: "data:image/png;base64,AAAA",
    });
    const result = exportReportlab(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain("import base64");
    expect(result.code).toContain("from io import BytesIO");
    expect(result.code).toContain(
      "from reportlab.lib.utils import ImageReader",
    );
    expect(result.code).toContain("def _image(");
    expect(result.code).toContain("Pillow");
  });

  it.each([
    ["text", "def _text("],
    ["line", "def _line("],
    ["rect", "def _rect("],
  ] as const)(
    "omits the %s helper when the document has no %s elements",
    (_type, helperSignature) => {
      const doc = docOf({
        type: "image",
        id: "logo",
        x: 0,
        y: 0,
        pages: "first",
        w: 10,
        h: 10,
        src: "data:image/png;base64,AAAA",
      });
      const result = exportReportlab(doc, {}, FONT);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected success");
      expect(result.code).not.toContain(helperSignature);
    },
  );

  it("always includes _register_font", () => {
    const result = exportReportlab(docOf(), {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain("def _register_font():");
  });

  it("omits the createBarcodeDrawing import and _barcode without a barcode element", () => {
    const result = exportReportlab(docOf(), {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).not.toContain("createBarcodeDrawing");
    expect(result.code).not.toContain("def _barcode(");
  });

  it("includes the createBarcodeDrawing import and _barcode with a barcode element", () => {
    const doc = docOf({
      type: "barcode",
      id: "bc1",
      x: 0,
      y: 0,
      pages: "first",
      w: 30,
      h: 30,
      symbology: "qrcode",
      value: "abc",
    });
    const result = exportReportlab(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      "from reportlab.graphics.barcode import createBarcodeDrawing",
    );
    expect(result.code).toContain("def _barcode(");
  });
});

describe("exportReportlab — font handling", () => {
  it("transcribes the font's ascent-per-em into FONT_ASCENT_EM", () => {
    const result = exportReportlab(docOf(), {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain("FONT_ASCENT_EM = 0.8");
  });

  it("computes text baselines from FONT_ASCENT_EM with half-leading", () => {
    const doc = docOf({
      type: "text",
      id: "title",
      x: 0,
      y: 0,
      pages: "first",
      w: 50,
      h: 10,
      text: "x",
      fontSize: 10,
      align: "left",
      lineHeight: 1.25,
    });
    const result = exportReportlab(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      "baseline = PAGE_HEIGHT - y * mm - (FONT_ASCENT_EM + (line_height - 1) / 2 + i * line_height) * size",
    );
    expect(result.code).not.toContain("getAscentDescent");
  });

  it("rejects a TTF whose head/hhea metrics cannot be read", () => {
    const noMetrics = buildSfnt(0x00010000, ["glyf", "head", "loca"]);
    const result = exportReportlab(docOf(), {}, noMetrics);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.fontIssues).toHaveLength(1);
    expect(result.fontIssues[0]?.format).toBe("ttf");
    expect(result.fontIssues[0]?.message).toContain("計量");
  });

  it("rejects a TTF whose cmap/hmtx metrics cannot be read", () => {
    const noWidths = buildSfnt(0x00010000, [
      "glyf",
      { tag: "head", data: buildHeadTable(1000) },
      { tag: "hhea", data: buildHheaTable(800, 1) },
      "loca",
    ]);
    const result = exportReportlab(docOf(), {}, noWidths);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.fontIssues).toHaveLength(1);
    expect(result.fontIssues[0]?.format).toBe("ttf");
    expect(result.fontIssues[0]?.message).toContain("字幅");
  });

  it("returns the font file named after the logical font name, bytes untouched", () => {
    const result = exportReportlab(docOf(), {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.fontFile.filename).toBe("NotoSansJP.ttf");
    expect(result.fontFile.data).toBe(FONT);
  });

  it("registers the font relative to the script location and exits when missing", () => {
    const result = exportReportlab(docOf(), {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      "os.path.join(os.path.dirname(os.path.abspath(__file__)), FONT_FILE)",
    );
    expect(result.code).toContain("if not os.path.exists(font_path):");
    expect(result.code).toContain("sys.exit(");
  });

  it("emits no CID fallback", () => {
    const result = exportReportlab(docOf(), {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).not.toContain("UnicodeCIDFont");
    expect(result.code).not.toContain("FALLBACK_CID_FONT");
  });

  it("rejects a CFF font before generating anything", () => {
    const result = exportReportlab(docOf(), {}, syntheticCff());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors).toEqual([]);
    expect(result.fontIssues).toHaveLength(1);
    expect(result.fontIssues[0]?.format).toBe("cff");
    expect("code" in result).toBe(false);
    expect("fontFile" in result).toBe(false);
  });

  it.each([
    ["collection", buildSfnt("ttcf", [])],
    ["woff", buildSfnt("wOFF", [])],
    ["unknown", new Uint8Array(64).fill(0xff)],
  ] as const)("rejects a %s input the same way", (format, data) => {
    const result = exportReportlab(docOf(), {}, data);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.fontIssues).toHaveLength(1);
    expect(result.fontIssues[0]?.format).toBe(format);
  });

  it("reports C-group errors and font issues together", () => {
    const doc = docOf({
      type: "text",
      id: "title",
      x: 0,
      y: 0,
      pages: "first",
      w: 50,
      h: 10,
      text: "{title}",
      fontSize: 10,
      align: "left",
      lineHeight: 1.25,
    });
    const result = exportReportlab(doc, { title: 123 }, syntheticCff());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors).toEqual([
      { rule: "C01", path: "elements[0].text", message: expect.any(String) },
    ]);
    expect(result.fontIssues).toHaveLength(1);
    expect(result.fontIssues[0]?.format).toBe("cff");
  });
});

describe("exportReportlab — warnings passthrough", () => {
  it("succeeds with a missing bind key, filling the content with an empty string and reporting a warning", () => {
    const doc = docOf({
      type: "text",
      id: "title",
      x: 0,
      y: 0,
      pages: "first",
      w: 50,
      h: 10,
      text: "{title}",
      fontSize: 10,
      align: "left",
      lineHeight: 1.25,
    });
    const result = exportReportlab(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.warnings).toEqual([
      { rule: "C01", path: "elements[0].text", message: expect.any(String) },
    ]);
    expect(result.code).toContain(
      '_text(c, font, 0, 0, 50, 10, "left", 1.25, [""])',
    );
  });

  it("passes an empty warnings array through when nothing is missing", () => {
    const result = exportReportlab(docOf(), {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.warnings).toEqual([]);
  });
});

describe("exportReportlab — determinism", () => {
  it("produces byte-identical output across repeated calls, LF-only with a single trailing newline", () => {
    const doc = docOf(
      {
        type: "text",
        id: "title",
        x: 0,
        y: 18,
        pages: "first",
        w: 210,
        h: 12,
        text: "請求書",
        fontSize: 22,
        align: "center",
        lineHeight: 1.25,
      },
      {
        type: "image",
        id: "logo",
        x: 15,
        y: 15,
        pages: "first",
        w: 20,
        h: 20,
        src: "data:image/png;base64,AAAA",
      },
    );
    const first = exportReportlab(doc, {}, FONT);
    const second = exportReportlab(doc, {}, FONT);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error("expected success");
    expect(first.code).toBe(second.code);
    expect(first.code.includes("\r")).toBe(false);
    expect(first.code.endsWith("\n")).toBe(true);
    expect(first.code.endsWith("\n\n")).toBe(false);
  });
});

describe("exportReportlab — error passthrough", () => {
  it("returns the C-group IrError array unchanged when lowering fails", () => {
    const doc = docOf({
      type: "text",
      id: "title",
      x: 0,
      y: 0,
      pages: "first",
      w: 50,
      h: 10,
      text: "{title}",
      fontSize: 10,
      align: "left",
      lineHeight: 1.25,
    });
    const result = exportReportlab(doc, { title: 123 }, FONT);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors).toEqual([
      { rule: "C01", path: "elements[0].text", message: expect.any(String) },
    ]);
    expect(result.fontIssues).toEqual([]);
  });
});

describe("exportReportlab — text wrapping and justify", () => {
  function textDoc(
    text: string,
    w: number,
    align: "left" | "center" | "right" | "justify",
  ): IrDocument {
    return docOf({
      type: "text",
      id: "t1",
      x: 10,
      y: 20,
      pages: "first",
      w,
      h: 20,
      text,
      fontSize: 1,
      align,
      lineHeight: 1.25,
    });
  }

  it("pre-wraps text into a line-literal list, one string per wrapped line", () => {
    const w = widthMmFor(3.2);
    const doc = textDoc("abcdef", w, "left");
    const result = exportReportlab(doc, {}, UNIT_WIDTH_FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      `_text(c, font, 10, 20, ${w}, 1, "left", 1.25, ["abc", "def"])`,
    );
  });

  it('passes align through as "justify" and lets the generated _text compute char spacing at runtime', () => {
    const w = widthMmFor(3.5);
    const doc = textDoc("abcdef", w, "justify");
    const result = exportReportlab(doc, {}, UNIT_WIDTH_FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      `_text(c, font, 10, 20, ${w}, 1, "justify", 1.25, ["abc", "def"])`,
    );
  });
});
