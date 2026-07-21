import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { IrData, IrDocument } from "@denreport/core";
import { parseIr } from "@denreport/core";
import { describe, expect, it } from "vitest";
import { EMBEDDED_FONT_URL } from "../src/fonts/embedded";
import { checkAgainstReference, checkCrossTarget } from "./helpers/equivalence";
import type { ExtractedPdf } from "./helpers/pdf-text";
import { extractPdf } from "./helpers/pdf-text";
import { generatePdfmePdf } from "./helpers/pdfme-generate";
import { buildReferenceExpectation } from "./helpers/reference-text";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const fixturesDir = fileURLToPath(new URL("fixtures", import.meta.url));
const coreFixturesDir = fileURLToPath(
  new URL("../../core/tests/fixtures", import.meta.url),
);
const outputDir = fileURLToPath(new URL("output", import.meta.url));

const reportlabPdfDir = process.env.REPORTLAB_PDF_DIR;

function loadFixture(
  irFile: string,
  dataFile: string,
): { document: IrDocument; data: IrData } {
  const parsed = parseIr(readFileSync(`${coreFixturesDir}/${irFile}`, "utf-8"));
  if (!parsed.ok) throw new Error(`invalid IR fixture: ${irFile}`);
  const data = JSON.parse(
    readFileSync(`${fixturesDir}/${dataFile}`, "utf-8"),
  ) as IrData;
  return { document: parsed.document, data };
}

describe.skipIf(reportlabPdfDir === undefined || reportlabPdfDir === "")(
  "ReportLab real PDFs — reference conformance and cross-target comparison",
  () => {
    const pdfDir = isAbsolute(reportlabPdfDir ?? "")
      ? (reportlabPdfDir ?? "")
      : resolve(packageRoot, reportlabPdfDir ?? "");
    const fontData = new Uint8Array(readFileSync(EMBEDDED_FONT_URL));

    it.each([
      {
        name: "invoice",
        irFile: "invoice.json",
        dataFile: "invoice-data.json",
      },
      {
        name: "invoice-multipage",
        irFile: "invoice-multipage.json",
        dataFile: "invoice-multipage-data.json",
      },
      {
        name: "table-merge",
        irFile: "table-merge.json",
        dataFile: "table-merge-data.json",
      },
    ])("$name", async ({ name, irFile, dataFile }) => {
      const { document, data } = loadFixture(irFile, dataFile);
      const expectation = buildReferenceExpectation(document, data, fontData);

      const reportlabPdf = await extractPdf(
        new Uint8Array(readFileSync(resolve(pdfDir, `reportlab-${name}.pdf`))),
      );
      expect(checkAgainstReference(reportlabPdf, expectation)).toEqual([]);

      const pdfmeBytes = await generatePdfmePdf(document, data, {
        regular: fontData,
      });
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(`${outputDir}/pdfme-${name}.pdf`, pdfmeBytes);
      const pdfmePdf = await extractPdf(pdfmeBytes);
      expect(checkCrossTarget(pdfmePdf, reportlabPdf, expectation)).toEqual([]);
    });

    it("table-merge: PDF from the template path (runtime data) matches lowerIr's reference semantics", async () => {
      const { document, data } = loadFixture(
        "table-merge.json",
        "table-merge-data.json",
      );
      const expectation = buildReferenceExpectation(document, data, fontData);

      const templatePdf = await extractPdf(
        new Uint8Array(
          readFileSync(resolve(pdfDir, "reportlab-template-table-merge.pdf")),
        ),
      );
      expect(checkAgainstReference(templatePdf, expectation)).toEqual([]);

      const loweredPathPdf = await extractPdf(
        new Uint8Array(
          readFileSync(resolve(pdfDir, "reportlab-table-merge.pdf")),
        ),
      );
      expect(
        checkCrossTarget(templatePdf, loweredPathPdf, expectation),
      ).toEqual([]);
    });

    const MM_PER_PT = 25.4 / 72;
    const EMBEDDED_ASCENT_PER_EM = 1.16;

    // Where the reference baseline origin maps to for text rotated by the IR's rotate (clockwise, about the bounding box center)
    function rotatedBaselineOrigin(
      el: { x: number; y: number; w: number; h: number },
      fontSize: number,
      lineHeight: number,
      deg: number,
    ): { x: number; y: number } {
      const origin = {
        x: el.x,
        y:
          el.y +
          (EMBEDDED_ASCENT_PER_EM + (lineHeight - 1) / 2) *
            fontSize *
            MM_PER_PT,
      };
      const center = { x: el.x + el.w / 2, y: el.y + el.h / 2 };
      const rad = (deg * Math.PI) / 180;
      const dx = origin.x - center.x;
      const dy = origin.y - center.y;
      return {
        x: center.x + dx * Math.cos(rad) - dy * Math.sin(rad),
        y: center.y + dx * Math.sin(rad) + dy * Math.cos(rad),
      };
    }

    function findItem(
      pdf: ExtractedPdf,
      text: string,
    ): { x: number; baselineY: number } {
      const item = pdf.pages[0]?.textItems.find((i) => i.str.trim() === text);
      if (item === undefined) throw new Error(`text item "${text}" not found`);
      return item;
    }

    it("rotation: rotated text origin matches the mapped position in both targets", async () => {
      const { document, data } = loadFixture(
        "rotation.json",
        "rotation-data.json",
      );
      const reportlabPdf = await extractPdf(
        new Uint8Array(readFileSync(resolve(pdfDir, "reportlab-rotation.pdf"))),
      );
      const pdfmeBytes = await generatePdfmePdf(document, data, {
        regular: fontData,
      });
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(`${outputDir}/pdfme-rotation.pdf`, pdfmeBytes);
      const pdfmePdf = await extractPdf(pdfmeBytes);

      const cases = [
        { text: "R", el: { x: 20, y: 100, w: 60, h: 10 }, deg: 90 },
        { text: "U", el: { x: 100, y: 100, w: 60, h: 10 }, deg: 180 },
      ];
      for (const { text, el, deg } of cases) {
        const expected = rotatedBaselineOrigin(el, 12, 1.25, deg);
        for (const pdf of [reportlabPdf, pdfmePdf]) {
          const item = findItem(pdf, text);
          expect(Math.abs(item.x - expected.x)).toBeLessThan(1);
          expect(Math.abs(item.baselineY - expected.y)).toBeLessThan(1);
        }
        const a = findItem(reportlabPdf, text);
        const b = findItem(pdfmePdf, text);
        expect(Math.abs(a.x - b.x)).toBeLessThan(1);
        expect(Math.abs(a.baselineY - b.baselineY)).toBeLessThan(1);
      }
    });
  },
);
