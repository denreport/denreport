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
import type { FontSetData } from "../../src/fonts/set";
import { exportPdfme } from "../../src/pdfme/export";
import { buildPdfmeFontMap } from "../../src/pdfme/font";

export async function generatePdfmePdf(
  document: IrDocument,
  data: IrData,
  fonts: FontSetData,
): Promise<Uint8Array> {
  const result = exportPdfme(document, data, fonts);
  if (!result.ok) {
    const detail = [
      ...result.errors.map((e) => `${e.rule} ${e.message}`),
      ...result.fontIssues.map((issue) => issue.message),
    ].join(", ");
    throw new Error(`exportPdfme failed: ${detail}`);
  }
  return generate({
    template: result.template as unknown as Template,
    inputs: [{ ...result.inputs[0] }],
    options: {
      font: buildPdfmeFontMap(document.font, fonts) as unknown as Font,
    },
    plugins: { text, line, rectangle, ellipse, image, ...barcodes },
  });
}
