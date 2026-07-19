import type {
  IrBarcodeSymbology,
  IrFont,
  IrFontSlot,
  IrStrokeStyle,
  LoweredElement,
  LoweredTextElement,
} from "@denreport/core";
import { resolveFontSlot, STROKE_DASH_MM } from "@denreport/core";
import type { FontSetData, ResolvedSlotFont } from "../fonts/set";
import { FONT_SLOTS } from "../fonts/set";
import { pyBool, pyNumber, pyRgb, pyString } from "./python";

// createBarcodeDrawing の規格名（reportlab.graphics.barcode.getCodeNames() の表記）
export const REPORTLAB_BARCODE_NAMES: Readonly<
  Record<IrBarcodeSymbology, string>
> = {
  qrcode: "QR",
  code39: "Standard39",
  code128: "Code128",
  ean13: "EAN13",
};

/** One registered font of the generated script: its logical name, bundled file name, ascent, and data. */
export interface ReportlabFontEntry {
  readonly name: string;
  readonly filename: string;
  readonly ascentPerEm: number;
  readonly data: Uint8Array;
}

/**
 * Collects the font entries the generated script registers: one per slot
 * declared in `font` with data present, deduplicated by logical name.
 */
export function fontEntriesFor(
  font: IrFont,
  fonts: FontSetData,
  slots: ReadonlyMap<IrFontSlot, ResolvedSlotFont>,
): readonly ReportlabFontEntry[] {
  const entries: ReportlabFontEntry[] = [];
  const seen = new Set<string>();
  for (const slot of FONT_SLOTS) {
    const name = font[slot];
    const data = fonts[slot];
    const resolved = slots.get(slot);
    if (name === undefined || data === undefined || resolved === undefined)
      continue;
    if (seen.has(name)) continue;
    seen.add(name);
    entries.push({
      name,
      filename: `${name}.ttf`,
      ascentPerEm: resolved.ascentPerEm,
      data,
    });
  }
  return entries;
}

/** Renders the FONTS constant (logical name → bundled file name and ascent) of the generated script. */
export function buildFontsConstant(
  entries: readonly ReportlabFontEntry[],
): string {
  const body = entries
    .map(
      (entry) =>
        `    ${pyString(entry.name)}: (${pyString(entry.filename)}, ${pyNumber(entry.ascentPerEm)}),`,
    )
    .join("\n");
  return `FONTS = {\n${body}\n}`;
}

export const REGISTER_FONTS_FN = [
  "def _register_fonts():",
  "    base_dir = os.path.dirname(os.path.abspath(__file__))",
  "    for name, (file, _) in FONTS.items():",
  "        font_path = os.path.join(base_dir, file)",
  "        if not os.path.exists(font_path):",
  '            sys.exit(f"フォントファイルが見つかりません: {font_path}（このファイルと同じディレクトリに置くこと）")',
  "        pdfmetrics.registerFont(TTFont(name, font_path))",
].join("\n");

// IR の rotate は y 下向き座標系での時計回り正。PDF 座標系は y 上向きのため、
// 各描画関数は c.rotate に符号を反転した -rot を渡して見た目の回転方向を一致させる
export const TEXT_FN = [
  "def _text(c, font, x, y, w, h, size, align, line_height, color, rot, underline, lines):",
  "    c.saveState()",
  "    if rot:",
  "        cx, cy = (x + w / 2) * mm, PAGE_HEIGHT - (y + h / 2) * mm",
  "        c.translate(cx, cy)",
  "        c.rotate(-rot)",
  "        c.translate(-cx, -cy)",
  "    c.setFont(font, size)",
  "    c.setFillColorRGB(*color)",
  "    ascent = FONTS[font][1]",
  "    for i, line in enumerate(lines):",
  "        baseline = PAGE_HEIGHT - y * mm - (ascent + (line_height - 1) / 2 + i * line_height) * size",
  "        width = pdfmetrics.stringWidth(line, font, size)",
  '        if align == "justify":',
  "            n = len(line)",
  "            t = c.beginText(x * mm, baseline)",
  "            t.setFont(font, size)",
  "            stretched = n >= 2 and width < w * mm",
  "            if stretched:",
  "                t.setCharSpace((w * mm - width) / (n - 1))",
  "            t.textOut(line)",
  "            c.drawText(t)",
  "            line_x, line_w = x * mm, (w * mm if stretched else width)",
  '        elif align == "left":',
  "            c.drawString(x * mm, baseline, line)",
  "            line_x, line_w = x * mm, width",
  '        elif align == "center":',
  "            c.drawCentredString((x + w / 2) * mm, baseline, line)",
  "            line_x, line_w = (x + w / 2) * mm - width / 2, width",
  "        else:",
  "            c.drawRightString((x + w) * mm, baseline, line)",
  "            line_x, line_w = (x + w) * mm - width, width",
  "        if underline and line_w > 0:",
  "            c.setStrokeColorRGB(*color)",
  "            c.setLineWidth(0.05 * size)",
  "            c.line(line_x, baseline - 0.1 * size, line_x + line_w, baseline - 0.1 * size)",
  "    c.restoreState()",
].join("\n");

