import type { IrDocument, IrElementType } from "@denreport/core";
import { parseIr, validateIr } from "@denreport/core";
import { describe, expect, it } from "vitest";
import {
  createCenteredElement,
  createDefaultElement,
  defaultSizeMm,
  nextElementId,
} from "./defaults";
import { addElement } from "./elements";

const ALL_TYPES: readonly IrElementType[] = [
  "text",
  "line",
  "rect",
  "ellipse",
  "table",
  "image",
  "flex",
  "pageNumber",
  "barcode",
];

function blankDocument(): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements: [],
  };
}

function defaultElement(
  document: IrDocument,
  type: IrElementType,
  x: number,
  y: number,
) {
  return createDefaultElement(document, type, x, y);
}

function centeredElement(document: IrDocument, type: IrElementType) {
  return createCenteredElement(document, type);
}

describe("nextElementId", () => {
  it("returns <type>1 for a blank document", () => {
    expect(nextElementId(blankDocument(), "text")).toBe("text1");
    expect(nextElementId(blankDocument(), "pageNumber")).toBe("pageNumber1");
  });

  it("does not collide with flex descendant ids", () => {
    let doc = blankDocument();
    doc = addElement(doc, defaultElement(doc, "flex", 10, 10));
    // flex1, and its text child text1, become used
    expect(nextElementId(doc, "flex")).toBe("flex2");
    expect(nextElementId(doc, "text")).toBe("text2");
  });

  it("reuses a deleted number (the smallest gap)", () => {
    let doc = blankDocument();
    doc = addElement(doc, defaultElement(doc, "text", 10, 10));
    doc = addElement(doc, defaultElement(doc, "text", 10, 30));
    doc = addElement(doc, defaultElement(doc, "text", 10, 50));
    doc = {
      ...doc,
      elements: doc.elements.filter((el) => el.id !== "text2"),
    };
    expect(nextElementId(doc, "text")).toBe("text2");
  });
});

describe("createDefaultElement", () => {
  for (const type of ALL_TYPES) {
    it(`${type}: passes group S as a normalized complete form, and creates no group M violations on a blank A4 page`, () => {
      const doc = addElement(
        blankDocument(),
        defaultElement(blankDocument(), type, 20, 30),
      );
      const result = parseIr(JSON.stringify(doc));
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Normalized = unchanged by parseIr's default application
        expect(result.document).toEqual(doc);
        expect(validateIr(result.document)).toEqual([]);
      }
    });
  }

  it("coordinates are rounded to 0.1mm", () => {
    const el = defaultElement(blankDocument(), "rect", 10.04, 20.06);
    expect(el.type).toBe("rect");
    if (el.type === "rect") {
      expect(el.x).toBe(10);
      expect(el.y).toBe(20.1);
    }
  });

  it("table has concrete document-dependent defaults (maxY = page.height, continuationY = y)", () => {
    const el = defaultElement(blankDocument(), "table", 15, 90);
    expect(el.type).toBe("table");
    if (el.type === "table") {
      expect(el.maxY).toBe(297);
      expect(el.continuationY).toBe(90);
      expect(el.minRows).toBe(3);
    }
  });

  it("barcode defaults to qrcode with token value {code}", () => {
    const el = defaultElement(blankDocument(), "barcode", 15, 90);
    expect(el.type).toBe("barcode");
    if (el.type === "barcode") {
      expect(el.symbology).toBe("qrcode");
      expect(el.value).toBe("{code}");
      expect(el.w).toBe(30);
      expect(el.h).toBe(30);
    }
  });

  it("flex is created with one text child, and the child id is also numbered from the document", () => {
    let doc = blankDocument();
    doc = addElement(doc, defaultElement(doc, "text", 10, 10));
    const el = defaultElement(doc, "flex", 20, 20);
    expect(el.type).toBe("flex");
    if (el.type === "flex") {
      expect(el.children).toHaveLength(1);
      expect(el.children[0]?.id).toBe("text2");
    }
  });

  it("default text and column names are English regardless of locale", () => {
    const el = defaultElement(blankDocument(), "text", 10, 10);
    expect(el.type).toBe("text");
    if (el.type === "text") {
      expect(el.text).toBe("text1");
    }

    const table = defaultElement(blankDocument(), "table", 10, 10);
    expect(table.type).toBe("table");
    if (table.type === "table") {
      expect(table.columns.map((c) => c.label)).toEqual(["column1", "column2"]);
    }
  });
});

describe("createCenteredElement", () => {
  for (const type of ALL_TYPES) {
    it(`${type}: placed at the page center on a blank A4 page with no group M violations`, () => {
      const doc = blankDocument();
      const el = centeredElement(doc, type);
      const size = defaultSizeMm(type);
      expect(el.x + size.w / 2).toBeCloseTo(doc.page.width / 2, 1);
      expect(el.y + size.h / 2).toBeCloseTo(doc.page.height / 2, 1);

      const result = parseIr(JSON.stringify(addElement(doc, el)));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(validateIr(result.document)).toEqual([]);
      }
    });
  }

  it("table centers using the sum of column widths as its width", () => {
    const doc = blankDocument();
    const el = centeredElement(doc, "table");
    expect(el.type).toBe("table");
    if (el.type === "table") {
      const totalWidth = el.columns.reduce(
        (sum, column) => sum + column.width,
        0,
      );
      expect(el.x + totalWidth / 2).toBeCloseTo(doc.page.width / 2, 1);
    }
  });

  it("x / y clamp to 0 when the paper is smaller than the default size", () => {
    const tiny: IrDocument = {
      ...blankDocument(),
      page: { width: 1, height: 1 },
    };
    const el = centeredElement(tiny, "rect");
    expect(el.x).toBe(0);
    expect(el.y).toBe(0);
  });
});

describe("defaultSizeMm", () => {
  it("returns the initial dimensions for every type (line is length×0-equivalent, table is Σcolumn-width×(header+minRows rows))", () => {
    expect(defaultSizeMm("text")).toEqual({ w: 40, h: 8 });
    expect(defaultSizeMm("line")).toEqual({ w: 50, h: 0 });
    expect(defaultSizeMm("rect")).toEqual({ w: 40, h: 20 });
    expect(defaultSizeMm("ellipse")).toEqual({ w: 30, h: 20 });
    expect(defaultSizeMm("table")).toEqual({ w: 80, h: 32 });
    expect(defaultSizeMm("image")).toEqual({ w: 30, h: 30 });
    expect(defaultSizeMm("flex")).toEqual({ w: 40, h: 8 });
    expect(defaultSizeMm("pageNumber")).toEqual({ w: 30, h: 6 });
    expect(defaultSizeMm("barcode")).toEqual({ w: 30, h: 30 });
  });
});
