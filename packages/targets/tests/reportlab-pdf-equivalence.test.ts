import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { IrData, IrDocument } from "@denreport/core";
import { parseIr } from "@denreport/core";
import { describe, expect, it } from "vitest";
import { EMBEDDED_FONT_URL } from "../src/fonts/embedded";
import { checkAgainstReference, checkCrossTarget } from "./helpers/equivalence";
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
  "ReportLab 実 PDF — 参照適合とクロスターゲット照合",
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
    ])("$name", async ({ name, irFile, dataFile }) => {
      const { document, data } = loadFixture(irFile, dataFile);
      const expectation = buildReferenceExpectation(document, data, fontData);

      const reportlabPdf = await extractPdf(
        new Uint8Array(readFileSync(resolve(pdfDir, `reportlab-${name}.pdf`))),
      );
      expect(checkAgainstReference(reportlabPdf, expectation)).toEqual([]);

      const pdfmeBytes = await generatePdfmePdf(document, data, fontData);
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(`${outputDir}/pdfme-${name}.pdf`, pdfmeBytes);
      const pdfmePdf = await extractPdf(pdfmeBytes);
      expect(checkCrossTarget(pdfmePdf, reportlabPdf, expectation)).toEqual([]);
    });
  },
);
