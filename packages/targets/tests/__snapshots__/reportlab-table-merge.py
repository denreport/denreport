"""生成物であり、手編集を想定しない。

実行要件: Python 3, reportlab

フォント: 書き出し時に併せて出力されるフォントファイル（FONTS の各ファイル）を
このファイルと同じディレクトリに置くこと。見つからない場合はエラー終了する。

使い方: python <このファイル> [出力.pdf]（省略時 output.pdf）
"""

import os
import sys

from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

FONTS = {
    "NotoSansJP": ("NotoSansJP.ttf", 1.16),
}
PAGE_WIDTH = 210 * mm
PAGE_HEIGHT = 297 * mm
PAGE_COUNT = 2

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

def _page_1(c):
    _rect(c, 15, 40, 140, 54, 0.4, (0, 0, 0), None, None, 0, 0)
    _line(c, 15, 49, 155, 49, 0.25, (0, 0, 0), None, 0)
    _line(c, 55, 58, 155, 58, 0.25, (0, 0, 0), None, 0)
    _line(c, 15, 67, 155, 67, 0.25, (0, 0, 0), None, 0)
    _line(c, 55, 76, 155, 76, 0.25, (0, 0, 0), None, 0)
    _line(c, 55, 85, 155, 85, 0.25, (0, 0, 0), None, 0)
    _line(c, 55, 40, 55, 94, 0.25, (0, 0, 0), None, 0)
    _line(c, 115, 58, 115, 94, 0.25, (0, 0, 0), None, 0)
    _text(c, "NotoSansJP", 16.5, 41.8, 37, 7.2, 10, "center", 1.25, (0, 0, 0), 0, False, ["分類"])
    _text(c, "NotoSansJP", 56.5, 41.8, 97, 7.2, 10, "center", 1.25, (0, 0, 0), 0, False, ["品目"])
    _text(c, "NotoSansJP", 16.5, 51, 37, 16, 10, "left", 1.25, (0, 0, 0), 0, False, ["食品"])
    _text(c, "NotoSansJP", 56.5, 51, 97, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["りんご"])
    _text(c, "NotoSansJP", 56.5, 60, 57, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["みかん"])
    _text(c, "NotoSansJP", 116.5, 60, 37, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["200"])
    _text(c, "NotoSansJP", 16.5, 69, 37, 25, 10, "left", 1.25, (0, 0, 0), 0, False, ["雑貨"])
    _text(c, "NotoSansJP", 56.5, 69, 57, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["ノート"])
    _text(c, "NotoSansJP", 116.5, 69, 37, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["300"])
    _text(c, "NotoSansJP", 56.5, 78, 57, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["ペン"])
    _text(c, "NotoSansJP", 116.5, 78, 37, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["400"])
    _text(c, "NotoSansJP", 56.5, 87, 57, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["はさみ"])
    _text(c, "NotoSansJP", 116.5, 87, 37, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["500"])

def _page_2(c):
    _rect(c, 15, 40, 140, 36, 0.4, (0, 0, 0), None, None, 0, 0)
    _line(c, 15, 49, 155, 49, 0.25, (0, 0, 0), None, 0)
    _line(c, 55, 58, 155, 58, 0.25, (0, 0, 0), None, 0)
    _line(c, 55, 67, 155, 67, 0.25, (0, 0, 0), None, 0)
    _line(c, 55, 40, 55, 76, 0.25, (0, 0, 0), None, 0)
    _line(c, 115, 49, 115, 76, 0.25, (0, 0, 0), None, 0)
    _text(c, "NotoSansJP", 16.5, 41.8, 37, 7.2, 10, "center", 1.25, (0, 0, 0), 0, False, ["分類"])
    _text(c, "NotoSansJP", 56.5, 41.8, 97, 7.2, 10, "center", 1.25, (0, 0, 0), 0, False, ["品目"])
    _text(c, "NotoSansJP", 16.5, 51, 37, 25, 10, "left", 1.25, (0, 0, 0), 0, False, ["雑貨"])
    _text(c, "NotoSansJP", 56.5, 51, 57, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["のり"])
    _text(c, "NotoSansJP", 116.5, 51, 37, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["600"])
    _text(c, "NotoSansJP", 56.5, 60, 57, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["テープ"])
    _text(c, "NotoSansJP", 116.5, 60, 37, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["700"])
    _text(c, "NotoSansJP", 56.5, 69, 57, 7, 10, "left", 1.25, (0, 0, 0), 0, False, ["定規"])
    _text(c, "NotoSansJP", 116.5, 69, 37, 7, 10, "right", 1.25, (0, 0, 0), 0, False, ["800"])

def build(output_path):
    _register_fonts()
    c = Canvas(output_path, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    _page_1(c)
    c.showPage()
    _page_2(c)
    c.showPage()
    c.save()

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "output.pdf")
