import type {
  CharWidthEm,
  IrBarcodeElement,
  IrDocument,
  IrEllipseElement,
  IrFont,
  IrFontSlot,
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
  computeChunkMerges,
  layoutTextLines,
  PAGE_COUNT_MAX,
  resolveEllipseStyle,
  resolveFlex,
  resolveFontSlot,
  resolveFootnotes,
  resolveLineStyle,
  resolveRectStyle,
  resolveTextStyle,
  TABLE_CELL_PADDING_X,
  TABLE_CELL_TEXT_OFFSET_Y,
  TABLE_FRAME_WIDTH,
  TABLE_GRID_WIDTH,
  TABLE_HEADER_TEXT_OFFSET_Y,
  textTemplateKeys,
} from "@denreport/core";
import type { FontSetData, ResolvedSlotFont } from "../fonts/set";
import { effectiveFontOf, resolveFontSetData } from "../fonts/set";
import {
  getMessages,
  type MessageLocale,
  type Messages,
} from "../i18n/messages";
import { pyBool, pyNumber, pyRgb, pyString } from "./python";
import type { ReportlabFontEntry } from "./snippets";
import {
  BARCODE_FN,
  buildFontsConstant,
  buildImports,
  CHUNK_MERGES_FN,
  ELLIPSE_FN,
  fontEntriesFor,
  IMAGE_FN,
  KEPT_SEGMENTS_FN,
  LINE_FN,
  MAIN_BLOCK,
  pyDash,
  RECT_FN,
  REPORTLAB_BARCODE_NAMES,
  ROW_EDGE_FN,
  registerFontsFn,
  statementFor,
  TEXT_FN,
} from "./snippets";
import type { ExportReportlabResult } from "./types";

const TABLE_BLACK_RGB = pyRgb("#000000");

function bindStrFn(messages: Messages): string {
  return [
    "def _bind_str(data, key):",
    "    if key not in data:",
    `        sys.exit(f'${messages.reportlab.bindStrMissingKey}')`,
    "    value = data[key]",
    "    if not isinstance(value, str):",
    `        sys.exit(f'${messages.reportlab.bindStrNotString}')`,
    "    return value",
  ].join("\n");
}

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

function bindRowsFn(messages: Messages): string {
  return [
    "def _bind_rows(data, key, column_keys):",
    "    if key not in data:",
    `        sys.exit(f'${messages.reportlab.bindStrMissingKey}')`,
    "    raw = data[key]",
    "    if not isinstance(raw, list):",
    `        sys.exit(f'${messages.reportlab.bindRowsNotArray}')`,
    "    rows = []",
    "    for t, raw_row in enumerate(raw):",
    "        if not isinstance(raw_row, dict):",
    `            sys.exit(f"${messages.reportlab.bindRowsRowNotObject}")`,
    "        row = {}",
    "        for column_key in column_keys:",
    "            value = raw_row.get(column_key)",
    "            if not isinstance(value, str):",
    `                sys.exit(f'${messages.reportlab.bindRowsCellNotString}')`,
    "            row[column_key] = value",
    "        rows.append(row)",
    "    return rows",
  ].join("\n");
}

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

function chunkSizesFn(messages: Messages): string {
  return [
    "def _chunk_sizes(row_count, min_rows, k_first, k_cont):",
    "    m = max(row_count, min_rows)",
    "    if m <= k_first:",
    "        return [min(m, k_first)]",
    "    if k_cont < 1:",
    `        sys.exit("${messages.reportlab.chunkSizesNoRoomInContinuation}")`,
    "    chunk_sizes = [k_first]",
    "    remaining = m - k_first",
    "    while remaining > 0:",
    "        size = min(remaining, k_cont)",
    "        chunk_sizes.append(size)",
    "        remaining -= size",
    "    return chunk_sizes",
  ].join("\n");
}

const PAGE_LABEL_FN = [
  "def _page_label(fmt, page, page_count):",
  '    return fmt.replace("{n}", str(page)).replace("{N}", str(page_count))',
].join("\n");

