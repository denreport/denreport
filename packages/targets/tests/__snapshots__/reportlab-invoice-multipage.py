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
PAGE_COUNT = 3

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

def _page_1(c):
    _text(c, "NotoSansJP", 0, 18, 210, 12, 22, "center", 1.25, (0, 0, 0), 0, False, ["請求書"])
    _image(c, 15, 15, 20, 20, "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", 0)
    _text(c, "NotoSansJP", 130, 41.25, 60, 6, 11, "left", 1.25, (0, 0, 0), 0, False, ["株式会社サンプル"])
    _text(c, "NotoSansJP", 130, 48.75, 60, 10, 9, "left", 1.25, (0, 0, 0), 0, False, ["東京都千代田区1-1-1"])
    _line(c, 15, 49, 105, 49, 0.4, (0, 0, 0), None, 0)
    _rect(c, 15, 90, 125, 144, 0.4, (0, 0, 0), None, None, 0, 0)
    _line(c, 15, 99, 140, 99, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 108, 140, 108, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 117, 140, 117, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 126, 140, 126, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 135, 140, 135, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 144, 140, 144, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 153, 140, 153, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 162, 140, 162, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 171, 140, 171, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 180, 140, 180, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 189, 140, 189, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 198, 140, 198, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 207, 140, 207, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 216, 140, 216, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 225, 140, 225, 0.25, (0, 0, 0), None, 0)
    _line(c, 105, 90, 105, 234, 0.25, (0, 0, 0), None, 0)
    _text(c, "NotoSansJP", 16.5, 91.8, 87, 7.2, 10, "center", 1.25, (0, 0, 0), 0, False, ["品目"])
    _text(c, "NotoSansJP", 106.5, 91.8, 32, 7.2, 10, "center", 1.25, (0, 0, 0), 0, False, ["金額(税抜)"])
    _text(c, "NotoSansJP", 16.5, 101, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品00"])
    _text(c, "NotoSansJP", 106.5, 101, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["1,000"])
    _text(c, "NotoSansJP", 16.5, 110, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品01"])
    _text(c, "NotoSansJP", 106.5, 110, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["2,000"])
    _text(c, "NotoSansJP", 16.5, 119, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品02"])
    _text(c, "NotoSansJP", 106.5, 119, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["3,000"])
    _text(c, "NotoSansJP", 16.5, 128, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品03"])
    _text(c, "NotoSansJP", 106.5, 128, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["4,000"])
    _text(c, "NotoSansJP", 16.5, 137, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品04"])
    _text(c, "NotoSansJP", 106.5, 137, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["5,000"])
    _text(c, "NotoSansJP", 16.5, 146, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品05"])
    _text(c, "NotoSansJP", 106.5, 146, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["6,000"])
    _text(c, "NotoSansJP", 16.5, 155, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品06"])
    _text(c, "NotoSansJP", 106.5, 155, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["7,000"])
    _text(c, "NotoSansJP", 16.5, 164, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品07"])
    _text(c, "NotoSansJP", 106.5, 164, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["8,000"])
    _text(c, "NotoSansJP", 16.5, 173, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品08"])
    _text(c, "NotoSansJP", 106.5, 173, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["9,000"])
    _text(c, "NotoSansJP", 16.5, 182, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品09"])
    _text(c, "NotoSansJP", 106.5, 182, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["10,000"])
    _text(c, "NotoSansJP", 16.5, 191, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品10"])
    _text(c, "NotoSansJP", 106.5, 191, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["11,000"])
    _text(c, "NotoSansJP", 16.5, 200, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品11"])
    _text(c, "NotoSansJP", 106.5, 200, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["12,000"])
    _text(c, "NotoSansJP", 16.5, 209, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品12"])
    _text(c, "NotoSansJP", 106.5, 209, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["13,000"])
    _text(c, "NotoSansJP", 16.5, 218, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品13"])
    _text(c, "NotoSansJP", 106.5, 218, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["14,000"])
    _text(c, "NotoSansJP", 16.5, 227, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品14"])
    _text(c, "NotoSansJP", 106.5, 227, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["15,000"])
    _text(c, "NotoSansJP", 0, 285, 210, 6, 9, "center", 1.25, (0, 0, 0), 0, False, ["1 / 3"])

def _page_2(c):
    _rect(c, 15, 30, 125, 207, 0.4, (0, 0, 0), None, None, 0, 0)
    _line(c, 15, 39, 140, 39, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 48, 140, 48, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 57, 140, 57, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 66, 140, 66, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 75, 140, 75, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 84, 140, 84, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 93, 140, 93, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 102, 140, 102, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 111, 140, 111, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 120, 140, 120, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 129, 140, 129, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 138, 140, 138, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 147, 140, 147, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 156, 140, 156, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 165, 140, 165, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 174, 140, 174, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 183, 140, 183, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 192, 140, 192, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 201, 140, 201, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 210, 140, 210, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 219, 140, 219, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 228, 140, 228, 0.25, (0, 0, 0), None, 0)
    _line(c, 105, 30, 105, 237, 0.25, (0, 0, 0), None, 0)
    _text(c, "NotoSansJP", 16.5, 31.8, 87, 7.2, 10, "center", 1.25, (0, 0, 0), 0, False, ["品目"])
    _text(c, "NotoSansJP", 106.5, 31.8, 32, 7.2, 10, "center", 1.25, (0, 0, 0), 0, False, ["金額(税抜)"])
    _text(c, "NotoSansJP", 16.5, 41, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品15"])
    _text(c, "NotoSansJP", 106.5, 41, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["16,000"])
    _text(c, "NotoSansJP", 16.5, 50, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品16"])
    _text(c, "NotoSansJP", 106.5, 50, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["17,000"])
    _text(c, "NotoSansJP", 16.5, 59, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品17"])
    _text(c, "NotoSansJP", 106.5, 59, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["18,000"])
    _text(c, "NotoSansJP", 16.5, 68, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品18"])
    _text(c, "NotoSansJP", 106.5, 68, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["19,000"])
    _text(c, "NotoSansJP", 16.5, 77, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品19"])
    _text(c, "NotoSansJP", 106.5, 77, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["20,000"])
    _text(c, "NotoSansJP", 16.5, 86, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品20"])
    _text(c, "NotoSansJP", 106.5, 86, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["21,000"])
    _text(c, "NotoSansJP", 16.5, 95, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品21"])
    _text(c, "NotoSansJP", 106.5, 95, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["22,000"])
    _text(c, "NotoSansJP", 16.5, 104, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品22"])
    _text(c, "NotoSansJP", 106.5, 104, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["23,000"])
    _text(c, "NotoSansJP", 16.5, 113, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品23"])
    _text(c, "NotoSansJP", 106.5, 113, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["24,000"])
    _text(c, "NotoSansJP", 16.5, 122, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品24"])
    _text(c, "NotoSansJP", 106.5, 122, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["25,000"])
    _text(c, "NotoSansJP", 16.5, 131, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品25"])
    _text(c, "NotoSansJP", 106.5, 131, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["26,000"])
    _text(c, "NotoSansJP", 16.5, 140, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品26"])
    _text(c, "NotoSansJP", 106.5, 140, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["27,000"])
    _text(c, "NotoSansJP", 16.5, 149, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品27"])
    _text(c, "NotoSansJP", 106.5, 149, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["28,000"])
    _text(c, "NotoSansJP", 16.5, 158, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品28"])
    _text(c, "NotoSansJP", 106.5, 158, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["29,000"])
    _text(c, "NotoSansJP", 16.5, 167, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品29"])
    _text(c, "NotoSansJP", 106.5, 167, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["30,000"])
    _text(c, "NotoSansJP", 16.5, 176, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品30"])
    _text(c, "NotoSansJP", 106.5, 176, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["31,000"])
    _text(c, "NotoSansJP", 16.5, 185, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品31"])
    _text(c, "NotoSansJP", 106.5, 185, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["32,000"])
    _text(c, "NotoSansJP", 16.5, 194, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品32"])
    _text(c, "NotoSansJP", 106.5, 194, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["33,000"])
    _text(c, "NotoSansJP", 16.5, 203, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品33"])
    _text(c, "NotoSansJP", 106.5, 203, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["34,000"])
    _text(c, "NotoSansJP", 16.5, 212, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品34"])
    _text(c, "NotoSansJP", 106.5, 212, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["35,000"])
    _text(c, "NotoSansJP", 16.5, 221, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品35"])
    _text(c, "NotoSansJP", 106.5, 221, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["36,000"])
    _text(c, "NotoSansJP", 16.5, 230, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品36"])
    _text(c, "NotoSansJP", 106.5, 230, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["37,000"])
    _text(c, "NotoSansJP", 0, 285, 210, 6, 9, "center", 1.25, (0, 0, 0), 0, False, ["2 / 3"])

def _page_3(c):
    _rect(c, 15, 30, 125, 36, 0.4, (0, 0, 0), None, None, 0, 0)
    _line(c, 15, 39, 140, 39, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 48, 140, 48, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 57, 140, 57, 0.25, (0, 0, 0), None, 0)
    _line(c, 105, 30, 105, 66, 0.25, (0, 0, 0), None, 0)
    _text(c, "NotoSansJP", 16.5, 31.8, 87, 7.2, 10, "center", 1.25, (0, 0, 0), 0, False, ["品目"])
    _text(c, "NotoSansJP", 106.5, 31.8, 32, 7.2, 10, "center", 1.25, (0, 0, 0), 0, False, ["金額(税抜)"])
    _text(c, "NotoSansJP", 16.5, 41, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品37"])
    _text(c, "NotoSansJP", 106.5, 41, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["38,000"])
    _text(c, "NotoSansJP", 16.5, 50, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品38"])
    _text(c, "NotoSansJP", 106.5, 50, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["39,000"])
    _text(c, "NotoSansJP", 16.5, 59, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["商品39"])
    _text(c, "NotoSansJP", 106.5, 59, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["40,000"])
    _text(c, "NotoSansJP", 110, 250, 40, 8, 12, "left", 1.25, (0, 0, 0), 0, False, ["合計(税込)"])
    _rect(c, 108, 247, 89, 12, 0.5, (0, 0, 0), None, None, 0, 0)
    _text(c, "NotoSansJP", 0, 285, 210, 6, 9, "center", 1.25, (0, 0, 0), 0, False, ["3 / 3"])

def build(output_path):
    _register_fonts()
    c = Canvas(output_path, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    _page_1(c)
    c.showPage()
    _page_2(c)
    c.showPage()
    _page_3(c)
    c.showPage()
    c.save()

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "output.pdf")
