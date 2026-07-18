import type {
  CharWidthEm,
  IrBarcodeElement,
  IrDocument,
  IrEllipseElement,
  IrImageElement,
  IrLineElement,
  IrPageNumberElement,
  IrPages,
  IrPlacedElement,
  IrRectElement,
  IrTableElement,
  IrTextElement,
  LoweredTextElement,
} from "@denreport/core";
import {
  layoutTextLines,
  PAGE_COUNT_MAX,
  resolveEllipseStyle,
  resolveFlex,
  resolveFootnotes,
  resolveLineStyle,
  resolveRectStyle,
  TABLE_CELL_PADDING_X,
  TABLE_CELL_TEXT_OFFSET_Y,
  TABLE_FRAME_WIDTH,
  TABLE_GRID_WIDTH,
  TABLE_HEADER_TEXT_OFFSET_Y,
  textTemplateKeys,
} from "@denreport/core";
import { detectFontFormat } from "../fonts/format";
import { readAscentPerEm } from "../fonts/metrics";
import type { FontIssue } from "../fonts/validate";
import { validateFont } from "../fonts/validate";
import { readCharWidths } from "../fonts/widths";
import { pyNumber, pyRgb, pyString } from "./python";
import {
  BARCODE_FN,
  buildImports,
  ELLIPSE_FN,
  IMAGE_FN,
  LINE_FN,
  MAIN_BLOCK,
  RECT_FN,
  REGISTER_FONT_FN,
  REPORTLAB_BARCODE_NAMES,
  statementFor,
  TEXT_FN,
} from "./snippets";
import type { ExportReportlabResult } from "./types";

const TABLE_BLACK_RGB = pyRgb("#000000");

const BIND_STR_FN = [
  "def _bind_str(data, key):",
  "    if key not in data:",
  "        sys.exit(f'データにキー \"{key}\" がありません')",
  "    value = data[key]",
  "    if not isinstance(value, str):",
  "        sys.exit(f'キー \"{key}\" の値が string ではありません')",
  "    return value",
].join("\n");

// ir/interpolate.ts の走査パターンと同一（二重実装のため同期が必要）
const INTERPOLATE_FN = [
  '_TOKEN_RE = re.compile(r"\\{([A-Za-z_][A-Za-z0-9_]{0,63})\\}")',
  "",
  "def _interpolate(data, template):",
  "    return _TOKEN_RE.sub(lambda m: _bind_str(data, m.group(1)), template)",
].join("\n");

// ir/text-layout.ts の折り返し・行頭禁則アルゴリズムと同一（二重実装のため同期が必要）
const WRAP_FN = [
  '_KINSOKU_HEAD = "、。，．）｝］」』】〕〉》｡､｣,.)]}"',
  "",
  "def _wrap(font, size, w, text):",
  "    lines = []",
  '    for paragraph in text.split("\\n"):',
  '        line = ""',
  "        for ch in paragraph:",
  "            if line and pdfmetrics.stringWidth(line + ch, font, size) > w * mm:",
  "                lines.append(line)",
  "                line = ch",
  "                while line[0] in _KINSOKU_HEAD and len(lines[-1]) >= 2:",
  "                    line = lines[-1][-1] + line",
  "                    lines[-1] = lines[-1][:-1]",
  "            else:",
  "                line += ch",
  "        lines.append(line)",
  "    return lines",
].join("\n");

const BIND_ROWS_FN = [
  "def _bind_rows(data, key, column_keys):",
  "    if key not in data:",
  "        sys.exit(f'データにキー \"{key}\" がありません')",
  "    raw = data[key]",
  "    if not isinstance(raw, list):",
  "        sys.exit(f'キー \"{key}\" の値が配列ではありません')",
  "    rows = []",
  "    for t, raw_row in enumerate(raw):",
  "        if not isinstance(raw_row, dict):",
  '            sys.exit(f"{t}行目がオブジェクトではありません")',
  "        row = {}",
  "        for column_key in column_keys:",
  "            value = raw_row.get(column_key)",
  "            if not isinstance(value, str):",
  "                sys.exit(f'{t}行目のキー \"{column_key}\" の値が string ではありません')",
  "            row[column_key] = value",
  "        rows.append(row)",
  "    return rows",
].join("\n");

