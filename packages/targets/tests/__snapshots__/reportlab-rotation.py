"""生成物であり、手編集を想定しない。

実行要件: Python 3, reportlab, Pillow（画像の描画に使用）

フォント: 書き出し時に併せて出力されるフォントファイル（FONTS の各ファイル）を
このファイルと同じディレクトリに置くこと。見つからない場合はエラー終了する。

使い方: python <このファイル> [出力.pdf]（省略時 output.pdf）
"""

import base64
import os
import sys
from io import BytesIO

from reportlab.graphics.barcode import createBarcodeDrawing
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

FONTS = {
    "NotoSansJP": ("NotoSansJP.ttf", 1.16),
}
PAGE_WIDTH = 210 * mm
PAGE_HEIGHT = 297 * mm
PAGE_COUNT = 1

def _register_fonts():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    for name, (file, _) in FONTS.items():
        font_path = os.path.join(base_dir, file)
        if not os.path.exists(font_path):
            sys.exit(f"フォントファイルが見つかりません: {font_path}（このファイルと同じディレクトリに置くこと）")
        pdfmetrics.registerFont(TTFont(name, font_path))

def _text(c, font, x, y, w, h, size, align, line_height, color, rot, underline, lines):
    c.saveState()
    if rot:
        cx, cy = (x + w / 2) * mm, PAGE_HEIGHT - (y + h / 2) * mm
        c.translate(cx, cy)
        c.rotate(-rot)
        c.translate(-cx, -cy)
    c.setFont(font, size)
    c.setFillColorRGB(*color)
    ascent = FONTS[font][1]
    for i, line in enumerate(lines):
        baseline = PAGE_HEIGHT - y * mm - (ascent + (line_height - 1) / 2 + i * line_height) * size
        width = pdfmetrics.stringWidth(line, font, size)
        if align == "justify":
            n = len(line)
            t = c.beginText(x * mm, baseline)
            t.setFont(font, size)
            stretched = n >= 2 and width < w * mm
            if stretched:
                t.setCharSpace((w * mm - width) / (n - 1))
            t.textOut(line)
            c.drawText(t)
            line_x, line_w = x * mm, (w * mm if stretched else width)
        elif align == "left":
            c.drawString(x * mm, baseline, line)
            line_x, line_w = x * mm, width
        elif align == "center":
            c.drawCentredString((x + w / 2) * mm, baseline, line)
            line_x, line_w = (x + w / 2) * mm - width / 2, width
        else:
            c.drawRightString((x + w) * mm, baseline, line)
            line_x, line_w = (x + w) * mm - width, width
        if underline and line_w > 0:
            c.setStrokeColorRGB(*color)
            c.setLineWidth(0.05 * size)
            c.line(line_x, baseline - 0.1 * size, line_x + line_w, baseline - 0.1 * size)
    c.restoreState()

def _line(c, x1, y1, x2, y2, thickness, color, dash, rot):
    c.saveState()
    if rot:
        cx, cy = (x1 + x2) / 2 * mm, PAGE_HEIGHT - (y1 + y2) / 2 * mm
        c.translate(cx, cy)
        c.rotate(-rot)
        c.translate(-cx, -cy)
    c.setLineWidth(thickness * mm)
    c.setStrokeColorRGB(*color)
    if dash is not None:
        c.setDash(dash)
    c.line(x1 * mm, PAGE_HEIGHT - y1 * mm, x2 * mm, PAGE_HEIGHT - y2 * mm)
    c.restoreState()

def _rect(c, x, y, w, h, border_width, border_color, fill_color, dash, radius, rot):
    c.saveState()
    if rot:
        cx, cy = (x + w / 2) * mm, PAGE_HEIGHT - (y + h / 2) * mm
        c.translate(cx, cy)
        c.rotate(-rot)
        c.translate(-cx, -cy)
    c.setLineWidth(border_width * mm)
    c.setStrokeColorRGB(*border_color)
    if fill_color is not None:
        c.setFillColorRGB(*fill_color)
    if dash is not None:
        c.setDash(dash)
    stroke = 1 if border_width > 0 else 0
    fill = 1 if fill_color is not None else 0
    if radius > 0:
        c.roundRect(x * mm, PAGE_HEIGHT - (y + h) * mm, w * mm, h * mm, radius * mm, stroke=stroke, fill=fill)
    else:
        c.rect(x * mm, PAGE_HEIGHT - (y + h) * mm, w * mm, h * mm, stroke=stroke, fill=fill)
    c.restoreState()

def _ellipse(c, x, y, w, h, border_width, border_color, fill_color, rot):
    c.saveState()
    if rot:
        cx, cy = (x + w / 2) * mm, PAGE_HEIGHT - (y + h / 2) * mm
        c.translate(cx, cy)
        c.rotate(-rot)
        c.translate(-cx, -cy)
    c.setLineWidth(border_width * mm)
    c.setStrokeColorRGB(*border_color)
    if fill_color is not None:
        c.setFillColorRGB(*fill_color)
    stroke = 1 if border_width > 0 else 0
    fill = 1 if fill_color is not None else 0
    c.ellipse(x * mm, PAGE_HEIGHT - (y + h) * mm, (x + w) * mm, PAGE_HEIGHT - y * mm, stroke=stroke, fill=fill)
    c.restoreState()

def _image(c, x, y, w, h, data, rot):
    c.saveState()
    if rot:
        cx, cy = (x + w / 2) * mm, PAGE_HEIGHT - (y + h / 2) * mm
        c.translate(cx, cy)
        c.rotate(-rot)
        c.translate(-cx, -cy)
    image = ImageReader(BytesIO(base64.b64decode(data)))
    c.drawImage(image, x * mm, PAGE_HEIGHT - (y + h) * mm, w * mm, h * mm)
    c.restoreState()

def _barcode(c, name, value, x, y, w, h, rot):
    c.saveState()
    if rot:
        cx, cy = (x + w / 2) * mm, PAGE_HEIGHT - (y + h / 2) * mm
        c.translate(cx, cy)
        c.rotate(-rot)
        c.translate(-cx, -cy)
    d = createBarcodeDrawing(name, value=value, width=w * mm, height=h * mm)
    d.drawOn(c, x * mm, PAGE_HEIGHT - (y + h) * mm)
    c.restoreState()

def _page_1(c):
    _text(c, "NotoSansJP", 20, 20, 60, 10, 12, "left", 1.25, (0, 0, 0), 0, False, ["水平"])
    _text(c, "NotoSansJP", 20, 100, 60, 10, 12, "left", 1.25, (0, 0, 0), 90, False, ["R"])
    _text(c, "NotoSansJP", 100, 100, 60, 10, 12, "left", 1.25, (0, 0, 0), 180, False, ["U"])
    _line(c, 40, 150, 100, 150, 0.5, (0, 0, 0), None, 45)
    _rect(c, 120, 140, 40, 20, 0.5, (0, 0, 0), None, None, 0, 30)
    _ellipse(c, 30, 200, 40, 20, 0.5, (0, 0, 0), None, 60)
    _image(c, 120, 200, 20, 20, "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", 90)
    _barcode(c, "QR", "ROTATE", 90, 240, 30, 30, 45)

def build(output_path):
    _register_fonts()
    c = Canvas(output_path, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    _page_1(c)
    c.showPage()
    c.save()

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "output.pdf")
