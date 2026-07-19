import { describe, expect, it } from "vitest";
import { checkCompat } from "../src/compat/check";
import { COMPAT_MATRICES } from "../src/compat/registry";
import type { IrDocument } from "../src/ir/types";
import { validateIr } from "../src/ir/validate";

function baseDoc(overrides: Partial<IrDocument> = {}): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements: [],
    ...overrides,
  };
}

describe("validateIr locale", () => {
  function docWithNegativeX(): IrDocument {
    return baseDoc({
      elements: [
        {
          type: "text",
          id: "t1",
          x: -1,
          y: 0,
          pages: "first",
          w: 10,
          h: 10,
          text: "hi",
          fontSize: 10,
          align: "left",
          lineHeight: 1.25,
        },
      ],
    });
  }

  it("defaults to ja when options are omitted", () => {
    const errors = validateIr(docWithNegativeX());
    const match = errors.find((e) => e.rule === "M02");
    expect(match?.message).toBe("x が 0 未満です");
  });

  it("returns en messages for locale: en", () => {
    const errors = validateIr(docWithNegativeX(), { locale: "en" });
    const match = errors.find((e) => e.rule === "M02");
    expect(match?.message).toBe("x is below 0");
  });
});

describe("checkCompat locale", () => {
  function docWithBarcode(): IrDocument {
    return baseDoc({
      elements: [
        {
          type: "barcode",
          id: "bc1",
          x: 0,
          y: 0,
          pages: "first",
          w: 30,
          h: 30,
          symbology: "qrcode",
          value: "hello",
        },
      ],
    });
  }

  it("defaults to ja when options are omitted", () => {
    const findings = checkCompat(docWithBarcode(), COMPAT_MATRICES.pdfme);
    expect(findings[0]?.userMessage).toContain("バーコードは指定した幅・高さ");
  });

  it("returns en messages for locale: en", () => {
    const findings = checkCompat(docWithBarcode(), COMPAT_MATRICES.pdfme, {
      locale: "en",
    });
    expect(findings[0]?.userMessage).toContain(
      "A barcode is displayed to fit the specified width and height",
    );
  });
});
