import { describe, expect, it } from "vitest";
import type { IrRuleId } from "../src/ir/errors";
import { parseIr } from "../src/ir/parse";
import { validateIr } from "../src/ir/validate";
import invoiceFixture from "./fixtures/invoice.json";
import invoiceMultipageFixture from "./fixtures/invoice-multipage.json";

// biome-ignore lint/suspicious/noExplicitAny: 不正フィクスチャは仕様外の値も組み立てる必要がある
type Raw = any;

function baseDoc(): Raw {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { name: "NotoSansJP" },
    elements: [
      { type: "text", id: "t1", x: 0, y: 0, w: 50, h: 10, text: "hello" },
      {
        type: "line",
        id: "l1",
        x: 0,
        y: 20,
        orientation: "horizontal",
        length: 50,
      },
      { type: "rect", id: "r1", x: 0, y: 30, w: 50, h: 10 },
      {
        type: "ellipse",
        id: "e1",
        x: 0,
        y: 45,
        w: 30,
        h: 20,
        borderWidth: 0.3,
      },
      {
        type: "table",
        id: "tbl1",
        x: 0,
        y: 50,
        bind: "items",
        rowHeight: 9,
        headerHeight: 9,
        columns: [{ key: "name", label: "Name", width: 40 }],
      },
      {
        type: "image",
        id: "img1",
        x: 0,
        y: 100,
        w: 20,
        h: 20,
        src: "data:image/png;base64,AAAA",
      },
      {
        type: "flex",
        id: "flex1",
        x: 0,
        y: 130,
        direction: "column",
        h: 20,
        children: [{ type: "text", id: "ft1", w: 10, h: 5, text: "a" }],
      },
      { type: "pageNumber", id: "pn1", x: 0, y: 160, w: 50, h: 6 },
      {
        type: "barcode",
        id: "bc1",
        x: 0,
        y: 170,
        w: 30,
        h: 30,
        symbology: "qrcode",
        value: "{code}",
      },
    ],
  };
}

function parse(doc: Raw) {
  return parseIr(JSON.stringify(doc));
}

function expectRule(
  result: ReturnType<typeof parseIr>,
  rule: IrRuleId,
  pathIncludes?: string,
) {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  const match = result.errors.find(
    (e) =>
      e.rule === rule &&
      (pathIncludes === undefined || e.path.includes(pathIncludes)),
  );
  expect(
    match,
    `expected ${rule} error${pathIncludes ? ` at ${pathIncludes}` : ""}, got ${JSON.stringify(result.errors)}`,
  ).toBeDefined();
}

