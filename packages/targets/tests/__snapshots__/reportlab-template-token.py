"""生成物であり、手編集を想定しない。

実行要件: Python 3, reportlab

フォント: 書き出し時に併せて出力されるフォントファイル（FONT_FILE）を
このファイルと同じディレクトリに置くこと。見つからない場合はエラー終了する。

使い方: python <このファイル> [出力.pdf]（省略時 output.pdf。データなしで実行され、
差し込みキーがある場合はエラー終了する）
プログラムから: from report import build; build("出力.pdf", data)
data は差し込み値の辞書。text 内の {key} トークンのキー → 文字列、table の bind キー → 行辞書のリスト。
"""

import os
import re
import sys

from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

FONT_NAME = "NotoSansJP"
FONT_FILE = "NotoSansJP.ttf"
FONT_ASCENT_EM = 1.16
PAGE_WIDTH = 210 * mm
PAGE_HEIGHT = 297 * mm
PAGE_COUNT_MAX = 1000

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

def _bind_str(data, key):
    if key not in data:
        sys.exit(f'データにキー "{key}" がありません')
    value = data[key]
    if not isinstance(value, str):
        sys.exit(f'キー "{key}" の値が string ではありません')
    return value

_TOKEN_RE = re.compile(r"\{([A-Za-z_][A-Za-z0-9_]{0,63})\}")

def _interpolate(data, template):
    return _TOKEN_RE.sub(lambda m: _bind_str(data, m.group(1)), template)

_KINSOKU_HEAD = "、。，．）｝］」』】〕〉》｡､｣,.)]}"

def _wrap(font, size, w, text):
    lines = []
    for paragraph in text.split("\n"):
        line = ""
        for ch in paragraph:
            if line and pdfmetrics.stringWidth(line + ch, font, size) > w * mm:
                lines.append(line)
                line = ch
                while line[0] in _KINSOKU_HEAD and len(lines[-1]) >= 2:
                    line = lines[-1][-1] + line
                    lines[-1] = lines[-1][:-1]
            else:
                line += ch
        lines.append(line)
    return lines

def _draw_page(c, font, data, page, page_count):
    if page == 1:
        _text(c, font, 0, 0, 100, 12, "left", 1.2, (0, 0, 0), _wrap(font, 12, 100, _interpolate(data, "{customerName}")))
    if page == 1:
        _text(c, font, 0, 10, 100, 12, "left", 1.2, (0, 0, 0), _wrap(font, 12, 100, _interpolate(data, "合計: {total} 円")))

def build(output_path, data=None):
    data = {} if data is None else data
    font = _register_font()
    page_count = 1
    c = Canvas(output_path, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    for page in range(1, page_count + 1):
        _draw_page(c, font, data, page, page_count)
        c.showPage()
    c.save()

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "output.pdf")