export const LINE_FN = [
  "def _line(c, x1, y1, x2, y2, thickness, color, dash, rot):",
  "    c.saveState()",
  "    if rot:",
  "        cx, cy = (x1 + x2) / 2 * mm, PAGE_HEIGHT - (y1 + y2) / 2 * mm",
  "        c.translate(cx, cy)",
  "        c.rotate(-rot)",
  "        c.translate(-cx, -cy)",
  "    c.setLineWidth(thickness * mm)",
  "    c.setStrokeColorRGB(*color)",
  "    if dash is not None:",
  "        c.setDash(dash)",
  "    c.line(x1 * mm, PAGE_HEIGHT - y1 * mm, x2 * mm, PAGE_HEIGHT - y2 * mm)",
  "    c.restoreState()",
].join("\n");

export const RECT_FN = [
  "def _rect(c, x, y, w, h, border_width, border_color, fill_color, dash, radius, rot):",
  "    c.saveState()",
  "    if rot:",
  "        cx, cy = (x + w / 2) * mm, PAGE_HEIGHT - (y + h / 2) * mm",
  "        c.translate(cx, cy)",
  "        c.rotate(-rot)",
  "        c.translate(-cx, -cy)",
  "    c.setLineWidth(border_width * mm)",
  "    c.setStrokeColorRGB(*border_color)",
  "    if fill_color is not None:",
  "        c.setFillColorRGB(*fill_color)",
  "    if dash is not None:",
  "        c.setDash(dash)",
  "    stroke = 1 if border_width > 0 else 0",
  "    fill = 1 if fill_color is not None else 0",
  "    if radius > 0:",
  "        c.roundRect(x * mm, PAGE_HEIGHT - (y + h) * mm, w * mm, h * mm, radius * mm, stroke=stroke, fill=fill)",
  "    else:",
  "        c.rect(x * mm, PAGE_HEIGHT - (y + h) * mm, w * mm, h * mm, stroke=stroke, fill=fill)",
  "    c.restoreState()",
].join("\n");

export const ELLIPSE_FN = [
  "def _ellipse(c, x, y, w, h, border_width, border_color, fill_color, rot):",
  "    c.saveState()",
  "    if rot:",
  "        cx, cy = (x + w / 2) * mm, PAGE_HEIGHT - (y + h / 2) * mm",
  "        c.translate(cx, cy)",
  "        c.rotate(-rot)",
  "        c.translate(-cx, -cy)",
  "    c.setLineWidth(border_width * mm)",
  "    c.setStrokeColorRGB(*border_color)",
  "    if fill_color is not None:",
  "        c.setFillColorRGB(*fill_color)",
  "    stroke = 1 if border_width > 0 else 0",
  "    fill = 1 if fill_color is not None else 0",
  "    c.ellipse(x * mm, PAGE_HEIGHT - (y + h) * mm, (x + w) * mm, PAGE_HEIGHT - y * mm, stroke=stroke, fill=fill)",
  "    c.restoreState()",
].join("\n");

export const IMAGE_FN = [
  "def _image(c, x, y, w, h, data, rot):",
  "    c.saveState()",
  "    if rot:",
  "        cx, cy = (x + w / 2) * mm, PAGE_HEIGHT - (y + h / 2) * mm",
  "        c.translate(cx, cy)",
  "        c.rotate(-rot)",
  "        c.translate(-cx, -cy)",
  "    image = ImageReader(BytesIO(base64.b64decode(data)))",
  "    c.drawImage(image, x * mm, PAGE_HEIGHT - (y + h) * mm, w * mm, h * mm)",
  "    c.restoreState()",
].join("\n");

export const BARCODE_FN = [
  "def _barcode(c, name, value, x, y, w, h, rot):",
  "    c.saveState()",
  "    if rot:",
  "        cx, cy = (x + w / 2) * mm, PAGE_HEIGHT - (y + h / 2) * mm",
  "        c.translate(cx, cy)",
  "        c.rotate(-rot)",
  "        c.translate(-cx, -cy)",
  "    d = createBarcodeDrawing(name, value=value, width=w * mm, height=h * mm)",
  "    d.drawOn(c, x * mm, PAGE_HEIGHT - (y + h) * mm)",
  "    c.restoreState()",
].join("\n");

