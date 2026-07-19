import { describe, expect, it } from "vitest";
import { checkCompat } from "../src/compat/check";
import { COMPAT_MATRICES } from "../src/compat/registry";
import type { CompatTargetId } from "../src/compat/types";
import { parseIr } from "../src/ir/parse";
import invoiceFixture from "./fixtures/invoice.json";
import invoiceMultipageFixture from "./fixtures/invoice-multipage.json";

describe("COMPAT_MATRICES data invariants", () => {
  for (const [target, matrix] of Object.entries(COMPAT_MATRICES)) {
    describe(target, () => {
      it("declares its own target id as the registry key", () => {
        expect(matrix.target).toBe(target as CompatTargetId);
      });

      it("gives a non-empty note and userMessage (ja and en) to every approximated/unsupported entry", () => {
        for (const [elementType, elementCompat] of Object.entries(
          matrix.elements,
        )) {
          const entries = [
            elementCompat.element,
            ...Object.values(elementCompat.attributes ?? {}),
          ];
          for (const entry of entries) {
            if (entry === undefined || entry.level === "supported") continue;
            expect(
              entry.note.length,
              `${target}.${elementType}: empty note for level "${entry.level}"`,
            ).toBeGreaterThan(0);
            for (const locale of ["ja", "en"] as const) {
              expect(
                entry.userMessage(locale).length,
                `${target}.${elementType}: empty ${locale} userMessage for level "${entry.level}"`,
              ).toBeGreaterThan(0);
            }
          }
        }
      });
    });
  }
});

function parse(fixture: unknown) {
  const result = parseIr(JSON.stringify(fixture));
  if (!result.ok)
    throw new Error(
      `fixture failed to parse: ${JSON.stringify(result.errors)}`,
    );
  return result.document;
}

function summarize(target: CompatTargetId, fixture: unknown) {
  const document = parse(fixture);
  const matrix = COMPAT_MATRICES[target];
  return checkCompat(document, matrix).map((f) => ({
    elementId: f.elementId,
    level: f.level,
    attribute: f.attribute,
  }));
}

describe("golden fixture judgments", () => {
  it("invoice.json against pdfme: complex-page-layout elements stay compatible, drawing details are approximated", () => {
    expect(summarize("pdfme", invoiceFixture)).toEqual([
      { elementId: "title", level: "approximated", attribute: undefined },
      { elementId: "issuerName", level: "approximated", attribute: undefined },
      { elementId: "issuerAddr", level: "approximated", attribute: undefined },
      {
        elementId: "customerUnderline",
        level: "approximated",
        attribute: "thickness",
      },
      { elementId: "items", level: "approximated", attribute: undefined },
      { elementId: "totalLabel", level: "approximated", attribute: undefined },
      {
        elementId: "totalBox",
        level: "approximated",
        attribute: "borderWidth",
      },
      { elementId: "pageNo", level: "approximated", attribute: undefined },
    ]);
  });

  it("invoice.json against reportlab: same as pdfme, plus the image src exception", () => {
    expect(summarize("reportlab", invoiceFixture)).toEqual([
      { elementId: "title", level: "approximated", attribute: undefined },
      { elementId: "logo", level: "approximated", attribute: "src" },
      { elementId: "issuerName", level: "approximated", attribute: undefined },
      { elementId: "issuerAddr", level: "approximated", attribute: undefined },
      {
        elementId: "customerUnderline",
        level: "approximated",
        attribute: "thickness",
      },
      { elementId: "items", level: "approximated", attribute: undefined },
      { elementId: "totalLabel", level: "approximated", attribute: undefined },
      {
        elementId: "totalBox",
        level: "approximated",
        attribute: "borderWidth",
      },
      { elementId: "pageNo", level: "approximated", attribute: undefined },
    ]);
  });

  it("never reports 'unsupported' for a document combining a multi-page table, pageNumber, and absolutely-positioned elements", () => {
    for (const target of Object.keys(COMPAT_MATRICES) as CompatTargetId[]) {
      const findings = summarize(target, invoiceMultipageFixture);
      expect(findings.some((f) => f.level === "unsupported")).toBe(false);
      expect(findings.map((f) => f.elementId)).toContain("items");
      expect(findings.map((f) => f.elementId)).toContain("pageNo");
    }
  });
});
