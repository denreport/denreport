"""生成物であり、手編集を想定しない。

実行要件: Python 3, reportlab, Pillow（画像の描画に使用）

フォント: 書き出し時に併せて出力されるフォントファイル（FONTS の各ファイル）を
このファイルと同じディレクトリに置くこと。見つからない場合はエラー終了する。

使い方: python <このファイル> [出力.pdf]（省略時 output.pdf。データなしで実行され、
差し込みキーがある場合はエラー終了する）
プログラムから: from report import build; build("出力.pdf", data)
data は差し込み値の辞書。text 内の {key} トークンのキー → 文字列、table の bind キー → 行辞書のリスト。
"""

import base64
import os
import re
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

def _bind_rows(data, key, column_keys):
    if key not in data:
        sys.exit(f'データにキー "{key}" がありません')
    raw = data[key]
    if not isinstance(raw, list):
        sys.exit(f'キー "{key}" の値が配列ではありません')
    rows = []
    for t, raw_row in enumerate(raw):
        if not isinstance(raw_row, dict):
            sys.exit(f"{t}行目がオブジェクトではありません")
        row = {}
        for column_key in column_keys:
            value = raw_row.get(column_key)
            if not isinstance(value, str):
                sys.exit(f'{t}行目のキー "{column_key}" の値が string ではありません')
            row[column_key] = value
        rows.append(row)
    return rows

def _chunk_sizes(row_count, min_rows, k_first, k_cont):
    m = max(row_count, min_rows)
    if m <= k_first:
        return [min(m, k_first)]
    if k_cont < 1:
        sys.exit("表が継続ページに1行も入りません")
    chunk_sizes = [k_first]
    remaining = m - k_first
    while remaining > 0:
        size = min(remaining, k_cont)
        chunk_sizes.append(size)
        remaining -= size
    return chunk_sizes

def _page_label(fmt, page, page_count):
    return fmt.replace("{n}", str(page)).replace("{N}", str(page_count))

def _table_items(c, rows, chunk_index, row_offset, chunk_size):
    y0 = 90 if chunk_index == 0 else 30
    _rect(c, 15, y0, 125, 9 + chunk_size * 9, 0.4, (0, 0, 0), None, None, 0, 0)
    for q in range(chunk_size):
        _line(c, 15, y0 + 9 + q * 9, 140, y0 + 9 + q * 9, 0.25, (0, 0, 0), None, 0)
    _line(c, 105, y0, 105, y0 + 9 + chunk_size * 9, 0.25, (0, 0, 0), None, 0)
    _text(c, "NotoSansJP", 16.5, y0 + 1.8, 87, 7.2, 10, "center", 1.25, (0, 0, 0), 0, False, ["品目"])
    _text(c, "NotoSansJP", 106.5, y0 + 1.8, 32, 7.2, 10, "center", 1.25, (0, 0, 0), 0, False, ["金額(税抜)"])
    for q in range(chunk_size):
        t = row_offset + q
        if t >= len(rows):
            continue
        _text(c, "NotoSansJP", 16.5, y0 + 9 + q * 9 + 2, 87, 7, 10, "left", 1.25, (0, 0, 0), 0, False, _wrap("NotoSansJP", 10, 87, rows[t]["name"]))
        _text(c, "NotoSansJP", 106.5, y0 + 9 + q * 9 + 2, 32, 7, 10, "right", 1.25, (0, 0, 0), 0, False, _wrap("NotoSansJP", 10, 32, rows[t]["amount"]))

def _draw_page(c, data, page, page_count, tables):
    if page == 1:
        _text(c, "NotoSansJP", 0, 18, 210, 12, 22, "center", 1.25, (0, 0, 0), 0, False, _wrap("NotoSansJP", 22, 210, _interpolate(data, "{title}")))
    if page == 1:
        _image(c, 15, 15, 20, 20, "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", 0)
    if page == 1:
        _text(c, "NotoSansJP", 130, 41.25, 60, 6, 11, "left", 1.25, (0, 0, 0), 0, False, ["株式会社サンプル"])
    if page == 1:
        _text(c, "NotoSansJP", 130, 48.75, 60, 10, 9, "left", 1.25, (0, 0, 0), 0, False, _wrap("NotoSansJP", 9, 60, _interpolate(data, "{issuerAddr}")))
    if page == 1:
        _line(c, 15, 49, 105, 49, 0.4, (0, 0, 0), None, 0)
    rows, chunks = tables["items"]
    if page <= len(chunks):
        _table_items(c, rows, page - 1, sum(chunks[:page - 1]), chunks[page - 1])
    if page == page_count:
        _text(c, "NotoSansJP", 110, 250, 40, 8, 12, "left", 1.25, (0, 0, 0), 0, False, ["合計(税込)"])
    if page == page_count:
        _rect(c, 108, 247, 89, 12, 0.5, (0, 0, 0), None, None, 0, 0)
    _text(c, "NotoSansJP", 0, 285, 210, 6, 9, "center", 1.25, (0, 0, 0), 0, False, _wrap("NotoSansJP", 9, 210, _page_label("{n} / {N}", page, page_count)))

def build(output_path, data=None):
    data = {} if data is None else data
    _register_fonts()
    rows_items = _bind_rows(data, "items", ["name", "amount"])
    chunks_items = _chunk_sizes(len(rows_items), 10, 15, 22)
    tables = {"items": (rows_items, chunks_items)}
    page_count = max(1, len(chunks_items))
    if page_count > PAGE_COUNT_MAX:
        sys.exit(f"展開後の総ページ数 {page_count} が上限 {PAGE_COUNT_MAX} を超えています")
    c = Canvas(output_path, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    for page in range(1, page_count + 1):
        _draw_page(c, data, page, page_count, tables)
        c.showPage()
    c.save()

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "output.pdf")