describe("parseIr", () => {
  it("accepts the base valid document", () => {
    const result = parse(baseDoc());
    expect(result.ok).toBe(true);
  });

  describe("S01", () => {
    it("rejects malformed JSON", () => {
      const result = parseIr("{not json");
      expectRule(result, "S01");
    });
  });

  describe("S02", () => {
    it("rejects a non-object root", () => {
      const result = parseIr(JSON.stringify([1, 2, 3]));
      expectRule(result, "S02", "$");
    });

    it("rejects a missing required key", () => {
      const doc = baseDoc();
      delete doc.font;
      expectRule(parse(doc), "S02", "font");
    });

    it("rejects an unknown root key", () => {
      const doc = baseDoc();
      doc.extra = 1;
      expectRule(parse(doc), "S02", "extra");
    });
  });

  describe("S03", () => {
    it("accepts 1.0", () => {
      const doc = baseDoc();
      doc.version = "1.0";
      expect(parse(doc).ok).toBe(true);
    });

    it("accepts 1.1", () => {
      const doc = baseDoc();
      doc.version = "1.1";
      expect(parse(doc).ok).toBe(true);
    });

    it("rejects an unsupported minor (1.2)", () => {
      const doc = baseDoc();
      doc.version = "1.2";
      expectRule(parse(doc), "S03", "version");
    });

    it("rejects a different major (2.0)", () => {
      const doc = baseDoc();
      doc.version = "2.0";
      expectRule(parse(doc), "S03", "version");
    });

    it.each(["1", "v1", "1.0.0"])("rejects malformed version %s", (v) => {
      const doc = baseDoc();
      doc.version = v;
      expectRule(parse(doc), "S03", "version");
    });

    it("rejects a numeric version", () => {
      const doc = baseDoc();
      doc.version = 1;
      expectRule(parse(doc), "S03", "version");
    });
  });

  describe("S04", () => {
    it("rejects a non-object page", () => {
      const doc = baseDoc();
      doc.page = "A4";
      expectRule(parse(doc), "S04", "page");
    });

    it("rejects a missing page.width", () => {
      const doc = baseDoc();
      doc.page = { height: 297 };
      expectRule(parse(doc), "S04", "page.width");
    });

    it("rejects an unknown page key", () => {
      const doc = baseDoc();
      doc.page = { width: 210, height: 297, preset: "A4" };
      expectRule(parse(doc), "S04", "page.preset");
    });
  });

  describe("S05", () => {
    it("rejects a non-object font", () => {
      const doc = baseDoc();
      doc.font = "NotoSansJP";
      expectRule(parse(doc), "S05", "font");
    });

    it("rejects a missing font.name", () => {
      const doc = baseDoc();
      doc.font = {};
      expectRule(parse(doc), "S05", "font.name");
    });

    it("rejects an unknown font key", () => {
      const doc = baseDoc();
      doc.font = { name: "NotoSansJP", path: "/tmp/font.ttf" };
      expectRule(parse(doc), "S05", "font.path");
    });
  });

  describe("S06", () => {
    it("rejects a non-array elements", () => {
      const doc = baseDoc();
      doc.elements = {};
      expectRule(parse(doc), "S06", "elements");
    });

    it("rejects a non-object element", () => {
      const doc = baseDoc();
      doc.elements = [null];
      expectRule(parse(doc), "S06", "elements[0]");
    });
  });

  describe("S07", () => {
    it("rejects an unknown element type", () => {
      const doc = baseDoc();
      doc.elements = [{ type: "sticker", id: "s1", x: 0, y: 0 }];
      expectRule(parse(doc), "S07", "elements[0].type");
    });
  });

  describe("S08 (per type required attributes)", () => {
    it("S08t: rejects text missing w", () => {
      const doc = baseDoc();
      doc.elements = [
        { type: "text", id: "t1", x: 0, y: 0, h: 10, text: "hi" },
      ];
      expectRule(parse(doc), "S08t", "elements[0].w");
    });

    it("S08t: rejects text missing text", () => {
      const doc = baseDoc();
      doc.elements = [{ type: "text", id: "t1", x: 0, y: 0, w: 10, h: 10 }];
      expectRule(parse(doc), "S08t", "elements[0].text");
    });

    it("S08l: rejects line missing orientation", () => {
      const doc = baseDoc();
      doc.elements = [{ type: "line", id: "l1", x: 0, y: 0, length: 10 }];
      expectRule(parse(doc), "S08l", "elements[0].orientation");
    });

    it("S08r: rejects rect missing h", () => {
      const doc = baseDoc();
      doc.elements = [{ type: "rect", id: "r1", x: 0, y: 0, w: 10 }];
      expectRule(parse(doc), "S08r", "elements[0].h");
    });

    it("S08e: rejects ellipse missing borderWidth", () => {
      const doc = baseDoc();
      doc.elements = [{ type: "ellipse", id: "e1", x: 0, y: 0, w: 10, h: 10 }];
      expectRule(parse(doc), "S08e", "elements[0].borderWidth");
    });

    it("S08e: rejects ellipse with a non-number w", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "ellipse",
          id: "e1",
          x: 0,
          y: 0,
          w: "wide",
          h: 10,
          borderWidth: 0.3,
        },
      ];
      expectRule(parse(doc), "S08e", "elements[0].w");
    });

    it("S08b: rejects table missing rowHeight", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "table",
          id: "tbl1",
          x: 0,
          y: 0,
          bind: "items",
          headerHeight: 9,
          columns: [{ key: "a", label: "A", width: 10 }],
        },
      ];
      expectRule(parse(doc), "S08b", "elements[0].rowHeight");
    });

    it("S08b: rejects a column missing width", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "table",
          id: "tbl1",
          x: 0,
          y: 0,
          bind: "items",
          rowHeight: 9,
          headerHeight: 9,
          columns: [{ key: "a", label: "A" }],
        },
      ];
      expectRule(parse(doc), "S08b", "elements[0].columns[0].width");
    });

    it("S08b: rejects cellOverrides that is not an array", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "table",
          id: "tbl1",
          x: 0,
          y: 0,
          bind: "items",
          rowHeight: 9,
          headerHeight: 9,
          columns: [{ key: "a", label: "A", width: 10 }],
          cellOverrides: "nope",
        },
      ];
      expectRule(parse(doc), "S08b", "elements[0].cellOverrides");
    });

    it("S08b: rejects a non-object cellOverrides entry", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "table",
          id: "tbl1",
          x: 0,
          y: 0,
          bind: "items",
          rowHeight: 9,
          headerHeight: 9,
          columns: [{ key: "a", label: "A", width: 10 }],
          cellOverrides: [42],
        },
      ];
      expectRule(parse(doc), "S08b", "elements[0].cellOverrides[0]");
    });

    it("S08b: rejects a cellOverrides entry with a non-number row", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "table",
          id: "tbl1",
          x: 0,
          y: 0,
          bind: "items",
          rowHeight: 9,
          headerHeight: 9,
          columns: [{ key: "a", label: "A", width: 10 }],
          cellOverrides: [{ row: "0", key: "a", value: "x" }],
        },
      ];
      expectRule(parse(doc), "S08b", "elements[0].cellOverrides[0].row");
    });

    it("S08i: rejects image missing src", () => {
      const doc = baseDoc();
      doc.elements = [{ type: "image", id: "img1", x: 0, y: 0, w: 10, h: 10 }];
      expectRule(parse(doc), "S08i", "elements[0].src");
    });

    it("S08f: rejects flex missing direction", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "flex",
          id: "flex1",
          x: 0,
          y: 0,
          children: [{ type: "text", id: "ft1", w: 1, h: 1, text: "a" }],
        },
      ];
      expectRule(parse(doc), "S08f", "elements[0].direction");
    });

    it("S08p: rejects pageNumber missing h", () => {
      const doc = baseDoc();
      doc.elements = [{ type: "pageNumber", id: "pn1", x: 0, y: 0, w: 10 }];
      expectRule(parse(doc), "S08p", "elements[0].h");
    });

    it("S08c: rejects barcode missing value", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "barcode",
          id: "bc1",
          x: 0,
          y: 0,
          w: 30,
          h: 30,
          symbology: "qrcode",
        },
      ];
      expectRule(parse(doc), "S08c", "elements[0].value");
    });

    it("S08c: rejects a non-string symbology", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "barcode",
          id: "bc1",
          x: 0,
          y: 0,
          w: 30,
          h: 30,
          symbology: 1,
          value: "abc",
        },
      ];
      expectRule(parse(doc), "S08c", "elements[0].symbology");
    });
  });

  describe("S09", () => {
    it("rejects an unknown element attribute", () => {
      const doc = baseDoc();
      doc.elements = [
        { type: "rect", id: "r1", x: 0, y: 0, w: 10, h: 10, color: "red" },
      ];
      expectRule(parse(doc), "S09", "elements[0].color");
    });

    it("rejects strokeStyle on an ellipse (no line-style attribute for ellipse)", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "ellipse",
          id: "e1",
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          borderWidth: 0.3,
          strokeStyle: "dashed",
        },
      ];
      expectRule(parse(doc), "S09", "elements[0].strokeStyle");
    });

    it("rejects pages on a table", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "table",
          id: "tbl1",
          x: 0,
          y: 0,
          pages: "all",
          bind: "items",
          rowHeight: 9,
          headerHeight: 9,
          columns: [{ key: "a", label: "A", width: 10 }],
        },
      ];
      expectRule(parse(doc), "S09", "elements[0].pages");
    });

    it("rejects x on a flex child", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "flex",
          id: "flex1",
          x: 0,
          y: 0,
          direction: "column",
          children: [{ type: "text", id: "ft1", x: 5, w: 1, h: 1, text: "a" }],
        },
      ];
      expectRule(parse(doc), "S09", "elements[0].children[0].x");
    });

    it("rejects the cross-axis dimension (h on row)", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "flex",
          id: "flex1",
          x: 0,
          y: 0,
          direction: "row",
          h: 10,
          children: [{ type: "text", id: "ft1", w: 1, h: 1, text: "a" }],
        },
      ];
      expectRule(parse(doc), "S09", "elements[0].h");
    });

    it("rejects an unknown column attribute", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "table",
          id: "tbl1",
          x: 0,
          y: 0,
          bind: "items",
          rowHeight: 9,
          headerHeight: 9,
          columns: [{ key: "a", label: "A", width: 10, wrap: true }],
        },
      ];
      expectRule(parse(doc), "S09", "elements[0].columns[0].wrap");
    });

    it("rejects an unknown cellOverrides entry attribute", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "table",
          id: "tbl1",
          x: 0,
          y: 0,
          bind: "items",
          rowHeight: 9,
          headerHeight: 9,
          columns: [{ key: "a", label: "A", width: 10 }],
          cellOverrides: [{ row: 0, key: "a", value: "x", note: "extra" }],
        },
      ];
      expectRule(parse(doc), "S09", "elements[0].cellOverrides[0].note");
    });

    it("rejects text.bind with a migration message", () => {
      const doc = baseDoc();
      doc.elements = [
        { type: "text", id: "t1", x: 0, y: 0, w: 10, h: 10, bind: "label" },
      ];
      const result = parse(doc);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const match = result.errors.find(
        (e) => e.rule === "S09" && e.path === "elements[0].bind",
      );
      expect(match?.message).toContain("text の全体差し込みは廃止されました");
    });
  });

  describe("S10", () => {
    it("rejects an invalid align value", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "text",
          id: "t1",
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          text: "hi",
          align: "diagonal",
        },
      ];
      expectRule(parse(doc), "S10", "elements[0].align");
    });

    it("rejects an invalid symbology value", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "barcode",
          id: "bc1",
          x: 0,
          y: 0,
          w: 30,
          h: 30,
          symbology: "pdf417",
          value: "abc",
        },
      ];
      expectRule(parse(doc), "S10", "elements[0].symbology");
    });

    it("rejects an invalid pages value", () => {
      const doc = baseDoc();
      doc.elements = [
        { type: "rect", id: "r1", x: 0, y: 0, w: 10, h: 10, pages: "third" },
      ];
      expectRule(parse(doc), "S10", "elements[0].pages");
    });

    it("rejects an invalid line.strokeStyle value", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "line",
          id: "l1",
          x: 0,
          y: 0,
          orientation: "horizontal",
          length: 10,
          strokeStyle: "wavy",
        },
      ];
      expectRule(parse(doc), "S10", "elements[0].strokeStyle");
    });

    it("rejects an invalid rect.borderStyle value", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "rect",
          id: "r1",
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          borderStyle: "wavy",
        },
      ];
      expectRule(parse(doc), "S10", "elements[0].borderStyle");
    });

    it("reports only S09 (not S10) for an enum-named attribute unknown to the element type", () => {
      const doc = baseDoc();
      doc.elements = [
        { type: "rect", id: "r1", x: 0, y: 0, w: 10, h: 10, align: "justify" },
      ];
      const result = parse(doc);
      expectRule(result, "S09", "elements[0].align");
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.some((e) => e.rule === "S10")).toBe(false);
    });
  });

  describe("docType (root)", () => {
    it("accepts qualifiedInvoice", () => {
      const doc = baseDoc();
      doc.docType = "qualifiedInvoice";
      expect(parse(doc).ok).toBe(true);
    });

    it("rejects an out-of-domain string value", () => {
      const doc = baseDoc();
      doc.docType = "invoice";
      expectRule(parse(doc), "S10", "docType");
    });

    it("rejects a non-string value", () => {
      const doc = baseDoc();
      doc.docType = 1;
      expectRule(parse(doc), "S10", "docType");
    });

    it("is not required (absence is valid)", () => {
      const doc = baseDoc();
      expect(parse(doc).ok).toBe(true);
    });
  });

  describe("S12", () => {
    it("rejects a non data-URI src", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "image",
          id: "img1",
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          src: "https://example.com/a.png",
        },
      ];
      expectRule(parse(doc), "S12", "elements[0].src");
    });
  });

  describe("S13", () => {
    it("rejects a table as a flex child", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "flex",
          id: "flex1",
          x: 0,
          y: 0,
          direction: "column",
          children: [
            {
              type: "table",
              id: "tbl1",
              bind: "items",
              rowHeight: 9,
              headerHeight: 9,
              columns: [{ key: "a", label: "A", width: 10 }],
            },
          ],
        },
      ];
      expectRule(parse(doc), "S13", "elements[0].children[0]");
    });

    it("accepts a barcode as a flex child", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "flex",
          id: "flex1",
          x: 0,
          y: 0,
          direction: "column",
          children: [
            {
              type: "barcode",
              id: "bc1",
              w: 30,
              h: 30,
              symbology: "code128",
              value: "abc",
            },
          ],
        },
      ];
      expect(parse(doc).ok).toBe(true);
    });

    it("rejects a non-object flex child", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "flex",
          id: "flex1",
          x: 0,
          y: 0,
          direction: "column",
          children: [42],
        },
      ];
      expectRule(parse(doc), "S13", "elements[0].children[0]");
    });

    it("validates flex children recursively (nested S07)", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "flex",
          id: "flex1",
          x: 0,
          y: 0,
          direction: "column",
          children: [{ type: "sticker", id: "s1" }],
        },
      ];
      expectRule(parse(doc), "S07", "elements[0].children[0].type");
    });
  });

  describe("S14", () => {
    it("accepts a document with no styles key", () => {
      const doc = baseDoc();
      expect(parse(doc).ok).toBe(true);
    });

    it("accepts an empty styles array", () => {
      const doc = baseDoc();
      doc.styles = [];
      expect(parse(doc).ok).toBe(true);
    });

    it("accepts multiple style definitions", () => {
      const doc = baseDoc();
      doc.styles = [
        { name: "見出し", attrs: { fontSize: 14, align: "center" } },
        { name: "枠線太め", attrs: { borderWidth: 1, thickness: 0.8 } },
      ];
      expect(parse(doc).ok).toBe(true);
    });

    it("rejects a non-array styles", () => {
      const doc = baseDoc();
      doc.styles = { name: "x", attrs: { fontSize: 10 } };
      expectRule(parse(doc), "S14", "styles");
    });

    it("rejects an unknown key on a style entry", () => {
      const doc = baseDoc();
      doc.styles = [{ name: "x", attrs: { fontSize: 10 }, extra: 1 }];
      expectRule(parse(doc), "S14", "styles[0].extra");
    });

    it("rejects a non-string name", () => {
      const doc = baseDoc();
      doc.styles = [{ name: 1, attrs: { fontSize: 10 } }];
      expectRule(parse(doc), "S14", "styles[0].name");
    });

    it("rejects an unknown attrs key", () => {
      const doc = baseDoc();
      doc.styles = [{ name: "x", attrs: { color: "red" } }];
      expectRule(parse(doc), "S14", "styles[0].attrs.color");
    });

    it("rejects a non-number value for a numeric attr", () => {
      const doc = baseDoc();
      doc.styles = [{ name: "x", attrs: { fontSize: "10" } }];
      expectRule(parse(doc), "S14", "styles[0].attrs.fontSize");
    });

    it("rejects an out-of-domain align value", () => {
      const doc = baseDoc();
      doc.styles = [{ name: "x", attrs: { align: "middle" } }];
      expectRule(parse(doc), "S14", "styles[0].attrs.align");
    });

    it("rejects a non-object attrs", () => {
      const doc = baseDoc();
      doc.styles = [{ name: "x", attrs: "fontSize" }];
      expectRule(parse(doc), "S14", "styles[0].attrs");
    });
  });

  describe("style element attribute", () => {
    it("accepts a style reference on text/line/rect/table/pageNumber", () => {
      const doc = baseDoc();
      doc.styles = [{ name: "見出し", attrs: { fontSize: 14 } }];
      doc.elements = doc.elements.map((el: Raw) =>
        el.type === "image" ||
        el.type === "flex" ||
        el.type === "ellipse" ||
        el.type === "barcode"
          ? el
          : { ...el, style: "見出し" },
      );
      expect(parse(doc).ok).toBe(true);
    });

    it("rejects a non-string style value", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "text",
          id: "t1",
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          text: "a",
          style: 1,
        },
      ];
      expectRule(parse(doc), "S08t", "elements[0].style");
    });

    it("rejects style on image (S09)", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "image",
          id: "img1",
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          src: "data:image/png;base64,AAAA",
          style: "見出し",
        },
      ];
      expectRule(parse(doc), "S09", "elements[0].style");
    });

    it("rejects style on flex (S09)", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "flex",
          id: "flex1",
          x: 0,
          y: 0,
          direction: "column",
          style: "見出し",
          children: [{ type: "text", id: "ft1", w: 1, h: 1, text: "a" }],
        },
      ];
      expectRule(parse(doc), "S09", "elements[0].style");
    });

    it("accepts style on a flex child", () => {
      const doc = baseDoc();
      doc.styles = [{ name: "見出し", attrs: { fontSize: 14 } }];
      doc.elements = [
        {
          type: "flex",
          id: "flex1",
          x: 0,
          y: 0,
          direction: "column",
          children: [
            { type: "text", id: "ft1", w: 1, h: 1, text: "a", style: "見出し" },
          ],
        },
      ];
      expect(parse(doc).ok).toBe(true);
    });
  });

  describe("footnotes (S02, F01)", () => {
    function withFootnotes(footnotes: Raw): Raw {
      const doc = baseDoc();
      doc.footnotes = footnotes;
      return doc;
    }

    const VALID_FOOTNOTES: Raw = {
      x: 15,
      w: 180,
      bottom: 10,
      fontSize: 8,
      lineHeight: 1.25,
      pages: "all",
      notes: [{ id: "tax", text: "本体価格は税抜表示です" }],
    };

    it("accepts a document with a valid footnotes block", () => {
      const result = parse(withFootnotes(VALID_FOOTNOTES));
      expect(result.ok).toBe(true);
    });

    it("accepts a document without footnotes (back-compat)", () => {
      const doc = baseDoc();
      expect("footnotes" in doc).toBe(false);
      expect(parse(doc).ok).toBe(true);
    });

    it("rejects a non-object footnotes", () => {
      expectRule(parse(withFootnotes("nope")), "F01", "footnotes");
    });

    it("rejects a missing required footnotes key", () => {
      const { notes: _notes, ...rest } = VALID_FOOTNOTES;
      expectRule(parse(withFootnotes(rest)), "F01", "footnotes.notes");
    });

    it("rejects an unknown footnotes key", () => {
      expectRule(
        parse(withFootnotes({ ...VALID_FOOTNOTES, color: "red" })),
        "F01",
        "footnotes.color",
      );
    });

    it("rejects a non-number footnotes.x", () => {
      expectRule(
        parse(withFootnotes({ ...VALID_FOOTNOTES, x: "15" })),
        "F01",
        "footnotes.x",
      );
    });

    it("rejects an invalid footnotes.pages value", () => {
      expectRule(
        parse(withFootnotes({ ...VALID_FOOTNOTES, pages: "third" })),
        "S10",
        "footnotes.pages",
      );
    });

    it("rejects a non-array notes", () => {
      expectRule(
        parse(withFootnotes({ ...VALID_FOOTNOTES, notes: "nope" })),
        "F01",
        "footnotes.notes",
      );
    });

    it("rejects a note missing required attributes", () => {
      expectRule(
        parse(withFootnotes({ ...VALID_FOOTNOTES, notes: [{ id: "tax" }] })),
        "F01",
        "footnotes.notes[0].text",
      );
    });

    it("rejects a note with an unknown attribute", () => {
      expectRule(
        parse(
          withFootnotes({
            ...VALID_FOOTNOTES,
            notes: [{ id: "tax", text: "本文", extra: 1 }],
          }),
        ),
        "F01",
        "footnotes.notes[0].extra",
      );
    });

    it("passes footnotes through normalization without filling defaults", () => {
      const result = parse(withFootnotes(VALID_FOOTNOTES));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.document.footnotes).toEqual(VALID_FOOTNOTES);
    });

    it("rejects an unknown root key even when footnotes is present", () => {
      const doc = withFootnotes(VALID_FOOTNOTES);
      doc.extra = 1;
      expectRule(parse(doc), "S02", "extra");
    });
  });

  describe("multiple violations", () => {
    it("reports every violation, not just the first", () => {
      const doc = baseDoc();
      doc.font = {};
      doc.elements = [{ type: "rect", id: "r1", x: 0, y: 0, w: -1 }];
      const result = parse(doc);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.some((e) => e.rule === "S05")).toBe(true);
      expect(result.errors.some((e) => e.rule === "S08r")).toBe(true);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("normalization", () => {
    it("applies default values for omitted optional attributes", () => {
      const doc = baseDoc();
      doc.elements = [
        { type: "text", id: "t1", x: 0, y: 0, w: 10, h: 10, text: "hi" },
      ];
      const result = parse(doc);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const [el] = result.document.elements;
      expect(el).toMatchObject({
        pages: "first",
        fontSize: 10,
        align: "left",
        lineHeight: 1.25,
      });
    });

    it("defaults pageNumber.pages to all", () => {
      const doc = baseDoc();
      doc.elements = [
        { type: "pageNumber", id: "pn1", x: 0, y: 0, w: 10, h: 6 },
      ];
      const result = parse(doc);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.document.elements[0]).toMatchObject({
        pages: "all",
        format: "{n} / {N}",
        fontSize: 10,
        align: "left",
        lineHeight: 1.25,
      });
    });

    it("defaults barcode.pages to first", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "barcode",
          id: "bc1",
          x: 0,
          y: 0,
          w: 30,
          h: 30,
          symbology: "ean13",
          value: "4912345678904",
        },
      ];
      const result = parse(doc);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.document.elements[0]).toMatchObject({
        pages: "first",
        symbology: "ean13",
        value: "4912345678904",
      });
    });

    it("defaults table.maxY to page.height and continuationY to table.y", () => {
      const doc = baseDoc();
      doc.page = { width: 210, height: 297 };
      doc.elements = [
        {
          type: "table",
          id: "tbl1",
          x: 0,
          y: 42,
          bind: "items",
          rowHeight: 9,
          headerHeight: 9,
          columns: [{ key: "a", label: "A", width: 10 }],
        },
      ];
      const result = parse(doc);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.document.elements[0]).toMatchObject({
        maxY: 297,
        continuationY: 42,
        minRows: 0,
      });
    });

    it("defaults column.align to left and flex gap/justifyContent/alignItems", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "table",
          id: "tbl1",
          x: 0,
          y: 0,
          bind: "items",
          rowHeight: 9,
          headerHeight: 9,
          columns: [{ key: "a", label: "A", width: 10 }],
        },
        {
          type: "flex",
          id: "flex1",
          x: 0,
          y: 50,
          direction: "column",
          children: [{ type: "text", id: "ft1", w: 1, h: 1, text: "a" }],
        },
      ];
      const result = parse(doc);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const [table, flex] = result.document.elements as unknown as [
        { columns: { align: string }[] },
        { gap: number; justifyContent: string; alignItems: string },
      ];
      expect(table.columns[0]?.align).toBe("left");
      expect(flex.gap).toBe(0);
      expect(flex.justifyContent).toBe("start");
      expect(flex.alignItems).toBe("start");
    });

    it("does not fill in the omitted flex main-axis dimension", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "flex",
          id: "flex1",
          x: 0,
          y: 0,
          direction: "column",
          children: [{ type: "text", id: "ft1", w: 1, h: 1, text: "a" }],
        },
      ];
      const result = parse(doc);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.document.elements[0]).not.toHaveProperty("h");
    });

    it("does not add a cellOverrides attribute when omitted", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "table",
          id: "tbl1",
          x: 0,
          y: 0,
          bind: "items",
          rowHeight: 9,
          headerHeight: 9,
          columns: [{ key: "a", label: "A", width: 10 }],
        },
      ];
      const result = parse(doc);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.document.elements[0]).not.toHaveProperty("cellOverrides");
    });

    it("preserves cellOverrides entries and order without adding defaults", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "table",
          id: "tbl1",
          x: 0,
          y: 0,
          bind: "items",
          rowHeight: 9,
          headerHeight: 9,
          columns: [{ key: "a", label: "A", width: 10 }],
          cellOverrides: [
            { row: 1, key: "a", value: "固定値" },
            { row: 0, key: "a", value: "" },
          ],
        },
      ];
      const result = parse(doc);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.document.elements[0]).toMatchObject({
        cellOverrides: [
          { row: 1, key: "a", value: "固定値" },
          { row: 0, key: "a", value: "" },
        ],
      });
    });

    it("does not add a styles attribute when omitted", () => {
      const result = parse(baseDoc());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.document).not.toHaveProperty("styles");
    });

    it("preserves only the defined attrs of each style and passes through the element style reference", () => {
      const doc = baseDoc();
      doc.styles = [{ name: "見出し", attrs: { fontSize: 14 } }];
      doc.elements = [
        {
          type: "text",
          id: "t1",
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          text: "a",
          style: "見出し",
        },
      ];
      const result = parse(doc);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.document.styles).toEqual([
        { name: "見出し", attrs: { fontSize: 14 } },
      ]);
      expect(result.document.elements[0]).toMatchObject({ style: "見出し" });
    });

    it("does not add a style attribute when omitted", () => {
      const result = parse(baseDoc());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.document.elements[0]).not.toHaveProperty("style");
    });

    it("preserves docType when present", () => {
      const doc = baseDoc();
      doc.docType = "qualifiedInvoice";
      const result = parse(doc);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.document.docType).toBe("qualifiedInvoice");
    });

    it("does not add a docType attribute when omitted", () => {
      const result = parse(baseDoc());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.document).not.toHaveProperty("docType");
    });

    it("accepts and normalizes an ellipse element", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "ellipse",
          id: "e1",
          x: 0,
          y: 0,
          w: 30,
          h: 20,
          borderWidth: 0.3,
        },
      ];
      const result = parse(doc);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.document.elements[0]).toMatchObject({
        type: "ellipse",
        pages: "first",
        w: 30,
        h: 20,
        borderWidth: 0.3,
      });
      expect(result.document.elements[0]).not.toHaveProperty("borderColor");
      expect(result.document.elements[0]).not.toHaveProperty("fillColor");
    });

    it("projects style attributes only when present, leaving unstyled elements unchanged", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "line",
          id: "l1",
          x: 0,
          y: 0,
          orientation: "horizontal",
          length: 10,
        },
        { type: "rect", id: "r1", x: 0, y: 0, w: 10, h: 10 },
        {
          type: "line",
          id: "l2",
          x: 0,
          y: 0,
          orientation: "horizontal",
          length: 10,
          color: "#ff0000",
          strokeStyle: "dashed",
        },
        {
          type: "rect",
          id: "r2",
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          borderColor: "#00ff00",
          fillColor: "#0000ff",
          borderStyle: "dotted",
          cornerRadius: 2,
        },
      ];
      const result = parse(doc);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const [l1, r1, l2, r2] = result.document.elements;
      expect(l1).not.toHaveProperty("color");
      expect(l1).not.toHaveProperty("strokeStyle");
      expect(r1).not.toHaveProperty("borderColor");
      expect(r1).not.toHaveProperty("fillColor");
      expect(r1).not.toHaveProperty("borderStyle");
      expect(r1).not.toHaveProperty("cornerRadius");
      expect(l2).toMatchObject({ color: "#ff0000", strokeStyle: "dashed" });
      expect(r2).toMatchObject({
        borderColor: "#00ff00",
        fillColor: "#0000ff",
        borderStyle: "dotted",
        cornerRadius: 2,
      });
    });

    it("does not add a stripeColor attribute when omitted, and preserves it when present", () => {
      const doc = baseDoc();
      doc.elements = [
        {
          type: "table",
          id: "tbl1",
          x: 0,
          y: 0,
          bind: "items",
          rowHeight: 9,
          headerHeight: 9,
          columns: [{ key: "a", label: "A", width: 10 }],
          stripeColor: "#f0f0f0",
        },
      ];
      const result = parse(doc);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.document.elements[0]).toMatchObject({
        stripeColor: "#f0f0f0",
      });

      const withoutStripe = baseDoc();
      withoutStripe.elements = [
        {
          type: "table",
          id: "tbl1",
          x: 0,
          y: 0,
          bind: "items",
          rowHeight: 9,
          headerHeight: 9,
          columns: [{ key: "a", label: "A", width: 10 }],
        },
      ];
      const resultWithout = parse(withoutStripe);
      expect(resultWithout.ok).toBe(true);
      if (!resultWithout.ok) return;
      expect(resultWithout.document.elements[0]).not.toHaveProperty(
        "stripeColor",
      );
    });
  });

  describe("golden fixtures", () => {
    it.each([
      ["invoice.json", invoiceFixture],
      ["invoice-multipage.json", invoiceMultipageFixture],
    ] as const)("parses and validates %s with no errors", (_name, fixture) => {
      const result = parseIr(JSON.stringify(fixture));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(validateIr(result.document)).toEqual([]);
    });
  });
});