function buildHeader(messages: Messages, hasImage: boolean): string {
  const requirement = hasImage
    ? messages.reportlab.header.requirementWithImage
    : messages.reportlab.header.requirement;
  return [
    `"""${messages.reportlab.header.notice}`,
    "",
    requirement,
    "",
    messages.reportlab.header.fontNoticeLine1,
    messages.reportlab.header.fontNoticeLine2,
    "",
    messages.reportlab.header.templateUsageLine1,
    messages.reportlab.header.templateUsageLine2,
    messages.reportlab.header.templateProgrammatic,
    messages.reportlab.header.templateDataDescription,
    '"""',
  ].join("\n");
}

function buildConstants(
  document: IrDocument,
  entries: readonly ReportlabFontEntry[],
): string {
  return [
    buildFontsConstant(entries),
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
  regularName: string,
  wrapText: (
    content: string,
    widthMm: number,
    fontSize: number,
  ) => readonly string[],
): string {
  const hasOverrides = (table.cellOverrides?.length ?? 0) > 0;
  const width = table.columns.reduce((total, col) => total + col.width, 0);
  const height = `${pyNumber(table.headerHeight)} + chunk_size * ${pyNumber(table.rowHeight)}`;
  const fontName = pyString(regularName);
  const lines: string[] = [
    `def _table_${table.id}(c, rows, chunk_index, row_offset, chunk_size):`,
    `    y0 = ${pyNumber(table.y)} if chunk_index == 0 else ${pyNumber(table.continuationY)}`,
  ];
  if (table.stripeColor !== undefined) {
    lines.push(
      "    for q in range(chunk_size):",
      "        if (row_offset + q) % 2 == 1:",
      `            _rect(c, ${pyNumber(table.x)}, y0 + ${pyNumber(table.headerHeight)} + q * ${pyNumber(table.rowHeight)}, ${pyNumber(width)}, ${pyNumber(table.rowHeight)}, 0, ${TABLE_BLACK_RGB}, ${pyRgb(table.stripeColor)}, None, 0, 0)`,
    );
  }
  const frameWidth = pyNumber(table.frameWidth ?? TABLE_FRAME_WIDTH);
  const frameDash = pyDash(table.frameStyle ?? "solid");
  const gridWidth = pyNumber(table.gridWidth ?? TABLE_GRID_WIDTH);
  const gridDash = pyDash(table.gridStyle ?? "solid");
  lines.push(
    `    _rect(c, ${pyNumber(table.x)}, y0, ${pyNumber(width)}, ${height}, ${frameWidth}, ${TABLE_BLACK_RGB}, None, ${frameDash}, 0, 0)`,
    "    for q in range(chunk_size):",
    `        _line(c, ${pyNumber(table.x)}, y0 + ${pyNumber(table.headerHeight)} + q * ${pyNumber(table.rowHeight)}, ${pyNumber(table.x + width)}, y0 + ${pyNumber(table.headerHeight)} + q * ${pyNumber(table.rowHeight)}, ${gridWidth}, ${TABLE_BLACK_RGB}, ${gridDash}, 0)`,
  );
  for (let i = 1; i < table.columns.length; i++) {
    const x = pyNumber(xOf(table, i));
    lines.push(
      `    _line(c, ${x}, y0, ${x}, y0 + ${height}, ${gridWidth}, ${TABLE_BLACK_RGB}, ${gridDash}, 0)`,
    );
  }
  table.columns.forEach((column, i) => {
    const cellWidth = column.width - 2 * TABLE_CELL_PADDING_X;
    const headerLines = wrapText(column.label, cellWidth, table.fontSize)
      .map(pyString)
      .join(", ");
    lines.push(
      `    _text(c, ${fontName}, ${pyNumber(xOf(table, i) + TABLE_CELL_PADDING_X)}, y0 + ${pyNumber(TABLE_HEADER_TEXT_OFFSET_Y)}, ${pyNumber(cellWidth)}, ${pyNumber(table.headerHeight - TABLE_HEADER_TEXT_OFFSET_Y)}, ${pyNumber(table.fontSize)}, "center", 1.25, ${TABLE_BLACK_RGB}, 0, False, [${headerLines}])`,
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
      `        _text(c, ${fontName}, ${pyNumber(xOf(table, i) + TABLE_CELL_PADDING_X)}, y0 + ${pyNumber(table.headerHeight)} + q * ${pyNumber(table.rowHeight)} + ${pyNumber(TABLE_CELL_TEXT_OFFSET_Y)}, ${pyNumber(cellWidth)}, ${pyNumber(table.rowHeight - TABLE_CELL_TEXT_OFFSET_Y)}, ${pyNumber(table.fontSize)}, ${pyString(column.align)}, 1.25, ${TABLE_BLACK_RGB}, 0, False, _wrap(${fontName}, ${pyNumber(table.fontSize)}, ${pyNumber(cellWidth)}, ${cellAccess}))`,
    );
  });
  return lines.join("\n");
}

function tableHasMerges(table: IrTableElement): boolean {
  return (
    (table.cellSpans?.length ?? 0) > 0 ||
    table.columns.some((column) => column.mergeSameValue === true)
  );
}

// 結合つきの表は、被覆セル・分節罫線が実行時データに依存するため
// _chunk_merges の結果を参照する形の関数を生成する
function buildMergedTableFunction(
  table: IrTableElement,
  regularName: string,
  wrapText: (
    content: string,
    widthMm: number,
    fontSize: number,
  ) => readonly string[],
): string {
  const hasOverrides = (table.cellOverrides?.length ?? 0) > 0;
  const columnCount = table.columns.length;
  const width = table.columns.reduce((total, col) => total + col.width, 0);
  const height = `${pyNumber(table.headerHeight)} + chunk_size * ${pyNumber(table.rowHeight)}`;
  const fontName = pyString(regularName);
  const headerHeight = pyNumber(table.headerHeight);
  const rowHeight = pyNumber(table.rowHeight);
  const pad = pyNumber(2 * TABLE_CELL_PADDING_X);
  const cellOffsetY = pyNumber(TABLE_CELL_TEXT_OFFSET_Y);
  const indexByKey = new Map(table.columns.map((col, i) => [col.key, i]));
  const bodySpans = (table.cellSpans ?? []).flatMap((span) => {
    const col = span.row === "header" ? undefined : indexByKey.get(span.key);
    if (span.row === "header" || col === undefined) return [];
    const colSpan = Math.min(span.colSpan ?? 1, columnCount - col);
    return [
      `(${pyNumber(span.row)}, ${pyNumber(col)}, ${pyNumber(span.rowSpan ?? 1)}, ${pyNumber(colSpan)})`,
    ];
  });
  const mergeCols = table.columns.flatMap((column, i) =>
    column.mergeSameValue === true ? [pyNumber(i)] : [],
  );
  const columnKeys = table.columns
    .map((column) => pyString(column.key))
    .join(", ");
  const xsLiteral = Array.from({ length: columnCount + 1 }, (_, i) =>
    pyNumber(xOf(table, i)),
  ).join(", ");
  // ヘッダの結合は静的（データ非依存）なので生成時に確定させる
  const headerMerges = computeChunkMerges(table, [], 0, 0);

  const lines: string[] = [
    `def _table_${table.id}(c, rows, chunk_index, row_offset, chunk_size):`,
    `    y0 = ${pyNumber(table.y)} if chunk_index == 0 else ${pyNumber(table.continuationY)}`,
    `    xs = [${xsLiteral}]`,
    `    rects, covered, h_skips, v_skips = _chunk_merges(rows, [${bodySpans.join(", ")}], [${mergeCols.join(", ")}], [${columnKeys}], row_offset, chunk_size)`,
  ];
  if (table.stripeColor !== undefined) {
    lines.push(
      "    for q in range(chunk_size):",
      "        if (row_offset + q) % 2 == 1:",
      `            _rect(c, ${pyNumber(table.x)}, y0 + ${headerHeight} + q * ${rowHeight}, ${pyNumber(width)}, ${rowHeight}, 0, ${TABLE_BLACK_RGB}, ${pyRgb(table.stripeColor)}, None, 0, 0)`,
    );
  }
  const frameWidth = pyNumber(table.frameWidth ?? TABLE_FRAME_WIDTH);
  const frameDash = pyDash(table.frameStyle ?? "solid");
  const gridWidth = pyNumber(table.gridWidth ?? TABLE_GRID_WIDTH);
  const gridDash = pyDash(table.gridStyle ?? "solid");
  lines.push(
    `    _rect(c, ${pyNumber(table.x)}, y0, ${pyNumber(width)}, ${height}, ${frameWidth}, ${TABLE_BLACK_RGB}, None, ${frameDash}, 0, 0)`,
    "    for q in range(chunk_size):",
    `        y = y0 + ${headerHeight} + q * ${rowHeight}`,
    `        for s, e in _kept(0, ${pyNumber(columnCount)}, h_skips.get(q, [])):`,
    `            _line(c, xs[s], y, xs[e], y, ${gridWidth}, ${TABLE_BLACK_RGB}, ${gridDash}, 0)`,
  );
  for (let i = 1; i < columnCount; i++) {
    const x = pyNumber(xOf(table, i));
    const headerSkip = headerMerges.verticalSkips.has(i) ? " + [(-1, 0)]" : "";
    lines.push(
      `    for s, e in _kept(-1, chunk_size, v_skips.get(${pyNumber(i)}, [])${headerSkip}):`,
      `        _line(c, ${x}, _row_edge(y0, ${headerHeight}, ${rowHeight}, s), ${x}, _row_edge(y0, ${headerHeight}, ${rowHeight}, e), ${gridWidth}, ${TABLE_BLACK_RGB}, ${gridDash}, 0)`,
    );
  }
  table.columns.forEach((column, i) => {
    if (headerMerges.covered.has(`header:${i}`)) return;
    const rect = headerMerges.rects.find(
      (r) => r.q === "header" && r.col === i,
    );
    const spanWidth =
      rect === undefined
        ? column.width
        : xOf(table, i + rect.colSpan) - xOf(table, i);
    const cellWidth = spanWidth - 2 * TABLE_CELL_PADDING_X;
    const headerLines = wrapText(column.label, cellWidth, table.fontSize)
      .map(pyString)
      .join(", ");
    lines.push(
      `    _text(c, ${fontName}, ${pyNumber(xOf(table, i) + TABLE_CELL_PADDING_X)}, y0 + ${pyNumber(TABLE_HEADER_TEXT_OFFSET_Y)}, ${pyNumber(cellWidth)}, ${pyNumber(table.headerHeight - TABLE_HEADER_TEXT_OFFSET_Y)}, ${pyNumber(table.fontSize)}, "center", 1.25, ${TABLE_BLACK_RGB}, 0, False, [${headerLines}])`,
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
    const index = pyNumber(i);
    lines.push(
      `        if (q, ${index}) not in covered:`,
      `            _rs, _cs = rects.get((q, ${index}), (1, 1))`,
      `            _w = xs[${index} + _cs] - xs[${index}] - ${pad}`,
      `            _text(c, ${fontName}, xs[${index}] + ${pyNumber(TABLE_CELL_PADDING_X)}, y0 + ${headerHeight} + q * ${rowHeight} + ${cellOffsetY}, _w, _rs * ${rowHeight} - ${cellOffsetY}, ${pyNumber(table.fontSize)}, ${pyString(column.align)}, 1.25, ${TABLE_BLACK_RGB}, 0, False, _wrap(${fontName}, ${pyNumber(table.fontSize)}, _w, ${cellAccess}))`,
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
  font: IrFont,
): string {
  const text = element.text;
  const style = resolveTextStyle(element);
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
        color: style.color,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        underline: style.underline,
        rotate: element.rotate ?? 0,
      },
      layoutLines,
      font,
    );
  }
  const fontName = pyString(
    font[resolveFontSlot(font, style.fontWeight, style.fontStyle)] as string,
  );
  return `_text(c, ${fontName}, ${pyNumber(element.x)}, ${pyNumber(element.y)}, ${pyNumber(element.w)}, ${pyNumber(element.h)}, ${pyNumber(element.fontSize)}, ${pyString(element.align)}, ${pyNumber(element.lineHeight)}, ${pyRgb(style.color)}, ${pyNumber(element.rotate ?? 0)}, ${pyBool(style.underline)}, _wrap(${fontName}, ${pyNumber(element.fontSize)}, ${pyNumber(element.w)}, _interpolate(data, ${pyString(text)})))`;
}

function pageNumberStatement(
  element: IrPageNumberElement,
  regularName: string,
): string {
  const color = pyRgb(resolveTextStyle(element).color);
  const fontName = pyString(regularName);
  return `_text(c, ${fontName}, ${pyNumber(element.x)}, ${pyNumber(element.y)}, ${pyNumber(element.w)}, ${pyNumber(element.h)}, ${pyNumber(element.fontSize)}, ${pyString(element.align)}, ${pyNumber(element.lineHeight)}, ${color}, ${pyNumber(element.rotate ?? 0)}, False, _wrap(${fontName}, ${pyNumber(element.fontSize)}, ${pyNumber(element.w)}, _page_label(${pyString(element.format)}, page, page_count)))`;
}

function barcodeStatement(
  element: IrBarcodeElement,
  layoutLines: (el: LoweredTextElement) => readonly string[],
  font: IrFont,
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
        rotate: element.rotate ?? 0,
      },
      layoutLines,
      font,
    );
  }
  const name = pyString(REPORTLAB_BARCODE_NAMES[element.symbology]);
  return `_barcode(c, ${name}, _interpolate(data, ${pyString(value)}), ${pyNumber(element.x)}, ${pyNumber(element.y)}, ${pyNumber(element.w)}, ${pyNumber(element.h)}, ${pyNumber(element.rotate ?? 0)})`;
}