const APPLY_CELL_OVERRIDES_FN = [
  "def _apply_cell_overrides(rows, min_rows, overrides):",
  "    rows = [dict(row) for row in rows]",
  "    row_count = max(len(rows), min_rows)",
  "    for r, k, v in overrides:",
  "        if r >= row_count:",
  "            continue",
  "        while len(rows) <= r:",
  "            rows.append({})",
  "        rows[r][k] = v",
  "    return rows",
].join("\n");

const CHUNK_SIZES_FN = [
  "def _chunk_sizes(row_count, min_rows, k_first, k_cont):",
  "    m = max(row_count, min_rows)",
  "    if m <= k_first:",
  "        return [min(m, k_first)]",
  "    if k_cont < 1:",
  '        sys.exit("表が継続ページに1行も入りません")',
  "    chunk_sizes = [k_first]",
  "    remaining = m - k_first",
  "    while remaining > 0:",
  "        size = min(remaining, k_cont)",
  "        chunk_sizes.append(size)",
  "        remaining -= size",
  "    return chunk_sizes",
].join("\n");

const PAGE_LABEL_FN = [
  "def _page_label(fmt, page, page_count):",
  '    return fmt.replace("{n}", str(page)).replace("{N}", str(page_count))',
].join("\n");

function buildHeader(hasImage: boolean): string {
  const requirement = hasImage
    ? "実行要件: Python 3, reportlab, Pillow（画像の描画に使用）"
    : "実行要件: Python 3, reportlab";
  return [
    '"""生成物であり、手編集を想定しない。',
    "",
    requirement,
    "",
    "フォント: 書き出し時に併せて出力されるフォントファイル（FONT_FILE）を",
    "このファイルと同じディレクトリに置くこと。見つからない場合はエラー終了する。",
    "",
    "使い方: python <このファイル> [出力.pdf]（省略時 output.pdf。データなしで実行され、",
    "差し込みキーがある場合はエラー終了する）",
    'プログラムから: from report import build; build("出力.pdf", data)',
    "data は差し込み値の辞書。text 内の {key} トークンのキー → 文字列、table の bind キー → 行辞書のリスト。",
    '"""',
  ].join("\n");
}

function buildConstants(document: IrDocument, ascentPerEm: number): string {
  return [
    `FONT_NAME = ${pyString(document.font.name)}`,
    `FONT_FILE = ${pyString(`${document.font.name}.ttf`)}`,
    `FONT_ASCENT_EM = ${pyNumber(ascentPerEm)}`,
    `PAGE_WIDTH = ${pyNumber(document.page.width)} * mm`,
    `PAGE_HEIGHT = ${pyNumber(document.page.height)} * mm`,
    `PAGE_COUNT_MAX = ${pyNumber(PAGE_COUNT_MAX)}`,
  ].join("\n");
}

// lowerIr 内の非公開関数と同じ式（IR のページ分割仕様そのもの）
function rowCapacity(
  maxY: number,
  top: number,
  headerHeight: number,
  rowHeight: number,
): number {
  return Math.floor((maxY - top - headerHeight) / rowHeight);
}

function xOf(table: IrTableElement, index: number): number {
  return (
    table.x +
    table.columns.slice(0, index).reduce((total, col) => total + col.width, 0)
  );
}

