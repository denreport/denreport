import { readFileSync } from "node:fs";
import type { IrData, IrDocument } from "@denreport/core";
import { PT_TO_MM } from "@denreport/core";
import { describe, expect, it } from "vitest";
import { EMBEDDED_FONT_URL } from "../src/fonts/embedded";
import { exportPdfme } from "../src/pdfme/export";
import type {
  PdfmeBarcodeSchema,
  PdfmeEllipseSchema,
  PdfmeImageSchema,
  PdfmeLineSchema,
  PdfmeRectangleSchema,
  PdfmeTextSchema,
} from "../src/pdfme/types";
import { generatePdfmePdf } from "./helpers/pdfme-generate";
import {
  buildHeadTable,
  buildSfnt,
  buildUniformWidthTtf,
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

describe("exportPdfme — mapping rules", () => {
  it("maps the page to a blank basePdf with zero padding", () => {
    const doc = docOf();
    const result = exportPdfme(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.template.basePdf).toEqual({
      width: 210,
      height: 297,
      padding: [0, 0, 0, 0],
    });
  });

  it("maps text geometry, style and content via inputs", () => {
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
    const result = exportPdfme(doc, { title: "請求書" }, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const schema = result.template.schemas[0]?.[0] as PdfmeTextSchema;
    expect(schema).toMatchObject({
      type: "text",
      position: { x: 10, y: 20 },
      width: 100,
      height: 12,
      fontSize: 22,
      fontName: "NotoSansJP",
      alignment: "center",
      verticalAlignment: "top",
      lineHeight: 1.5,
    });
    expect("content" in schema).toBe(false);
    expect("readOnly" in schema).toBe(false);
    expect(result.inputs[0][schema.name]).toBe("請求書");
  });

  it("expands {key} tokens in text.text into the inputs value", () => {
    const doc = docOf({
      type: "text",
      id: "total",
      x: 0,
      y: 0,
      pages: "first",
      w: 50,
      h: 10,
      text: "合計: {total} 円",
      fontSize: 10,
      align: "left",
      lineHeight: 1.25,
    });
    const result = exportPdfme(doc, { total: "12,000" }, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const schema = result.template.schemas[0]?.[0] as PdfmeTextSchema;
    expect(result.inputs[0][schema.name]).toBe("合計: 12,000 円");
  });

  it("swaps width/height for horizontal vs vertical lines", () => {
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
    const result = exportPdfme(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const [h, v] = result.template.schemas[0] as [
      PdfmeLineSchema,
      PdfmeLineSchema,
    ];
    expect(h).toMatchObject({ width: 90, height: 0.4, color: "#000000" });
    expect(v).toMatchObject({ width: 0.5, height: 40, color: "#000000" });
  });

  it("maps an explicit line color through", () => {
    const doc = docOf({
      type: "line",
      id: "h",
      x: 0,
      y: 0,
      pages: "first",
      orientation: "horizontal",
      length: 10,
      thickness: 0.4,
      color: "#ff0000",
    });
    const result = exportPdfme(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const schema = result.template.schemas[0]?.[0] as PdfmeLineSchema;
    expect(schema.color).toBe("#ff0000");
  });

  it("maps rect to a borderless-fill rectangle schema", () => {
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
    const result = exportPdfme(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const schema = result.template.schemas[0]?.[0] as PdfmeRectangleSchema;
    expect(schema).toMatchObject({
      type: "rectangle",
      width: 89,
      height: 12,
      borderWidth: 0.5,
      borderColor: "#000000",
      color: "",
    });
    expect(schema).not.toHaveProperty("radius");
  });

  it("maps rect borderColor/fillColor and omits radius when cornerRadius is 0", () => {
    const doc = docOf({
      type: "rect",
      id: "box",
      x: 0,
      y: 0,
      pages: "first",
      w: 89,
      h: 12,
      borderWidth: 0.5,
      borderColor: "#112233",
      fillColor: "#eeeeee",
    });
    const result = exportPdfme(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const schema = result.template.schemas[0]?.[0] as PdfmeRectangleSchema;
    expect(schema).toMatchObject({
      borderColor: "#112233",
      color: "#eeeeee",
    });
    expect(schema).not.toHaveProperty("radius");
  });

  it("includes radius only when cornerRadius is greater than 0", () => {
    const doc = docOf({
      type: "rect",
      id: "box",
      x: 0,
      y: 0,
      pages: "first",
      w: 89,
      h: 12,
      borderWidth: 0.5,
      cornerRadius: 4,
    });
    const result = exportPdfme(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const schema = result.template.schemas[0]?.[0] as PdfmeRectangleSchema;
    expect(schema.radius).toBe(4);
  });

  it("maps ellipse geometry, border and fill to an ellipse schema", () => {
    const doc = docOf({
      type: "ellipse",
      id: "el",
      x: 10,
      y: 10,
      pages: "first",
      w: 30,
      h: 20,
      borderWidth: 0.4,
      borderColor: "#123456",
      fillColor: "#abcdef",
    });
    const result = exportPdfme(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const schema = result.template.schemas[0]?.[0] as PdfmeEllipseSchema;
    expect(schema).toMatchObject({
      type: "ellipse",
      position: { x: 10, y: 10 },
      width: 30,
      height: 20,
      borderWidth: 0.4,
      borderColor: "#123456",
      color: "#abcdef",
    });
  });

  it("expands a non-solid line into multiple uniquely-named solid line schemas", () => {
    const doc = docOf({
      type: "line",
      id: "dashed",
      x: 0,
      y: 0,
      pages: "first",
      orientation: "horizontal",
      length: 7,
      thickness: 0.3,
      strokeStyle: "dashed",
    });
    const result = exportPdfme(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const schemas = result.template.schemas[0] ?? [];
    expect(schemas.length).toBeGreaterThan(1);
    expect(schemas.every((s) => s.type === "line")).toBe(true);
    const names = schemas.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("maps image geometry and passes src via inputs", () => {
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
    const result = exportPdfme(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const schema = result.template.schemas[0]?.[0] as PdfmeImageSchema;
    expect(schema).toMatchObject({ type: "image", width: 20, height: 20 });
    expect("content" in schema).toBe(false);
    expect(result.inputs[0][schema.name]).toBe("data:image/png;base64,AAAA");
  });

  it("maps barcode geometry/symbology to the schema type and passes the resolved value via inputs", () => {
    const doc = docOf({
      type: "barcode",
      id: "bc1",
      x: 15,
      y: 15,
      pages: "first",
      w: 30,
      h: 30,
      symbology: "qrcode",
      value: "{code}",
    });
    const result = exportPdfme(doc, { code: "ABC-123" }, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const schema = result.template.schemas[0]?.[0] as PdfmeBarcodeSchema;
    expect(schema).toMatchObject({
      type: "qrcode",
      position: { x: 15, y: 15 },
      width: 30,
      height: 30,
      backgroundColor: "#ffffff",
      barColor: "#000000",
    });
    expect("includetext" in schema).toBe(false);
    expect(result.inputs[0][schema.name]).toBe("ABC-123");
  });

  it("sets includetext only for ean13", () => {
    const doc = docOf({
      type: "barcode",
      id: "bc1",
      x: 0,
      y: 0,
      pages: "first",
      w: 30,
      h: 30,
      symbology: "ean13",
      value: "4912345678904",
    });
    const result = exportPdfme(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const schema = result.template.schemas[0]?.[0] as PdfmeBarcodeSchema;
    expect(schema.includetext).toBe(true);
  });
});

describe("exportPdfme — inputs consistency", () => {
  it("makes the text/image schema name set equal the inputs key set", () => {
    const doc = docOf(
      {
        type: "text",
        id: "label",
        x: 0,
        y: 0,
        pages: "first",
        w: 50,
        h: 10,
        text: "合計",
        fontSize: 10,
        align: "left",
        lineHeight: 1.25,
      },
      {
        type: "line",
        id: "ln",
        x: 0,
        y: 20,
        pages: "first",
        orientation: "horizontal",
        length: 50,
        thickness: 0.3,
      },
      {
        type: "rect",
        id: "rc",
        x: 0,
        y: 30,
        pages: "first",
        w: 30,
        h: 10,
        borderWidth: 0.3,
      },
      {
        type: "image",
        id: "im",
        x: 0,
        y: 40,
        pages: "first",
        w: 10,
        h: 10,
        src: "data:image/png;base64,AAAA",
      },
    );
    const result = exportPdfme(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const names = (result.template.schemas[0] ?? []).map((s) => s.name);
    const textAndImageNames = (result.template.schemas[0] ?? [])
      .filter((s) => s.type === "text" || s.type === "image")
      .map((s) => s.name);
    expect(names).toHaveLength(4);
    expect(Object.keys(result.inputs[0]).sort()).toEqual(
      [...textAndImageNames].sort(),
    );
  });
});

describe("exportPdfme — schema naming", () => {
  it("names schemas p{page}_{sourceId}_{seq} and keeps names unique per template", () => {
    const doc = docOf({
      type: "table",
      id: "items",
      x: 15,
      y: 0,
      bind: "items",
      columns: [{ key: "name", label: "品目", width: 90, align: "left" }],
      rowHeight: 9,
      headerHeight: 9,
      fontSize: 10,
      maxY: 100,
      continuationY: 0,
      minRows: 0,
    });
    const data: IrData = { items: [{ name: "a" }, { name: "b" }] };
    const result = exportPdfme(doc, data, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const names = (result.template.schemas[0] ?? []).map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/^p1_items_\d+$/);
    }
  });

  it("gives distinct names per page to a pages: all element", () => {
    const doc = docOf(
      {
        type: "pageNumber",
        id: "pageNo",
        x: 0,
        y: 285,
        pages: "all",
        w: 210,
        h: 6,
        format: "{n} / {N}",
        fontSize: 9,
        align: "center",
        lineHeight: 1.25,
      },
      {
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
      },
    );
    const result = exportPdfme(doc, { items: [] }, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.template.schemas).toHaveLength(2);
    const page1Name = result.template.schemas[0]?.find((s) =>
      s.name.startsWith("p1_pageNo_"),
    )?.name;
    const page2Name = result.template.schemas[1]?.find((s) =>
      s.name.startsWith("p2_pageNo_"),
    )?.name;
    expect(page1Name).toBeDefined();
    expect(page2Name).toBeDefined();
    expect(page1Name).not.toBe(page2Name);
    expect(result.inputs[0][page1Name as string]).toBe("1 / 2");
    expect(result.inputs[0][page2Name as string]).toBe("2 / 2");
  });
});

describe("exportPdfme — error passthrough", () => {
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
    const result = exportPdfme(doc, { title: 123 }, FONT);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors).toEqual([
      { rule: "C01", path: "elements[0].text", message: expect.any(String) },
    ]);
  });
});

describe("exportPdfme — warnings passthrough", () => {
  it("succeeds with a missing bind key, filling the input with an empty string and reporting a warning", () => {
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
    const result = exportPdfme(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.warnings).toEqual([
      { rule: "C01", path: "elements[0].text", message: expect.any(String) },
    ]);
    const name = result.template.schemas[0]?.[0]?.name as string;
    expect(result.inputs[0][name]).toBe("");
  });

  it("passes an empty warnings array through when nothing is missing", () => {
    const result = exportPdfme(docOf(), {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.warnings).toEqual([]);
  });
});

describe("exportPdfme — text wrapping and justify", () => {
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

  it("wraps a non-justify text into a single schema with newline-joined content", () => {
    const doc = textDoc("abcdef", widthMmFor(3.2), "left");
    const result = exportPdfme(doc, {}, UNIT_WIDTH_FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const schemas = result.template.schemas[0] as PdfmeTextSchema[];
    expect(schemas).toHaveLength(1);
    expect(schemas[0]).toMatchObject({ alignment: "left" });
    expect("characterSpacing" in (schemas[0] as PdfmeTextSchema)).toBe(false);
    expect(result.inputs[0][schemas[0]?.name as string]).toBe("abc\ndef");
  });

  it("splits a justify text into one schema per wrapped line with characterSpacing", () => {
    const doc = textDoc("abcdef", widthMmFor(3.5), "justify");
    const result = exportPdfme(doc, {}, UNIT_WIDTH_FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const schemas = result.template.schemas[0] as PdfmeTextSchema[];
    expect(schemas).toHaveLength(2);
    const expectedSpace = (3.5 - 3) / (3 - 1);
    const expectedWidth = widthMmFor(3.5) + expectedSpace * PT_TO_MM;

    expect(schemas[0]).toMatchObject({
      name: "p1_t1_0",
      position: { x: 10, y: 20 },
      width: expectedWidth,
      alignment: "left",
      characterSpacing: expectedSpace,
    });
    expect(result.inputs[0].p1_t1_0).toBe("abc");

    const lineHeightMm = 1.25 * 1 * PT_TO_MM;
    expect(schemas[1]).toMatchObject({
      name: "p1_t1_1",
      position: { x: 10, y: 20 + lineHeightMm },
      width: expectedWidth,
      alignment: "left",
      characterSpacing: expectedSpace,
    });
    expect(result.inputs[0].p1_t1_1).toBe("def");
  });

  it("keeps a single schema for a justify text whose only line already fills the width", () => {
    const doc = textDoc("abcd", widthMmFor(4), "justify");
    const result = exportPdfme(doc, {}, UNIT_WIDTH_FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const schemas = result.template.schemas[0] as PdfmeTextSchema[];
    expect(schemas).toHaveLength(1);
    expect(schemas[0]).toMatchObject({ alignment: "left" });
    expect(result.inputs[0][schemas[0]?.name as string]).toBe("abcd");
  });
});

describe("exportPdfme — font width gate", () => {
  it("returns fontIssues (and no errors) when cmap/hmtx cannot be read", () => {
    const fontWithoutWidths = buildSfnt(0x00010000, [
      { tag: "head", data: buildHeadTable(1000) },
    ]);
    const result = exportPdfme(docOf(), {}, fontWithoutWidths);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors).toEqual([]);
    expect(result.fontIssues).toHaveLength(1);
  });
});

describe("exportPdfme — footnotes", () => {
  it("resolves marks and adds a static note block schema, unchanged since exportPdfme goes through lowerIr", () => {
    const doc: IrDocument = {
      ...docOf({
        type: "text",
        id: "t1",
        x: 0,
        y: 0,
        pages: "first",
        w: 100,
        h: 10,
        text: "税抜{#tax}価格",
        fontSize: 12,
        align: "left",
        lineHeight: 1.2,
      }),
      footnotes: {
        x: 15,
        w: 180,
        bottom: 10,
        fontSize: 8,
        lineHeight: 1.25,
        pages: "all",
        notes: [{ id: "tax", text: "本体価格は税抜表示です" }],
      },
    };
    const result = exportPdfme(doc, {}, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const schemas = result.template.schemas[0] as PdfmeTextSchema[];
    expect(schemas).toHaveLength(2);
    const [main, note] = schemas;
    expect(result.inputs[0][main?.name ?? ""]).toBe("税抜*1価格");
    expect(result.inputs[0][note?.name ?? ""]).toBe(
      "*1 本体価格は税抜表示です",
    );
    expect(note).toMatchObject({
      type: "text",
      position: { x: 15 },
      width: 180,
      fontSize: 8,
      alignment: "left",
      lineHeight: 1.25,
    });
  });
});

describe("exportPdfme — barcode PDF generation", () => {
  it("generates a PDF for a qrcode element via the @pdfme/schemas barcodes plugins", async () => {
    const doc = docOf({
      type: "barcode",
      id: "bc1",
      x: 15,
      y: 15,
      pages: "first",
      w: 30,
      h: 30,
      symbology: "qrcode",
      value: "{code}",
    });
    const fontData = new Uint8Array(readFileSync(EMBEDDED_FONT_URL));
    const pdfBytes = await generatePdfmePdf(doc, { code: "ABC-123" }, fontData);
    expect(pdfBytes.byteLength).toBeGreaterThan(0);
  });
});