function staticElementStatement(
  element: IrLineElement | IrRectElement | IrEllipseElement | IrImageElement,
  layoutLines: (el: LoweredTextElement) => readonly string[],
  font: IrFont,
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
          rotate: element.rotate ?? 0,
        },
        layoutLines,
        font,
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
          rotate: element.rotate ?? 0,
        },
        layoutLines,
        font,
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
          rotate: element.rotate ?? 0,
        },
        layoutLines,
        font,
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
          rotate: element.rotate ?? 0,
        },
        layoutLines,
        font,
      );
  }
}

function tableDrawBlock(table: IrTableElement): string[] {
  return [
    `    rows, chunks = tables[${pyString(table.id)}]`,
    "    if page <= len(chunks):",
    `        _table_${table.id}(c, rows, page - 1, sum(chunks[:page - 1]), chunks[page - 1])`,
  ];
}

function buildDrawPage(
  placed: readonly IrPlacedElement[],
  hasTables: boolean,
  layoutLines: (el: LoweredTextElement) => readonly string[],
  font: IrFont,
): string {
  const body: string[] = [];
  for (const element of placed) {
    switch (element.type) {
      case "table":
        body.push(...tableDrawBlock(element));
        break;
      case "pageNumber":
        body.push(
          ...guardedStatement(
            element.pages,
            pageNumberStatement(element, font.regular),
          ),
        );
        break;
      case "text":
        body.push(
          ...guardedStatement(
            element.pages,
            staticTextStatement(element, layoutLines, font),
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
            staticElementStatement(element, layoutLines, font),
          ),
        );
        break;
      case "barcode":
        body.push(
          ...guardedStatement(
            element.pages,
            barcodeStatement(element, layoutLines, font),
          ),
        );
        break;
    }
  }
  const params = hasTables
    ? "c, data, page, page_count, tables"
    : "c, data, page, page_count";
  return `def _draw_page(${params}):\n${body.length === 0 ? "    pass" : body.join("\n")}`;
}