function buildTableFunction(
  table: IrTableElement,
  wrapText: (
    content: string,
    widthMm: number,
    fontSize: number,
  ) => readonly string[],
): string {
  const hasOverrides = (table.cellOverrides?.length ?? 0) > 0;
  const width = table.columns.reduce((total, col) => total + col.width, 0);
  const height = `${pyNumber(table.headerHeight)} + chunk_size * ${pyNumber(table.rowHeight)}`;
  const lines: string[] = [
    `def _table_${table.id}(c, font, rows, chunk_index, row_offset, chunk_size):`,
    `    y0 = ${pyNumber(table.y)} if chunk_index == 0 else ${pyNumber(table.continuationY)}`,
  ];
  if (table.stripeColor !== undefined) {
    lines.push(
      "    for q in range(chunk_size):",
      "        if (row_offset + q) % 2 == 1:",
      `            _rect(c, ${pyNumber(table.x)}, y0 + ${pyNumber(table.headerHeight)} + q * ${pyNumber(table.rowHeight)}, ${pyNumber(width)}, ${pyNumber(table.rowHeight)}, 0, ${TABLE_BLACK_RGB}, ${pyRgb(table.stripeColor)}, None, 0)`,
    );
  }
  lines.push(
    `    _rect(c, ${pyNumber(table.x)}, y0, ${pyNumber(width)}, ${height}, ${pyNumber(TABLE_FRAME_WIDTH)}, ${TABLE_BLACK_RGB}, None, None, 0)`,
    "    for q in range(chunk_size):",
    `        _line(c, ${pyNumber(table.x)}, y0 + ${pyNumber(table.headerHeight)} + q * ${pyNumber(table.rowHeight)}, ${pyNumber(table.x + width)}, y0 + ${pyNumber(table.headerHeight)} + q * ${pyNumber(table.rowHeight)}, ${pyNumber(TABLE_GRID_WIDTH)}, ${TABLE_BLACK_RGB}, None)`,
  );
  for (let i = 1; i < table.columns.length; i++) {
    const x = pyNumber(xOf(table, i));
    lines.push(
      `    _line(c, ${x}, y0, ${x}, y0 + ${height}, ${pyNumber(TABLE_GRID_WIDTH)}, ${TABLE_BLACK_RGB}, None)`,
    );
  }
  table.columns.forEach((column, i) => {
    const cellWidth = column.width - 2 * TABLE_CELL_PADDING_X;
    const headerLines = wrapText(column.label, cellWidth, table.fontSize)
      .map(pyString)
      .join(", ");
    lines.push(
      `    _text(c, font, ${pyNumber(xOf(table, i) + TABLE_CELL_PADDING_X)}, y0 + ${pyNumber(TABLE_HEADER_TEXT_OFFSET_Y)}, ${pyNumber(cellWidth)}, ${pyNumber(table.fontSize)}, "center", 1.25, [${headerLines}])`,
    );
  });
  lines.push(
    "    for q in range(chunk_size):",
    "        t = row_offset + q",
    "        if t >= len(rows):",
    "            continue",
  );
  table.columns.forEach((column, i) => {
    const cellAccess = hasOverrides
      ? `rows[t].get(${pyString(column.key)}, "")`
      : `rows[t][${pyString(column.key)}]`;
    const cellWidth = column.width - 2 * TABLE_CELL_PADDING_X;
    lines.push(
      `        _text(c, font, ${pyNumber(xOf(table, i) + TABLE_CELL_PADDING_X)}, y0 + ${pyNumber(table.headerHeight)} + q * ${pyNumber(table.rowHeight)} + ${pyNumber(TABLE_CELL_TEXT_OFFSET_Y)}, ${pyNumber(cellWidth)}, ${pyNumber(table.fontSize)}, ${pyString(column.align)}, 1.25, _wrap(font, ${pyNumber(table.fontSize)}, ${pyNumber(cellWidth)}, ${cellAccess}))`,
    );
  });
  return lines.join("\n");
}

function pageGuard(pages: IrPages): string | null {
  switch (pages) {
    case "all":
      return null;
    case "first":
      return "if page == 1:";
    case "last":
      return "if page == page_count:";
    case "rest":
      return "if page >= 2:";
  }
}

function guardedStatement(pages: IrPages, statement: string): string[] {
  const guard = pageGuard(pages);
  return guard === null
    ? [`    ${statement}`]
    : [`    ${guard}`, `        ${statement}`];
}

function staticTextStatement(
  element: IrTextElement,
  layoutLines: (el: LoweredTextElement) => readonly string[],
): string {
  const text = element.text;
  if (textTemplateKeys(text).length === 0) {
    return statementFor(
      {
        type: "text",
        sourceId: element.id,
        x: element.x,
        y: element.y,
        w: element.w,
        h: element.h,
        content: text,
        fontSize: element.fontSize,
        align: element.align,
        lineHeight: element.lineHeight,
      },
      layoutLines,
    );
  }
  return `_text(c, font, ${pyNumber(element.x)}, ${pyNumber(element.y)}, ${pyNumber(element.w)}, ${pyNumber(element.fontSize)}, ${pyString(element.align)}, ${pyNumber(element.lineHeight)}, _wrap(font, ${pyNumber(element.fontSize)}, ${pyNumber(element.w)}, _interpolate(data, ${pyString(text)})))`;
}

