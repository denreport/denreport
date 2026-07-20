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

def _chunk_merges(rows, spans, merge_cols, col_keys, row_offset, chunk_size):
    intervals = []
    boundaries = set()
    for col in merge_cols:
        key = col_keys[col]
        n = len(rows)
        changes = []
        start = 0
        for t in range(1, n + 1):
            prev = rows[t - 1].get(key, "")
            changed = t == n or rows[t].get(key, "") != prev
            if changed or t in boundaries:
                if t - start >= 2 and prev != "":
                    intervals.append((start, t, col, 1))
                if changed and t < n:
                    changes.append(t)
                start = t
        boundaries.update(changes)
    for row, col, row_span, col_span in spans:
        intervals.append((row, row + row_span, col, col_span))
    rects = {}
    covered = set()
    h_skips = {}
    v_skips = {}
    for start, end, col, col_span in intervals:
        s = max(start, row_offset)
        e = min(end, row_offset + chunk_size)
        if e <= s:
            continue
        q = s - row_offset
        row_span = e - s
        rects[(q, col)] = (row_span, col_span)
        for r in range(q, q + row_span):
            for c2 in range(col, col + col_span):
                if r != q or c2 != col:
                    covered.add((r, c2))
        for line in range(q + 1, q + row_span):
            h_skips.setdefault(line, []).append((col, col + col_span))
        for c2 in range(col + 1, col + col_span):
            v_skips.setdefault(c2, []).append((q, q + row_span))
    return rects, covered, h_skips, v_skips

def _kept(start, end, skips):
    out = []
    pos = start
    for s, e in sorted(skips):
        s = max(s, pos)
        e = min(e, end)
        if e <= s:
            continue
        if pos < s:
            out.append((pos, s))
        pos = e
    if pos < end:
        out.append((pos, end))
    return out

def _row_edge(y0, header_h, row_h, edge):
    return y0 if edge < 0 else y0 + header_h + edge * row_h

def _table_items(c, rows, chunk_index, row_offset, chunk_size):
    y0 = 40 if chunk_index == 0 else 40
    xs = [15, 55, 115, 155]
    rects, covered, h_skips, v_skips = _chunk_merges(rows, [(0, 1, 1, 2)], [0], ["category", "name", "amount"], row_offset, chunk_size)
    _rect(c, 15, y0, 140, 9 + chunk_size * 9, 0.4, (0, 0, 0), None, None, 0, 0)
    for q in range(chunk_size):
        y = y0 + 9 + q * 9
        for s, e in _kept(0, 3, h_skips.get(q, [])):
            _line(c, xs[s], y, xs[e], y, 0.25, (0, 0, 0), None, 0)
    for s, e in _kept(-1, chunk_size, v_skips.get(1, [])):
        _line(c, 55, _row_edge(y0, 9, 9, s), 55, _row_edge(y0, 9, 9, e), 0.25, (0, 0, 0), None, 0)
    for s, e in _kept(-1, chunk_size, v_skips.get(2, []) + [(-1, 0)]):
        _line(c, 115, _row_edge(y0, 9, 9, s), 115, _row_edge(y0, 9, 9, e), 0.25, (0, 0, 0), None, 0)
    _text(c, "NotoSansJP", 16.5, y0 + 1.8, 37, 7.2, 10, "center", 1.25, (0, 0, 0), 0, False, ["分類"])
    _text(c, "NotoSansJP", 56.5, y0 + 1.8, 97, 7.2, 10, "center", 1.25, (0, 0, 0), 0, False, ["品目"])
    for q in range(chunk_size):
        t = row_offset + q
        if t >= len(rows):
            continue
        if (q, 0) not in covered:
            _rs, _cs = rects.get((q, 0), (1, 1))
            _w = xs[0 + _cs] - xs[0] - 3
            _text(c, "NotoSansJP", xs[0] + 1.5, y0 + 9 + q * 9 + 2, _w, _rs * 9 - 2, 10, "left", 1.25, (0, 0, 0), 0, False, _wrap("NotoSansJP", 10, _w, rows[t]["category"]))
        if (q, 1) not in covered:
            _rs, _cs = rects.get((q, 1), (1, 1))
            _w = xs[1 + _cs] - xs[1] - 3
            _text(c, "NotoSansJP", xs[1] + 1.5, y0 + 9 + q * 9 + 2, _w, _rs * 9 - 2, 10, "left", 1.25, (0, 0, 0), 0, False, _wrap("NotoSansJP", 10, _w, rows[t]["name"]))
        if (q, 2) not in covered:
            _rs, _cs = rects.get((q, 2), (1, 1))
            _w = xs[2 + _cs] - xs[2] - 3
            _text(c, "NotoSansJP", xs[2] + 1.5, y0 + 9 + q * 9 + 2, _w, _rs * 9 - 2, 10, "right", 1.25, (0, 0, 0), 0, False, _wrap("NotoSansJP", 10, _w, rows[t]["amount"]))

def _draw_page(c, data, page, page_count, tables):
    rows, chunks = tables["items"]
    if page <= len(chunks):
        _table_items(c, rows, page - 1, sum(chunks[:page - 1]), chunks[page - 1])

def build(output_path, data=None):
    data = {} if data is None else data
    _register_fonts()
    rows_items = _bind_rows(data, "items", ["category", "name", "amount"])
    chunks_items = _chunk_sizes(len(rows_items), 0, 5, 5)
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