function buildBuildFunction(
  tables: readonly IrTableElement[],
  messages: Messages,
): string {
  const lines = [
    "def build(output_path, data=None):",
    "    data = {} if data is None else data",
    "    _register_fonts()",
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
        `        sys.exit("${messages.reportlab.multipleMultiPageTables}")`,
      );
    }
    lines.push(
      "    if page_count > PAGE_COUNT_MAX:",
      `        sys.exit(f"${messages.reportlab.pageCountExceeded}")`,
    );
  } else {
    lines.push("    page_count = 1");
  }
  const drawArgs = tables.length > 0 ? ", tables" : "";
  lines.push(
    "    c = Canvas(output_path, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))",
    "    for page in range(1, page_count + 1):",
    `        _draw_page(c, data, page, page_count${drawArgs})`,
    "        c.showPage()",
    "    c.save()",
  );
  return lines.join("\n");
}

function buildTemplateSource(
  document: IrDocument,
  font: IrFont,
  slots: ReadonlyMap<IrFontSlot, ResolvedSlotFont>,
  entries: readonly ReportlabFontEntry[],
  messages: Messages,
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
  const hasMerges = tables.some(tableHasMerges);
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
    registerFontsFn(messages),
    ...(needsText ? [TEXT_FN] : []),
    ...(needsLine ? [LINE_FN] : []),
    ...(needsRect ? [RECT_FN] : []),
    ...(needsEllipse ? [ELLIPSE_FN] : []),
    ...(hasImage ? [IMAGE_FN] : []),
    ...(hasBarcode ? [BARCODE_FN] : []),
    ...(hasTokenText ? [bindStrFn(messages)] : []),
    ...(hasTokenText ? [INTERPOLATE_FN] : []),
    ...(needsWrapFn ? [WRAP_FN] : []),
    ...(hasTables ? [bindRowsFn(messages), chunkSizesFn(messages)] : []),
    ...(hasMerges ? [CHUNK_MERGES_FN, KEPT_SEGMENTS_FN, ROW_EDGE_FN] : []),
    ...(hasCellOverrides ? [APPLY_CELL_OVERRIDES_FN] : []),
    ...(hasPageNumber ? [PAGE_LABEL_FN] : []),
  ];

  const charWidthOf = (slot: IrFontSlot): CharWidthEm =>
    // effectiveFontOf により解決先スロットのデータ存在は保証される
    (slots.get(slot) as ResolvedSlotFont).charWidthEm;

  // align は行分割そのものには影響しない（justify の字間は生成 Python が実行時に計算する）ため固定値を渡す
  const wrapWith = (
    charWidthEm: CharWidthEm,
    content: string,
    widthMm: number,
    fontSize: number,
  ): readonly string[] =>
    layoutTextLines(
      { content, widthMm, fontSize, align: "left" },
      charWidthEm,
    ).map((line) => line.text);
  const wrapText = (
    content: string,
    widthMm: number,
    fontSize: number,
  ): readonly string[] =>
    wrapWith(charWidthOf("regular"), content, widthMm, fontSize);
  const layoutLines = (el: LoweredTextElement): readonly string[] =>
    wrapWith(
      charWidthOf(resolveFontSlot(font, el.fontWeight, el.fontStyle)),
      el.content,
      el.w,
      el.fontSize,
    );

  const sections = [
    buildHeader(messages, hasImage),
    buildImports(hasImage, hasTokenText, hasBarcode),
    buildConstants(resolved, entries),
    helperFns.join("\n\n"),
    ...tables.map((table) =>
      tableHasMerges(table)
        ? buildMergedTableFunction(table, font.regular, wrapText)
        : buildTableFunction(table, font.regular, wrapText),
    ),
    buildDrawPage(placed, hasTables, layoutLines, font),
    buildBuildFunction(tables, messages),
    MAIN_BLOCK,
  ];

  return `${sections.join("\n\n")}\n`;
}