function pageNumberStatement(element: IrPageNumberElement): string {
  return `_text(c, font, ${pyNumber(element.x)}, ${pyNumber(element.y)}, ${pyNumber(element.w)}, ${pyNumber(element.fontSize)}, ${pyString(element.align)}, ${pyNumber(element.lineHeight)}, _wrap(font, ${pyNumber(element.fontSize)}, ${pyNumber(element.w)}, _page_label(${pyString(element.format)}, page, page_count)))`;
}

function barcodeStatement(
  element: IrBarcodeElement,
  layoutLines: (el: LoweredTextElement) => readonly string[],
): string {
  const value = element.value;
  if (textTemplateKeys(value).length === 0) {
    return statementFor(
      {
        type: "barcode",
        sourceId: element.id,
        x: element.x,
        y: element.y,
        w: element.w,
        h: element.h,
        symbology: element.symbology,
        content: value,
      },
      layoutLines,
    );
  }
  const name = pyString(REPORTLAB_BARCODE_NAMES[element.symbology]);
  return `_barcode(c, ${name}, _interpolate(data, ${pyString(value)}), ${pyNumber(element.x)}, ${pyNumber(element.y)}, ${pyNumber(element.w)}, ${pyNumber(element.h)})`;
}

function staticElementStatement(
  element: IrLineElement | IrRectElement | IrEllipseElement | IrImageElement,
  layoutLines: (el: LoweredTextElement) => readonly string[],
): string {
  switch (element.type) {
    case "line": {
      const style = resolveLineStyle(element);
      return statementFor(
        {
          type: "line",
          sourceId: element.id,
          x: element.x,
          y: element.y,
          orientation: element.orientation,
          length: element.length,
          thickness: element.thickness,
          color: style.color,
          strokeStyle: style.strokeStyle,
        },
        layoutLines,
      );
    }
    case "rect": {
      const style = resolveRectStyle(element);
      return statementFor(
        {
          type: "rect",
          sourceId: element.id,
          x: element.x,
          y: element.y,
          w: element.w,
          h: element.h,
          borderWidth: element.borderWidth,
          borderColor: style.borderColor,
          fillColor: style.fillColor,
          borderStyle: style.borderStyle,
          cornerRadius: style.cornerRadius,
        },
        layoutLines,
      );
    }
    case "ellipse": {
      const style = resolveEllipseStyle(element);
      return statementFor(
        {
          type: "ellipse",
          sourceId: element.id,
          x: element.x,
          y: element.y,
          w: element.w,
          h: element.h,
          borderWidth: element.borderWidth,
          borderColor: style.borderColor,
          fillColor: style.fillColor,
        },
        layoutLines,
      );
    }
    case "image":
      return statementFor(
        {
          type: "image",
          sourceId: element.id,
          x: element.x,
          y: element.y,
          w: element.w,
          h: element.h,
          src: element.src,
        },
        layoutLines,
      );
  }
}

function tableDrawBlock(table: IrTableElement): string[] {
  return [
    `    rows, chunks = tables[${pyString(table.id)}]`,
    "    if page <= len(chunks):",
    `        _table_${table.id}(c, font, rows, page - 1, sum(chunks[:page - 1]), chunks[page - 1])`,
  ];
}

function buildDrawPage(
  placed: readonly IrPlacedElement[],
  hasTables: boolean,
  layoutLines: (el: LoweredTextElement) => readonly string[],
): string {
  const body: string[] = [];
  for (const element of placed) {
    switch (element.type) {
      case "table":
        body.push(...tableDrawBlock(element));
        break;
      case "pageNumber":
        body.push(
          ...guardedStatement(element.pages, pageNumberStatement(element)),
        );
        break;
      case "text":
        body.push(
          ...guardedStatement(
            element.pages,
            staticTextStatement(element, layoutLines),
          ),
        );
        break;
      case "line":
      case "rect":
      case "ellipse":
      case "image":
        body.push(
          ...guardedStatement(
            element.pages,
            staticElementStatement(element, layoutLines),
          ),
        );
        break;
      case "barcode":
        body.push(
          ...guardedStatement(
            element.pages,
            barcodeStatement(element, layoutLines),
          ),
        );
        break;
    }
  }
  const params = hasTables
    ? "c, font, data, page, page_count, tables"
    : "c, font, data, page, page_count";
  return `def _draw_page(${params}):\n${body.length === 0 ? "    pass" : body.join("\n")}`;
}

