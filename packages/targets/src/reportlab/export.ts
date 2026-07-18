import type {
  CharWidthEm,
  IrData,
  IrDocument,
  LoweredDocument,
  LoweredElement,
  LoweredTextElement,
} from "@denreport/core";
import { layoutTextLines, lowerIr } from "@denreport/core";
import { detectFontFormat } from "../fonts/format";
import { readAscentPerEm } from "../fonts/metrics";
import type { FontIssue } from "../fonts/validate";
import { validateFont } from "../fonts/validate";
import { readCharWidths } from "../fonts/widths";
import { pyNumber, pyString } from "./python";
import {
  BARCODE_FN,
  buildImports,
  ELLIPSE_FN,
  IMAGE_FN,
  LINE_FN,
  MAIN_BLOCK,
  RECT_FN,
  REGISTER_FONT_FN,
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
    "フォント: 書き出し時に併せて出力されるフォントファイル（FONT_FILE）を",
    "このファイルと同じディレクトリに置くこと。見つからない場合はエラー終了する。",
    "",
    "使い方: python <このファイル> [出力.pdf]（省略時 output.pdf）",
    '"""',
  ].join("\n");
}

function buildConstants(lowered: LoweredDocument, ascentPerEm: number): string {
  return [
    `FONT_NAME = ${pyString(lowered.font.name)}`,
    `FONT_FILE = ${pyString(`${lowered.font.name}.ttf`)}`,
    `FONT_ASCENT_EM = ${pyNumber(ascentPerEm)}`,
    `PAGE_WIDTH = ${pyNumber(lowered.page.width)} * mm`,
    `PAGE_HEIGHT = ${pyNumber(lowered.page.height)} * mm`,
    `PAGE_COUNT = ${pyNumber(lowered.pageCount)}`,
  ].join("\n");
}

function buildPageFunction(
  index: number,
  elements: readonly LoweredElement[],
  layoutLines: (el: LoweredTextElement) => readonly string[],
): string {
  const body =
    elements.length === 0
      ? "    pass"
      : elements
          .map((element) => `    ${statementFor(element, layoutLines)}`)
          .join("\n");
  return `def _page_${index + 1}(c, font):\n${body}`;
}

function buildBuildFunction(pageCount: number): string {
  const lines = [
    "def build(output_path):",
    "    font = _register_font()",
    "    c = Canvas(output_path, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))",
  ];
  for (let p = 1; p <= pageCount; p++) {
    lines.push(`    _page_${p}(c, font)`);
    lines.push("    c.showPage()");
  }
  lines.push("    c.save()");
  return lines.join("\n");
}

function buildSource(
  lowered: LoweredDocument,
  ascentPerEm: number,
  charWidthEm: CharWidthEm,
): string {
  const types = usedTypes(lowered.pages);
  const hasImage = types.has("image");
  const hasBarcode = types.has("barcode");

  const helperFns = [
    REGISTER_FONT_FN,
    ...(types.has("text") ? [TEXT_FN] : []),
    ...(types.has("line") ? [LINE_FN] : []),
    ...(types.has("rect") ? [RECT_FN] : []),
    ...(types.has("ellipse") ? [ELLIPSE_FN] : []),
    ...(hasImage ? [IMAGE_FN] : []),
    ...(hasBarcode ? [BARCODE_FN] : []),
  ];
  const layoutLines = (el: LoweredTextElement): readonly string[] =>
    layoutTextLines(
      {
        content: el.content,
        widthMm: el.w,
        fontSize: el.fontSize,
        align: el.align,
      },
      charWidthEm,
    ).map((line) => line.text);
  const pageFns = lowered.pages.map((elements, index) =>
    buildPageFunction(index, elements, layoutLines),
  );

  const sections = [
    buildHeader(hasImage),
    buildImports(hasImage, false, hasBarcode),
    buildConstants(lowered, ascentPerEm),
    helperFns.join("\n\n"),
    pageFns.join("\n\n"),
    buildBuildFunction(lowered.pageCount),
    MAIN_BLOCK,
  ];

  return `${sections.join("\n\n")}\n`;
}

/**
 * Lowers `document` with `data` and generates a standalone reportlab Python
 * script with the interpolated data baked in, plus the font file it
 * references. `fontData` must be a valid TTF; otherwise export fails with
 * fontIssues explaining why. Assumes `document` is the output of parseIr and
 * already passed validateIr, matching lowerIr's precondition.
 */
export function exportReportlab(
  document: IrDocument,
  data: IrData,
  fontData: Uint8Array,
): ExportReportlabResult {
  const fontIssues: FontIssue[] = [...validateFont(fontData)];
  const ascentPerEm = readAscentPerEm(fontData);
  const charWidthEm = readCharWidths(fontData);
  if (fontIssues.length === 0 && ascentPerEm === null) {
    fontIssues.push({
      format: detectFontFormat(fontData),
      message:
        "フォントの計量（head / hhea テーブル）を読み取れないため、テキストのベースライン位置を確定できません。別の TTF フォントを使用してください。",
    });
  }
  if (fontIssues.length === 0 && charWidthEm === null) {
    fontIssues.push({
      format: detectFontFormat(fontData),
      message:
        "フォントの字幅（cmap / hmtx テーブル）を読み取れないため、テキストの折り返し・均等割付を計算できません。別の TTF フォントを使用してください。",
    });
  }
  const result = lowerIr(document, data);
  if (
    fontIssues.length > 0 ||
    ascentPerEm === null ||
    charWidthEm === null ||
    !result.ok
  ) {
    return { ok: false, errors: result.ok ? [] : result.errors, fontIssues };
  }
  return {
    ok: true,
    code: buildSource(result.document, ascentPerEm, charWidthEm),
    fontFile: {
      filename: `${result.document.font.name}.ttf`,
      data: fontData,
    },
    warnings: result.warnings,
  };
}