/**
 * Generates a standalone reportlab Python script from `document` alone (no
 * `data`): text/table bindings are resolved inside the generated script's
 * `build(output_path, data)` function at Python run time, so one script can
 * render many different data sets. Data-related failures therefore cannot
 * occur here (`errors` is always empty on failure); every slot in `fonts`
 * must still be a valid TTF with readable metrics, otherwise export fails
 * with fontIssues explaining why. `options.locale` (default "ja") selects
 * the language of the generated script's comments and error messages.
 */
export function exportReportlabTemplate(
  document: IrDocument,
  fonts: FontSetData,
  options?: { readonly locale?: MessageLocale },
): ExportReportlabResult {
  const locale = options?.locale ?? "ja";
  const fontSet = resolveFontSetData(fonts, { locale });
  if (!fontSet.ok) {
    return { ok: false, errors: [], fontIssues: fontSet.issues };
  }
  const font = effectiveFontOf(document.font, fonts);
  const entries = fontEntriesFor(font, fonts, fontSet.slots);
  return {
    ok: true,
    code: buildTemplateSource(
      document,
      font,
      fontSet.slots,
      entries,
      getMessages(locale),
    ),
    fontFiles: entries.map((entry) => ({
      filename: entry.filename,
      data: entry.data,
    })),
    warnings: [],
  };
}
