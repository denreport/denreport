import type { IrData, IrDocument } from "@denreport/core";
import { layoutTextLines, lowerIr } from "@denreport/core";
import { readAscentPerEm } from "../../src/fonts/metrics";
import { readCharWidths } from "../../src/fonts/widths";

export interface ExpectedLine {
  readonly page: number;
  readonly text: string;
  readonly x: number;
  readonly w: number;
  readonly baselineY: number;
}

export interface ReferenceExpectation {
  readonly pageCount: number;
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly lines: readonly ExpectedLine[];
  readonly imageCountByPage: readonly number[];
}

const MM_PER_PT = 25.4 / 72;

export function buildReferenceExpectation(
  document: IrDocument,
  data: IrData,
  fontData: Uint8Array,
): ReferenceExpectation {
  const ascentPerEm = readAscentPerEm(fontData);
  if (ascentPerEm === null) {
    throw new Error("could not read head/hhea metrics from the font");
  }
  const charWidthEm = readCharWidths(fontData);
  if (charWidthEm === null) {
    throw new Error("could not read cmap/hmtx metrics from the font");
  }
  const result = lowerIr(document, data);
  if (!result.ok) {
    throw new Error(
      `lowerIr failed: ${result.errors.map((e) => `${e.rule} ${e.message}`).join(", ")}`,
    );
  }
  const lowered = result.document;

  const lines: ExpectedLine[] = [];
  const imageCountByPage: number[] = [];
  lowered.pages.forEach((elements, pageIndex) => {
    let imageCount = 0;
    for (const element of elements) {
      if (element.type === "image") {
        imageCount += 1;
        continue;
      }
      if (element.type !== "text") continue;
      const laidOut = layoutTextLines(
        {
          content: element.content,
          widthMm: element.w,
          fontSize: element.fontSize,
          align: element.align,
        },
        charWidthEm,
      );
      laidOut.forEach(({ text }, lineIndex) => {
        if (text === "") return;
        const baselineOffsetPt =
          (ascentPerEm +
            (element.lineHeight - 1) / 2 +
            lineIndex * element.lineHeight) *
          element.fontSize;
        lines.push({
          page: pageIndex + 1,
          text,
          x: element.x,
          w: element.w,
          baselineY: element.y + baselineOffsetPt * MM_PER_PT,
        });
      });
    }
    imageCountByPage.push(imageCount);
  });

  return {
    pageCount: lowered.pageCount,
    pageWidth: lowered.page.width,
    pageHeight: lowered.page.height,
    lines,
    imageCountByPage,
  };
}
