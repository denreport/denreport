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
import {
  getMessages,
  type MessageLocale,
  type Messages,
} from "../i18n/messages";
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
  registerFontsFn,
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

function buildHeader(messages: Messages, hasImage: boolean): string {
  const requirement = hasImage
    ? messages.reportlab.header.requirementWithImage
    : messages.reportlab.header.requirement;
  return [
    `"""${messages.reportlab.header.notice}`,
    "",
    requirement,
    "",
    messages.reportlab.header.fontNoticeLine1,
    messages.reportlab.header.fontNoticeLine2,
    "",
    messages.reportlab.header.usage,
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
  messages: Messages,
): string {
  const types = usedTypes(lowered.pages);
  const hasImage = types.has("image");
  const hasBarcode = types.has("barcode");

  const helperFns = [
    registerFontsFn(messages),
    ...(types.has("text") ? [TEXT_FN] : []),
    ...(types.has("line") ? [LINE_FN] : []),
    ...(types.has("rect") ? [RECT_FN] : []),
    ...(types.has("ellipse") ? [ELLIPSE_FN] : []),
    ...(hasImage ? [IMAGE_FN] : []),
    ...(hasBarcode ? [BARCODE_FN] : []),
  ];
  const layoutLines = (el: LoweredTextElement): readonly string[] => {
    const slot = resolveFontSlot(font, el.fontWeight, el.fontStyle);
    // effectiveFontOf guarantees that data exists for the resolved slot
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
    buildHeader(messages, hasImage),
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
 * passed validateIr, matching lowerIr's precondition. `options.locale`
 * (default "ja") selects the language of the generated script's comments
 * and error messages.
 */
export function exportReportlab(
  document: IrDocument,
  data: IrData,
  fonts: FontSetData,
  options?: { readonly locale?: MessageLocale },
): ExportReportlabResult {
  const locale = options?.locale ?? "ja";
  const fontSet = resolveFontSetData(fonts, { locale });
  const result = lowerIr(document, data, { locale });
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
    code: buildSource(
      result.document,
      font,
      fontSet.slots,
      entries,
      getMessages(locale),
    ),
    fontFiles: entries.map((entry) => ({
      filename: entry.filename,
      data: entry.data,
    })),
    warnings: result.warnings,
  };
}
