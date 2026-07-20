import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface ExtractedTextItem {
  readonly str: string;
  readonly x: number;
  readonly baselineY: number;
  readonly width: number;
}

export interface ExtractedPage {
  readonly textItems: readonly ExtractedTextItem[];
  readonly imageDrawCount: number;
}

export interface ExtractedPdf {
  readonly pageCount: number;
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly pages: readonly ExtractedPage[];
}

const MM_PER_PT = 25.4 / 72;

export async function extractPdf(data: Uint8Array): Promise<ExtractedPdf> {
  // pdf.js may invalidate the passed buffer via transfer, so copy it to protect the caller's PDF byte array
  const loadingTask = getDocument({ data: data.slice() });
  const doc = await loadingTask.promise;
  try {
    const first = await doc.getPage(1);
    const viewport = first.getViewport({ scale: 1 });
    const pageHeightMm = viewport.height * MM_PER_PT;

    const pages: ExtractedPage[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const textItems = content.items.flatMap((item) => {
        if (!("transform" in item)) return [];
        return [
          {
            str: item.str,
            x: (item.transform[4] as number) * MM_PER_PT,
            baselineY: pageHeightMm - (item.transform[5] as number) * MM_PER_PT,
            width: item.width * MM_PER_PT,
          },
        ];
      });
      const opList = await page.getOperatorList();
      const imageDrawCount = opList.fnArray.filter(
        (fn) =>
          fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat,
      ).length;
      pages.push({ textItems, imageDrawCount });
    }

    return {
      pageCount: doc.numPages,
      pageWidth: viewport.width * MM_PER_PT,
      pageHeight: pageHeightMm,
      pages,
    };
  } finally {
    await loadingTask.destroy();
  }
}
