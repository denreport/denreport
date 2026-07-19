import type {
  IrData,
  IrDocument,
  IrFont,
  IrFontSlot,
  LoweredDocument,
  LoweredElement,
  LoweredTextElement,
} from "@denreport/core";
import { layoutTextLines, lowerIr, resolveFontSlot } from "@denreport/core";
import type { FontSetData, ResolvedSlotFont } from "../fonts/set";
import { effectiveFontOf, resolveFontSetData } from "../fonts/set";
import { pyNumber } from "./python";
import type { ReportlabFontEntry } from "./snippets";
import {
  BARCODE_FN,
  buildFontsConstant,
  buildImports,
  ELLIPSE_FN,
  fontEntriesFor,
  IMAGE_FN,
  LINE_FN,
  MAIN_BLOCK,
  RECT_FN,
  REGISTER_FONTS_FN,
  statementFor,
  TEXT_FN,
} from "./snippets";
import type { ExportReportlabResult } from "./types";

function usedTypes(
  pages: readonly (readonly LoweredElement[])[],
): ReadonlySet<LoweredElement["type"]> {
  const types = new Set<LoweredElement["type"]>();
  for (const page of pages) {
    for (const element of page) types.add(element.type);
  }
  return types;
}

function buildHeader(hasImage: boolean): string {
  const requirement = hasImage
    ? "実行要件: Python 3, reportlab, Pillow（画像の描画に使用）"
    : "実行要件: Python 3, reportlab";
  return [
    '"""生成物であり、手編集を想定しない。',
    "",
    requirement,
    "",
    "フォント: 書き出し時に併せて出力されるフォントファイル（FONTS の各ファイル）を",
    "このファイルと同じディレクトリに置くこと。見つからない場合はエラー終了する。",
    "",
    "使い方: python <このファイル> [出力.pdf]（省略時 output.pdf）",
    '"""',
  ].join("\n");
}

function buildConstants(
  lowered: LoweredDocument,
  entries: readonly ReportlabFontEntry[],
): string {
  return [
    buildFontsConstant(entries),
    `PAGE_WIDTH = ${pyNumber(lowered.page.width)} * mm`,
    `PAGE_HEIGHT = ${pyNumber(lowered.page.height)} * mm`,
    `PAGE_COUNT = ${pyNumber(lowered.pageCount)}`,
  ].join("\n");
}

function buildPageFunction(
  index: number,
  elements: readonly LoweredElement[],
  layoutLines: (el: LoweredTextElement) => readonly string[],
  font: IrFont,
): string {
  const body =
    elements.length === 0
      ? "    pass"
      : elements
          .map((element) => `    ${statementFor(element, layoutLines, font)}`)
          .join("\n");
  return `def _page_${index + 1}(c):\n${body}`;
}

function buildBuildFunction(pageCount: number): string {
  const lines = [
    "def build(output_path):",
    "    _register_fonts()",
    "    c = Canvas(output_path, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))",
  ];
  for (let p = 1; p <= pageCount; p++) {
    lines.push(`    _page_${p}(c)`);
    lines.push("    c.showPage()");
  }
  lines.push("    c.save()");
  return lines.join("\n");
}

function buildSource(
  lowered: LoweredDocument,
  font: IrFont,
  slots: ReadonlyMap<IrFontSlot, ResolvedSlotFont>,
  entries: readonly ReportlabFontEntry[],
): string {
  const types = usedTypes(lowered.pages);
  const hasImage = types.has("image");
  const hasBarcode = types.has("barcode");

  const helperFns = [
    REGISTER_FONTS_FN,
    ...(types.has("text") ? [TEXT_FN] : []),
    ...(types.has("line") ? [LINE_FN] : []),
    ...(types.has("rect") ? [RECT_FN] : []),
    ...(types.has("ellipse") ? [ELLIPSE_FN] : []),
    ...(hasImage ? [IMAGE_FN] : []),
    ...(hasBarcode ? [BARCODE_FN] : []),
  ];
  const layoutLines = (el: LoweredTextElement): readonly string[] => {
    const slot = resolveFontSlot(font, el.fontWeight, el.fontStyle);
    // effectiveFontOf により解決先スロットのデータ存在は保証される
    const slotFont = slots.get(slot) as ResolvedSlotFont;
    return layoutTextLines(
      {
        content: el.content,
        widthMm: el.w,
        fontSize: el.fontSize,
        align: el.align,
      },
      slotFont.charWidthEm,
    ).map((line) => line.text);
  };
  const pageFns = lowered.pages.map((elements, index) =>
    buildPageFunction(index, elements, layoutLines, font),
  );

  const sections = [
    buildHeader(hasImage),
    buildImports(hasImage, false, hasBarcode),
    buildConstants(lowered, entries),
    helperFns.join("\n\n"),
    pageFns.join("\n\n"),
    buildBuildFunction(lowered.pageCount),
    MAIN_BLOCK,
  ];

  return `${sections.join("\n\n")}\n`;
}

/**
 * Lowers `document` with `data` and generates a standalone reportlab Python
 * script with the interpolated data baked in, plus the font files it
 * references (one per declared slot). Every slot in `fonts` must be a valid
 * TTF with readable metrics; otherwise export fails with fontIssues
 * explaining why. Assumes `document` is the output of parseIr and already
 * passed validateIr, matching lowerIr's precondition.
 */
export function exportReportlab(
  document: IrDocument,
  data: IrData,
  fonts: FontSetData,
): ExportReportlabResult {
  const fontSet = resolveFontSetData(fonts);
  const result = lowerIr(document, data);
  if (!fontSet.ok || !result.ok) {
    return {
      ok: false,
      errors: result.ok ? [] : result.errors,
      fontIssues: fontSet.ok ? [] : fontSet.issues,
    };
  }
  const font = effectiveFontOf(document.font, fonts);
  const entries = fontEntriesFor(font, fonts, fontSet.slots);
  return {
    ok: true,
    code: buildSource(result.document, font, fontSet.slots, entries),
    fontFiles: entries.map((entry) => ({
      filename: entry.filename,
      data: entry.data,
    })),
    warnings: result.warnings,
  };
}
