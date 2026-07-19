"""生成物であり、手編集を想定しない。

実行要件: Python 3, reportlab, Pillow（画像の描画に使用）

フォント: 書き出し時に併せて出力されるフォントファイル（FONT_FILE）を
このファイルと同じディレクトリに置くこと。見つからない場合はエラー終了する。

使い方: python <このファイル> [出力.pdf]（省略時 output.pdf）
"""

import base64
import os
import sys
from io import BytesIO

from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

FONT_NAME = "NotoSansJP"
FONT_FILE = "NotoSansJP.ttf"
FONT_ASCENT_EM = 1.16
PAGE_WIDTH = 210 * mm
PAGE_HEIGHT = 297 * mm
PAGE_COUNT = 1

def _register_font():
    font_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), FONT_FILE)
    if not os.path.exists(font_path):
        sys.exit(f"フォントファイルが見つかりません: {font_path}（このファイルと同じディレクトリに置くこと）")
    pdfmetrics.registerFont(TTFont(FONT_NAME, font_path))
    return FONT_NAME

def _text(c, font, x, y, w, size, align, line_height, color, lines):
    c.setFont(font, size)
    c.setFillColorRGB(*color)
    for i, line in enumerate(lines):
        baseline = PAGE_HEIGHT - y * mm - (FONT_ASCENT_EM + (line_height - 1) / 2 + i * line_height) * size
        if align == "justify":
            n = len(line)
            width = pdfmetrics.stringWidth(line, font, size)
            t = c.beginText(x * mm, baseline)
            t.setFont(font, size)
            if n >= 2 and width < w * mm:
                t.setCharSpace((w * mm - width) / (n - 1))
            t.textOut(line)
            c.drawText(t)
        elif align == "left":
            c.drawString(x * mm, baseline, line)
        elif align == "center":
            c.drawCentredString((x + w / 2) * mm, baseline, line)
        else:
            c.drawRightString((x + w) * mm, baseline, line)

def _line(c, x1, y1, x2, y2, thickness, color, dash):
    c.saveState()
    c.setLineWidth(thickness * mm)
    c.setStrokeColorRGB(*color)
    if dash is not None:
        c.setDash(dash)
    c.line(x1 * mm, PAGE_HEIGHT - y1 * mm, x2 * mm, PAGE_HEIGHT - y2 * mm)
    c.restoreState()

def _rect(c, x, y, w, h, border_width, border_color, fill_color, dash, radius):
    c.saveState()
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

def _image(c, x, y, w, h, data):
    image = ImageReader(BytesIO(base64.b64decode(data)))
    c.drawImage(image, x * mm, PAGE_HEIGHT - (y + h) * mm, w * mm, h * mm)

def _page_1(c, font):
    _text(c, font, 0, 18, 210, 22, "center", 1.25, (0, 0, 0), ["請求書"])
    _image(c, 15, 15, 20, 20, "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
    _text(c, font, 130, 41.25, 60, 11, "left", 1.25, (0, 0, 0), ["株式会社サンプル"])
    _text(c, font, 130, 48.75, 60, 9, "left", 1.25, (0, 0, 0), ["東京都千代田区1-1-1"])
    _line(c, 15, 49, 105, 49, 0.4, (0, 0, 0), None)
    _rect(c, 15, 90, 125, 36, 0.4, (0, 0, 0), None, None, 0)
    _line(c, 15, 99, 140, 99, 0.25, (0, 0, 0), None)
    _line(c, 15, 108, 140, 108, 0.25, (0, 0, 0), None)
    _line(c, 15, 117, 140, 117, 0.25, (0, 0, 0), None)
    _line(c, 105, 90, 105, 126, 0.25, (0, 0, 0), None)
    _text(c, font, 16.5, 91.8, 87, 10, "center", 1.25, (0, 0, 0), ["品目"])
    _text(c, font, 106.5, 91.8, 32, 10, "center", 1.25, (0, 0, 0), ["金額(税抜)"])
    _text(c, font, 16.5, 101, 87, 10, "left", 1.25, (0, 0, 0), ["商品A"])
    _text(c, font, 106.5, 101, 32, 10, "right", 1.25, (0, 0, 0), ["10,000"])
    _text(c, font, 16.5, 110, 87, 10, "left", 1.25, (0, 0, 0), ["商品B"])
    _text(c, font, 106.5, 110, 32, 10, "right", 1.25, (0, 0, 0), ["20,000"])
    _text(c, font, 110, 270, 40, 12, "left", 1.25, (0, 0, 0), ["合計(税込)"])
    _rect(c, 108, 267, 89, 12, 0.5, (0, 0, 0), None, None, 0)
    _text(c, font, 0, 285, 210, 9, "center", 1.25, (0, 0, 0), ["1 / 1"])

def build(output_path):
    font = _register_font()
    c = Canvas(output_path, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    _page_1(c, font)
    c.showPage()
    c.save()

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "output.pdf")
