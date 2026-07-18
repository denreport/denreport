import type { IrData, IrDocument } from "@denreport/core";
import type { Font, Template } from "@pdfme/common";
import { generate } from "@pdfme/generator";
import {
  barcodes,
  ellipse,
  image,
  line,
  rectangle,
  text,
} from "@pdfme/schemas";
import { validateFont } from "../../src/fonts/validate";
import { exportPdfme } from "../../src/pdfme/export";
import { buildPdfmeFont } from "../../src/pdfme/font";

export async function generatePdfmePdf(
  document: IrDocument,
  data: IrData,
  fontData: Uint8Array,
): Promise<Uint8Array> {
  const fontIssues = validateFont(fontData);
  if (fontIssues.length > 0) {
    throw new Error(
      `invalid font: ${fontIssues.map((issue) => issue.message).join(", ")}`,
    );
  }
  const result = exportPdfme(document, data, fontData);
  if (!result.ok) {
    throw new Error(
      `exportPdfme failed: ${result.errors.map((e) => `${e.rule} ${e.message}`).join(", ")}`,
    );
  }
  return generate({
    template: result.template as unknown as Template,
    inputs: [{ ...result.inputs[0] }],
    options: {
      font: buildPdfmeFont(document.font.name, fontData) as unknown as Font,
    },
    plugins: { text, line, rectangle, ellipse, image, ...barcodes },
  });
}