function buildBuildFunction(tables: readonly IrTableElement[]): string {
  const lines = [
    "def build(output_path, data=None):",
    "    data = {} if data is None else data",
    "    font = _register_font()",
  ];
  if (tables.length > 0) {
    for (const table of tables) {
      const kFirst = rowCapacity(
        table.maxY,
        table.y,
        table.headerHeight,
        table.rowHeight,
      );
      const kCont = rowCapacity(
        table.maxY,
        table.continuationY,
        table.headerHeight,
        table.rowHeight,
      );
      const columnKeys = table.columns
        .map((column) => pyString(column.key))
        .join(", ");
      lines.push(
        `    rows_${table.id} = _bind_rows(data, ${pyString(table.bind)}, [${columnKeys}])`,
      );
      if ((table.cellOverrides?.length ?? 0) > 0) {
        const overridesLiteral = (table.cellOverrides ?? [])
          .map(
            (o) =>
              `(${pyNumber(o.row)}, ${pyString(o.key)}, ${pyString(o.value)})`,
          )
          .join(", ");
        lines.push(
          `    rows_${table.id} = _apply_cell_overrides(rows_${table.id}, ${pyNumber(table.minRows)}, [${overridesLiteral}])`,
        );
      }
      lines.push(
        `    chunks_${table.id} = _chunk_sizes(len(rows_${table.id}), ${pyNumber(table.minRows)}, ${pyNumber(kFirst)}, ${pyNumber(kCont)})`,
      );
    }
    const tableEntries = tables
      .map(
        (table) =>
          `${pyString(table.id)}: (rows_${table.id}, chunks_${table.id})`,
      )
      .join(", ");
    lines.push(`    tables = {${tableEntries}}`);
    const pageCounts = tables
      .map((table) => `len(chunks_${table.id})`)
      .join(", ");
    lines.push(`    page_count = max(1, ${pageCounts})`);
    if (tables.length > 1) {
      const multiPage = tables
        .map((table) => `len(chunks_${table.id}) >= 2`)
        .join(", ");
      lines.push(
        `    if [${multiPage}].count(True) >= 2:`,
        '        sys.exit("2ページ以上に展開される表が複数あります")',
      );
    }
    lines.push(
      "    if page_count > PAGE_COUNT_MAX:",
      '        sys.exit(f"展開後の総ページ数 {page_count} が上限 {PAGE_COUNT_MAX} を超えています")',
    );
  } else {
    lines.push("    page_count = 1");
  }
  const drawArgs = tables.length > 0 ? ", tables" : "";
  lines.push(
    "    c = Canvas(output_path, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))",
    "    for page in range(1, page_count + 1):",
    `        _draw_page(c, font, data, page, page_count${drawArgs})`,
    "        c.showPage()",
    "    c.save()",
  );
  return lines.join("\n");
}