export const MAIN_BLOCK = [
  'if __name__ == "__main__":',
  '    build(sys.argv[1] if len(sys.argv) > 1 else "output.pdf")',
].join("\n");

export function base64Payload(dataUri: string): string {
  const commaIndex = dataUri.indexOf(",");
  return commaIndex === -1 ? dataUri : dataUri.slice(commaIndex + 1);
}

export function buildImports(
  hasImage: boolean,
  needsRe: boolean,
  hasBarcode: boolean,
): string {
  const group1 = [
    ...(hasImage ? ["import base64"] : []),
    "import os",
    ...(needsRe ? ["import re"] : []),
    "import sys",
    ...(hasImage ? ["from io import BytesIO"] : []),
  ];
  const group2 = [
    ...(hasBarcode
      ? ["from reportlab.graphics.barcode import createBarcodeDrawing"]
      : []),
    "from reportlab.lib.units import mm",
    ...(hasImage ? ["from reportlab.lib.utils import ImageReader"] : []),
    "from reportlab.pdfbase import pdfmetrics",
    "from reportlab.pdfbase.ttfonts import TTFont",
    "from reportlab.pdfgen.canvas import Canvas",
  ];
  return `${group1.join("\n")}\n\n${group2.join("\n")}`;
}

export function pyDash(strokeStyle: IrStrokeStyle): string {
  if (strokeStyle === "solid") return "None";
  const pattern = STROKE_DASH_MM[strokeStyle];
  return `[${pattern.map((v) => `${pyNumber(v)} * mm`).join(", ")}]`;
}

function pyOptionalRgb(color: string | null): string {
  return color === null ? "None" : pyRgb(color);
}

/** Logical font name for a lowered text element: its (weight, style) resolved against `font`. */
export function fontNameFor(font: IrFont, element: LoweredTextElement): string {
  return font[
    resolveFontSlot(font, element.fontWeight, element.fontStyle)
  ] as string;
}

export function statementFor(
  element: LoweredElement,
  layoutLines: (el: LoweredTextElement) => readonly string[],
  font: IrFont,
): string {
  switch (element.type) {
    case "text": {
      const lines = layoutLines(element).map(pyString).join(", ");
      return `_text(c, ${pyString(fontNameFor(font, element))}, ${pyNumber(element.x)}, ${pyNumber(element.y)}, ${pyNumber(element.w)}, ${pyNumber(element.h)}, ${pyNumber(element.fontSize)}, ${pyString(element.align)}, ${pyNumber(element.lineHeight)}, ${pyRgb(element.color)}, ${pyNumber(element.rotate)}, ${pyBool(element.underline)}, [${lines}])`;
    }
    case "line": {
      const [x2, y2] =
        element.orientation === "horizontal"
          ? [element.x + element.length, element.y]
          : [element.x, element.y + element.length];
      return `_line(c, ${pyNumber(element.x)}, ${pyNumber(element.y)}, ${pyNumber(x2)}, ${pyNumber(y2)}, ${pyNumber(element.thickness)}, ${pyRgb(element.color)}, ${pyDash(element.strokeStyle)}, ${pyNumber(element.rotate)})`;
    }
    case "rect":
      return `_rect(c, ${pyNumber(element.x)}, ${pyNumber(element.y)}, ${pyNumber(element.w)}, ${pyNumber(element.h)}, ${pyNumber(element.borderWidth)}, ${pyRgb(element.borderColor)}, ${pyOptionalRgb(element.fillColor)}, ${pyDash(element.borderStyle)}, ${pyNumber(element.cornerRadius)}, ${pyNumber(element.rotate)})`;
    case "ellipse":
      return `_ellipse(c, ${pyNumber(element.x)}, ${pyNumber(element.y)}, ${pyNumber(element.w)}, ${pyNumber(element.h)}, ${pyNumber(element.borderWidth)}, ${pyRgb(element.borderColor)}, ${pyOptionalRgb(element.fillColor)}, ${pyNumber(element.rotate)})`;
    case "image":
      return `_image(c, ${pyNumber(element.x)}, ${pyNumber(element.y)}, ${pyNumber(element.w)}, ${pyNumber(element.h)}, ${pyString(base64Payload(element.src))}, ${pyNumber(element.rotate)})`;
    case "barcode":
      return `_barcode(c, ${pyString(REPORTLAB_BARCODE_NAMES[element.symbology])}, ${pyString(element.content)}, ${pyNumber(element.x)}, ${pyNumber(element.y)}, ${pyNumber(element.w)}, ${pyNumber(element.h)}, ${pyNumber(element.rotate)})`;
  }
}
