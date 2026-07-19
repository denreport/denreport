import type {
  IrBarcodeSymbology,
  IrStrokeStyle,
  LoweredElement,
  LoweredTextElement,
} from "@denreport/core";
import { STROKE_DASH_MM } from "@denreport/core";
import { pyNumber, pyRgb, pyString } from "./python";

// createBarcodeDrawing の規格名（reportlab.graphics.barcode.getCodeNames() の表記）
export const REPORTLAB_BARCODE_NAMES: Readonly<
  Record<IrBarcodeSymbology, string>
> = {
  qrcode: "QR",
  code39: "Standard39",
  code128: "Code128",
  ean13: "EAN13",
};

export const REGISTER_FONT_FN = [
  "def _register_font():",
  "    font_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), FONT_FILE)",
  "    if not os.path.exists(font_path):",
  '        sys.exit(f"フォントファイルが見つかりません: {font_path}（このファイルと同じディレクトリに置くこと）")',
  "    pdfmetrics.registerFont(TTFont(FONT_NAME, font_path))",
  "    return FONT_NAME",
].join("\n");

export const TEXT_FN = [
  "def _text(c, font, x, y, w, size, align, line_height, color, lines):",
  "    c.setFont(font, size)",
  "    c.setFillColorRGB(*color)",
  "    for i, line in enumerate(lines):",
  "        baseline = PAGE_HEIGHT - y * mm - (FONT_ASCENT_EM + (line_height - 1) / 2 + i * line_height) * size",
  '        if align == "justify":',
  "            n = len(line)",
  "            width = pdfmetrics.stringWidth(line, font, size)",
  "            t = c.beginText(x * mm, baseline)",
  "            t.setFont(font, size)",
  "            if n >= 2 and width < w * mm:",
  "                t.setCharSpace((w * mm - width) / (n - 1))",
  "            t.textOut(line)",
  "            c.drawText(t)",
  '        elif align == "left":',
  "            c.drawString(x * mm, baseline, line)",
  '        elif align == "center":',
  "            c.drawCentredString((x + w / 2) * mm, baseline, line)",
  "        else:",
  "            c.drawRightString((x + w) * mm, baseline, line)",
].join("\n");

export const LINE_FN = [
  "def _line(c, x1, y1, x2, y2, thickness, color, dash):",
  "    c.saveState()",
  "    c.setLineWidth(thickness * mm)",
  "    c.setStrokeColorRGB(*color)",
  "    if dash is not None:",
  "        c.setDash(dash)",
  "    c.line(x1 * mm, PAGE_HEIGHT - y1 * mm, x2 * mm, PAGE_HEIGHT - y2 * mm)",
  "    c.restoreState()",
].join("\n");

export const RECT_FN = [
  "def _rect(c, x, y, w, h, border_width, border_color, fill_color, dash, radius):",
  "    c.saveState()",
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
  "def _ellipse(c, x, y, w, h, border_width, border_color, fill_color):",
  "    c.saveState()",
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
  "def _image(c, x, y, w, h, data):",
  "    image = ImageReader(BytesIO(base64.b64decode(data)))",
  "    c.drawImage(image, x * mm, PAGE_HEIGHT - (y + h) * mm, w * mm, h * mm)",
].join("\n");

export const BARCODE_FN = [
  "def _barcode(c, name, value, x, y, w, h):",
  "    d = createBarcodeDrawing(name, value=value, width=w * mm, height=h * mm)",
  "    d.drawOn(c, x * mm, PAGE_HEIGHT - (y + h) * mm)",
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

export function statementFor(
  element: LoweredElement,
  layoutLines: (el: LoweredTextElement) => readonly string[],
): string {
  switch (element.type) {
    case "text": {
      const lines = layoutLines(element).map(pyString).join(", ");
      return `_text(c, font, ${pyNumber(element.x)}, ${pyNumber(element.y)}, ${pyNumber(element.w)}, ${pyNumber(element.fontSize)}, ${pyString(element.align)}, ${pyNumber(element.lineHeight)}, ${pyRgb(element.color)}, [${lines}])`;
    }
    case "line": {
      const [x2, y2] =
        element.orientation === "horizontal"
          ? [element.x + element.length, element.y]
          : [element.x, element.y + element.length];
      return `_line(c, ${pyNumber(element.x)}, ${pyNumber(element.y)}, ${pyNumber(x2)}, ${pyNumber(y2)}, ${pyNumber(element.thickness)}, ${pyRgb(element.color)}, ${pyDash(element.strokeStyle)})`;
    }
    case "rect":
      return `_rect(c, ${pyNumber(element.x)}, ${pyNumber(element.y)}, ${pyNumber(element.w)}, ${pyNumber(element.h)}, ${pyNumber(element.borderWidth)}, ${pyRgb(element.borderColor)}, ${pyOptionalRgb(element.fillColor)}, ${pyDash(element.borderStyle)}, ${pyNumber(element.cornerRadius)})`;
    case "ellipse":
      return `_ellipse(c, ${pyNumber(element.x)}, ${pyNumber(element.y)}, ${pyNumber(element.w)}, ${pyNumber(element.h)}, ${pyNumber(element.borderWidth)}, ${pyRgb(element.borderColor)}, ${pyOptionalRgb(element.fillColor)})`;
    case "image":
      return `_image(c, ${pyNumber(element.x)}, ${pyNumber(element.y)}, ${pyNumber(element.w)}, ${pyNumber(element.h)}, ${pyString(base64Payload(element.src))})`;
    case "barcode":
      return `_barcode(c, ${pyString(REPORTLAB_BARCODE_NAMES[element.symbology])}, ${pyString(element.content)}, ${pyNumber(element.x)}, ${pyNumber(element.y)}, ${pyNumber(element.w)}, ${pyNumber(element.h)})`;
  }
}