function buildTemplateSource(
  document: IrDocument,
  ascentPerEm: number,
  charWidthEm: CharWidthEm,
): string {
  const resolved = resolveFootnotes(document);
  const placed = resolveFlex(resolved);
  const tables = placed.filter(
    (element): element is IrTableElement => element.type === "table",
  );
  const hasTables = tables.length > 0;
  const hasImage = placed.some((element) => element.type === "image");
  const hasBarcode = placed.some((element) => element.type === "barcode");
  const hasTokenText = placed.some(
    (element) =>
      (element.type === "text" && textTemplateKeys(element.text).length > 0) ||
      (element.type === "barcode" &&
        textTemplateKeys(element.value).length > 0),
  );
  const hasPageNumber = placed.some((element) => element.type === "pageNumber");
  const hasCellOverrides = tables.some(
    (table) => (table.cellOverrides?.length ?? 0) > 0,
  );
  const needsText =
    hasTables ||
    placed.some(
      (element) => element.type === "text" || element.type === "pageNumber",
    );
  const needsLine =
    hasTables || placed.some((element) => element.type === "line");
  const needsRect =
    hasTables || placed.some((element) => element.type === "rect");
  const needsEllipse = placed.some((element) => element.type === "ellipse");
  // トークンつき text・table・pageNumber はいずれも値が実行時にしか確定せず、Python 側で折り返す
  const needsWrapFn = hasTokenText || hasTables || hasPageNumber;

  const helperFns = [
    REGISTER_FONT_FN,
    ...(needsText ? [TEXT_FN] : []),
    ...(needsLine ? [LINE_FN] : []),
    ...(needsRect ? [RECT_FN] : []),
    ...(needsEllipse ? [ELLIPSE_FN] : []),
    ...(hasImage ? [IMAGE_FN] : []),
    ...(hasBarcode ? [BARCODE_FN] : []),
    ...(hasTokenText ? [BIND_STR_FN] : []),
    ...(hasTokenText ? [INTERPOLATE_FN] : []),
    ...(needsWrapFn ? [WRAP_FN] : []),
    ...(hasTables ? [BIND_ROWS_FN, CHUNK_SIZES_FN] : []),
    ...(hasCellOverrides ? [APPLY_CELL_OVERRIDES_FN] : []),
    ...(hasPageNumber ? [PAGE_LABEL_FN] : []),
  ];

  // align は行分割そのものには影響しない（justify の字間は生成 Python が実行時に計算する）ため固定値を渡す
  const wrapText = (
    content: string,
    widthMm: number,
    fontSize: number,
  ): readonly string[] =>
    layoutTextLines(
      { content, widthMm, fontSize, align: "left" },
      charWidthEm,
    ).map((line) => line.text);
  const layoutLines = (el: LoweredTextElement): readonly string[] =>
    wrapText(el.content, el.w, el.fontSize);

  const sections = [
    buildHeader(hasImage),
    buildImports(hasImage, hasTokenText, hasBarcode),
    buildConstants(resolved, ascentPerEm),
    helperFns.join("\n\n"),
    ...tables.map((table) => buildTableFunction(table, wrapText)),
    buildDrawPage(placed, hasTables, layoutLines),
    buildBuildFunction(tables),
    MAIN_BLOCK,
  ];

  return `${sections.join("\n\n")}\n`;
}

/**
 * Generates a standalone reportlab Python script from `document` alone (no
 * `data`): text/table bindings are resolved inside the generated script's
 * `build(output_path, data)` function at Python run time, so one script can
 * render many different data sets. Data-related failures therefore cannot
 * occur here (`errors` is always empty on failure); `fontData` must still be
 * a valid TTF, otherwise export fails with fontIssues explaining why.
 */
export function exportReportlabTemplate(
  document: IrDocument,
  fontData: Uint8Array,
): ExportReportlabResult {
  const fontIssues: FontIssue[] = [...validateFont(fontData)];
  const ascentPerEm = readAscentPerEm(fontData);
  const charWidthEm = readCharWidths(fontData);
  if (fontIssues.length === 0 && ascentPerEm === null) {
    fontIssues.push({
      format: detectFontFormat(fontData),
      message:
        "フォントの計量（head / hhea テーブル）を読み取れないため、テキストのベースライン位置を確定できません。別の TTF フォントを使用してください。",
    });
  }
  if (fontIssues.length === 0 && charWidthEm === null) {
    fontIssues.push({
      format: detectFontFormat(fontData),
      message:
        "フォントの字幅（cmap / hmtx テーブル）を読み取れないため、テキストの折り返し・均等割付を計算できません。別の TTF フォントを使用してください。",
    });
  }
  if (fontIssues.length > 0 || ascentPerEm === null || charWidthEm === null) {
    return { ok: false, errors: [], fontIssues };
  }
  return {
    ok: true,
    code: buildTemplateSource(document, ascentPerEm, charWidthEm),
    fontFile: {
      filename: `${document.font.name}.ttf`,
      data: fontData,
    },
    warnings: [],
  };
}
