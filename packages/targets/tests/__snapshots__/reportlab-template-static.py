"""生成物であり、手編集を想定しない。

実行要件: Python 3, reportlab

フォント: 書き出し時に併せて出力されるフォントファイル（FONTS の各ファイル）を
このファイルと同じディレクトリに置くこと。見つからない場合はエラー終了する。

使い方: python <このファイル> [出力.pdf]（省略時 output.pdf。データなしで実行され、
差し込みキーがある場合はエラー終了する）
プログラムから: from report import build; build("出力.pdf", data)
data は差し込み値の辞書。text 内の {key} トークンのキー → 文字列、table の bind キー → 行辞書のリスト。
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
PAGE_COUNT_MAX = 1000

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

def _draw_page(c, data, page, page_count):
    _text(c, "NotoSansJP", 0, 18, 210, 12, 22, "center", 1.25, (0, 0, 0), 0, False, ["見本"])
    _line(c, 15, 32, 195, 32, 0.4, (0, 0, 0), None, 0)

def build(output_path, data=None):
    data = {} if data is None else data
    _register_fonts()
    page_count = 1
    c = Canvas(output_path, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    for page in range(1, page_count + 1):
        _draw_page(c, data, page, page_count)
        c.showPage()
    c.save()

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "output.pdf")
