import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { IrData, IrDocument } from "@denreport/core";
import { lowerIr, parseIr } from "@denreport/core";
import { describe, expect, it } from "vitest";
import { exportReportlab } from "../src/reportlab/export";
import { exportReportlabTemplate } from "../src/reportlab/export-template";
import {
  buildUniformWidthTtf,
  syntheticCff,
  syntheticTtf,
} from "./helpers/sfnt";

const FONT = { regular: syntheticTtf() };

const coreFixturesDir = fileURLToPath(
  new URL("../../core/tests/fixtures", import.meta.url),
);
const fixturesDir = fileURLToPath(new URL("fixtures", import.meta.url));

function readJson<T>(dir: string, name: string): T {
  return JSON.parse(readFileSync(`${dir}/${name}`, "utf-8")) as T;
}

function docOf(...elements: IrDocument["elements"]): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements,
  };
}

describe("exportReportlabTemplate — static document", () => {
  it("omits _bind_str / _bind_rows / tables and defines build(output_path, data=None)", () => {
    const doc = docOf(
      {
        type: "text",
        id: "t1",
        x: 0,
        y: 0,
        pages: "all",
        w: 50,
        h: 10,
        text: "静的",
        fontSize: 10,
        align: "left",
        lineHeight: 1.2,
      },
      {
        type: "rect",
        id: "r1",
        x: 0,
        y: 20,
        pages: "all",
        w: 10,
        h: 10,
        borderWidth: 0.3,
      },
    );
    const result = exportReportlabTemplate(doc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain("def build(output_path, data=None):");
    expect(result.code).toContain('if __name__ == "__main__":');
    expect(result.code).not.toContain("_bind_str(");
    expect(result.code).not.toContain("_bind_rows(");
    expect(result.code).not.toContain("tables");
  });

  it("emits statements byte-identical to exportReportlab for static elements", () => {
    const doc = docOf(
      {
        type: "text",
        id: "t1",
        x: 5,
        y: 5,
        pages: "all",
        w: 50,
        h: 10,
        text: "静的",
        fontSize: 10,
        align: "left",
        lineHeight: 1.2,
      },
      {
        type: "rect",
        id: "r1",
        x: 0,
        y: 20,
        pages: "all",
        w: 10,
        h: 10,
        borderWidth: 0.3,
      },
    );
    const dataResult = exportReportlab(doc, {}, FONT);
    const templateResult = exportReportlabTemplate(doc, FONT);
    expect(dataResult.ok).toBe(true);
    expect(templateResult.ok).toBe(true);
    if (!dataResult.ok || !templateResult.ok)
      throw new Error("expected success");
    expect(templateResult.code).toContain(
      '_text(c, "NotoSansJP", 5, 5, 50, 10, 10, "left", 1.2, (0, 0, 0), 0, False, ["静的"])',
    );
    expect(dataResult.code).toContain(
      '_text(c, "NotoSansJP", 5, 5, 50, 10, 10, "left", 1.2, (0, 0, 0), 0, False, ["静的"])',
    );
    expect(templateResult.code).toContain(
      "_rect(c, 0, 20, 10, 10, 0.3, (0, 0, 0), None, None, 0, 0)",
    );
    expect(dataResult.code).toContain(
      "_rect(c, 0, 20, 10, 10, 0.3, (0, 0, 0), None, None, 0, 0)",
    );
  });
});

describe("exportReportlabTemplate — bound document", () => {
  const boundDoc = docOf(
    {
      type: "text",
      id: "title",
      x: 0,
      y: 0,
      pages: "all",
      w: 100,
      h: 10,
      text: "{title}",
      fontSize: 12,
      align: "left",
      lineHeight: 1.2,
    },
    {
      type: "text",
      id: "firstOnly",
      x: 0,
      y: 10,
      pages: "first",
      w: 50,
      h: 10,
      text: "初回のみ",
      fontSize: 10,
      align: "left",
      lineHeight: 1.2,
    },
    {
      type: "text",
      id: "lastOnly",
      x: 0,
      y: 20,
      pages: "last",
      w: 50,
      h: 10,
      text: "最終のみ",
      fontSize: 10,
      align: "left",
      lineHeight: 1.2,
    },
    {
      type: "text",
      id: "restOnly",
      x: 0,
      y: 30,
      pages: "rest",
      w: 50,
      h: 10,
      text: "継続のみ",
      fontSize: 10,
      align: "left",
      lineHeight: 1.2,
    },
    {
      type: "table",
      id: "items",
      x: 15,
      y: 0,
      bind: "items",
      columns: [{ key: "name", label: "品目", width: 90, align: "left" }],
      rowHeight: 10,
      headerHeight: 10,
      fontSize: 10,
      maxY: 100,
      continuationY: 20,
      minRows: 5,
    },
    {
      type: "table",
      id: "extra",
      x: 15,
      y: 0,
      bind: "extra",
      columns: [{ key: "note", label: "備考", width: 90, align: "left" }],
      rowHeight: 10,
      headerHeight: 10,
      fontSize: 10,
      maxY: 100,
      continuationY: 20,
      minRows: 5,
    },
  );

  it("resolves text tokens via _interpolate at draw time", () => {
    const result = exportReportlabTemplate(boundDoc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      '_text(c, "NotoSansJP", 0, 0, 100, 10, 12, "left", 1.2, (0, 0, 0), 0, False, _wrap("NotoSansJP", 12, 100, _interpolate(data, "{title}")))',
    );
  });

  it("resolves table binds via _bind_rows with all column keys", () => {
    const result = exportReportlabTemplate(boundDoc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain('_bind_rows(data, "items", ["name"])');
    expect(result.code).toContain('_bind_rows(data, "extra", ["note"])');
  });

  it("computes k_first / k_cont from table geometry as _chunk_sizes literals", () => {
    const result = exportReportlabTemplate(boundDoc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    // maxY=100, headerHeight=10, rowHeight=10 → kFirst = floor((100-0-10)/10) = 9,
    // kCont = floor((100-20-10)/10) = 7
    expect(result.code).toContain(
      "chunks_items = _chunk_sizes(len(rows_items), 5, 9, 7)",
    );
    expect(result.code).toContain(
      "chunks_extra = _chunk_sizes(len(rows_extra), 5, 9, 7)",
    );
  });

  it("emits the C03/C04-equivalent sys.exit guards when more than one table is present", () => {
    const result = exportReportlabTemplate(boundDoc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      'sys.exit("2ページ以上に展開される表が複数あります")',
    );
    expect(result.code).toContain(
      'sys.exit(f"展開後の総ページ数 {page_count} が上限 {PAGE_COUNT_MAX} を超えています")',
    );
  });

  it("emits first/last/rest/all page-selection guards", () => {
    const result = exportReportlabTemplate(boundDoc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain("if page == 1:");
    expect(result.code).toContain("if page == page_count:");
    expect(result.code).toContain("if page >= 2:");
    // "all" (title のトークン) は無条件 — ガードなしで直接呼ばれる
    expect(result.code).toContain(
      '    _text(c, "NotoSansJP", 0, 0, 100, 10, 12, "left", 1.2, (0, 0, 0), 0, False, _wrap("NotoSansJP", 12, 100, _interpolate(data, "{title}")))',
    );
  });

  it("defaults to Japanese sys.exit guard messages", () => {
    const result = exportReportlabTemplate(boundDoc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      'sys.exit("2ページ以上に展開される表が複数あります")',
    );
  });

  it('emits English sys.exit guard messages for locale "en"', () => {
    const result = exportReportlabTemplate(boundDoc, FONT, { locale: "en" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      'sys.exit("More than one table expands to 2 or more pages")',
    );
    expect(result.code).toContain(
      'sys.exit(f"Total page count {page_count} after expansion exceeds the limit {PAGE_COUNT_MAX}")',
    );
    expect(result.code).toContain("Generated file; not intended");
  });
});

describe("exportReportlabTemplate — locale (font issues)", () => {
  it('returns English fontIssues messages for locale "en"', () => {
    const result = exportReportlabTemplate(
      docOf(),
      { regular: syntheticCff() },
      {
        locale: "en",
      },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.fontIssues[0]?.message).toContain("TTF font");
  });
});

describe("exportReportlabTemplate — cellOverrides", () => {
  function tableWithOverrides(): IrDocument {
    return docOf({
      type: "table",
      id: "items",
      x: 15,
      y: 0,
      bind: "items",
      columns: [{ key: "name", label: "品目", width: 90, align: "left" }],
      rowHeight: 10,
      headerHeight: 10,
      fontSize: 10,
      maxY: 100,
      continuationY: 20,
      minRows: 5,
      cellOverrides: [
        { row: 1, key: "name", value: "固定値" },
        { row: 0, key: "name", value: "" },
      ],
    });
  }

  it("emits the _apply_cell_overrides helper and an application line with the literal tuples", () => {
    const result = exportReportlabTemplate(tableWithOverrides(), FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      "def _apply_cell_overrides(rows, min_rows, overrides):",
    );
    expect(result.code).toContain(
      'rows_items = _apply_cell_overrides(rows_items, 5, [(1, "name", "固定値"), (0, "name", "")])',
    );
  });

  it('reads cells via .get(key, "") when the table has overrides', () => {
    const result = exportReportlabTemplate(tableWithOverrides(), FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain('rows[t].get("name", "")');
    expect(result.code).not.toContain('rows[t]["name"]');
  });

  it("omits the helper and keeps direct indexing for a table without overrides", () => {
    const withoutOverrides = docOf({
      type: "table",
      id: "items",
      x: 15,
      y: 0,
      bind: "items",
      columns: [{ key: "name", label: "品目", width: 90, align: "left" }],
      rowHeight: 10,
      headerHeight: 10,
      fontSize: 10,
      maxY: 100,
      continuationY: 20,
      minRows: 5,
    });
    const result = exportReportlabTemplate(withoutOverrides, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).not.toContain("_apply_cell_overrides");
    expect(result.code).toContain('rows[t]["name"]');
  });
});

describe("exportReportlabTemplate — cell merges", () => {
  function mergeTable(
    overrides: Partial<
      Extract<IrDocument["elements"][number], { type: "table" }>
    > = {},
  ): IrDocument {
    return docOf({
      type: "table",
      id: "items",
      x: 15,
      y: 0,
      bind: "items",
      columns: [
        {
          key: "cat",
          label: "分類",
          width: 40,
          align: "left",
          mergeSameValue: true,
        },
        { key: "name", label: "品目", width: 50, align: "left" },
        { key: "amount", label: "金額", width: 30, align: "right" },
      ],
      rowHeight: 10,
      headerHeight: 10,
      fontSize: 10,
      maxY: 100,
      continuationY: 20,
      minRows: 0,
      ...overrides,
    });
  }

  it("emits the merge helpers and a per-table _chunk_merges call with span/column literals", () => {
    const doc = mergeTable({
      cellSpans: [
        { row: "header", key: "name", colSpan: 2 },
        { row: 1, key: "name", rowSpan: 2 },
      ],
    });
    const result = exportReportlabTemplate(doc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      "def _chunk_merges(rows, spans, merge_cols, col_keys, row_offset, chunk_size):",
    );
    expect(result.code).toContain("def _kept(start, end, skips):");
    expect(result.code).toContain("def _row_edge(y0, header_h, row_h, edge):");
    expect(result.code).toContain(
      'rects, covered, h_skips, v_skips = _chunk_merges(rows, [(1, 1, 2, 1)], [0], ["cat", "name", "amount"], row_offset, chunk_size)',
    );
    expect(result.code).toContain("xs = [15, 55, 105, 135]");
  });

  it("splits grid lines at runtime and appends the static header skip to the merged vertical line", () => {
    const doc = mergeTable({
      cellSpans: [{ row: "header", key: "name", colSpan: 2 }],
    });
    const result = exportReportlabTemplate(doc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      "for s, e in _kept(0, 3, h_skips.get(q, [])):",
    );
    expect(result.code).toContain(
      "for s, e in _kept(-1, chunk_size, v_skips.get(1, [])):",
    );
    // ヘッダで name+amount が結合されるため、その間の垂直罫線だけヘッダ帯を除く
    expect(result.code).toContain(
      "for s, e in _kept(-1, chunk_size, v_skips.get(2, []) + [(-1, 0)]):",
    );
  });

  it("bakes the merged header cell at generation time (covered label omitted, origin widened)", () => {
    const doc = mergeTable({
      cellSpans: [{ row: "header", key: "name", colSpan: 2 }],
    });
    const result = exportReportlabTemplate(doc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).not.toContain('["金額"]');
    // 品目ヘッダの幅 = (50 + 30) − 2×1.5
    expect(result.code).toContain('77, 8.2, 10, "center", 1.25');
  });

  it("guards every data cell on covered and derives the width from rects at runtime", () => {
    const result = exportReportlabTemplate(mergeTable(), FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain("if (q, 0) not in covered:");
    expect(result.code).toContain("_rs, _cs = rects.get((q, 0), (1, 1))");
    expect(result.code).toContain("_w = xs[0 + _cs] - xs[0] - 3");
    expect(result.code).toContain(
      '_wrap("NotoSansJP", 10, _w, rows[t]["cat"])',
    );
  });

  it("omits the merge helpers and keeps the plain table function without merges", () => {
    const plain = docOf({
      type: "table",
      id: "items",
      x: 15,
      y: 0,
      bind: "items",
      columns: [{ key: "name", label: "品目", width: 90, align: "left" }],
      rowHeight: 10,
      headerHeight: 10,
      fontSize: 10,
      maxY: 100,
      continuationY: 20,
      minRows: 5,
    });
    const result = exportReportlabTemplate(plain, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).not.toContain("_chunk_merges");
    expect(result.code).not.toContain("_kept(");
    expect(result.code).not.toContain("_row_edge(");
  });
});

describe("exportReportlabTemplate — table stripeColor", () => {
  function tableWithStripe(): IrDocument {
    return docOf({
      type: "table",
      id: "items",
      x: 15,
      y: 0,
      bind: "items",
      columns: [{ key: "name", label: "品目", width: 90, align: "left" }],
      rowHeight: 10,
      headerHeight: 10,
      fontSize: 10,
      maxY: 100,
      continuationY: 20,
      minRows: 5,
      stripeColor: "#f0f0f0",
    });
  }

  it("emits a per-row shading loop keyed on the odd (row_offset + q) parity", () => {
    const result = exportReportlabTemplate(tableWithStripe(), FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain("        if (row_offset + q) % 2 == 1:");
    expect(result.code).toContain(
      "_rect(c, 15, y0 + 10 + q * 10, 90, 10, 0, (0, 0, 0), (0.9411764705882353, 0.9411764705882353, 0.9411764705882353), None, 0, 0)",
    );
  });

  it("omits the shading loop for a table without stripeColor", () => {
    const withoutStripe = docOf({
      type: "table",
      id: "items",
      x: 15,
      y: 0,
      bind: "items",
      columns: [{ key: "name", label: "品目", width: 90, align: "left" }],
      rowHeight: 10,
      headerHeight: 10,
      fontSize: 10,
      maxY: 100,
      continuationY: 20,
      minRows: 5,
    });
    const result = exportReportlabTemplate(withoutStripe, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).not.toContain("% 2 == 1");
  });
});

describe("exportReportlabTemplate — table frame/grid attributes", () => {
  function tableWith(
    overrides: Partial<
      Extract<IrDocument["elements"][number], { type: "table" }>
    >,
  ): IrDocument {
    return docOf({
      type: "table",
      id: "items",
      x: 15,
      y: 0,
      bind: "items",
      columns: [{ key: "name", label: "品目", width: 90, align: "left" }],
      rowHeight: 10,
      headerHeight: 10,
      fontSize: 10,
      maxY: 100,
      continuationY: 20,
      minRows: 5,
      ...overrides,
    });
  }

  it("uses the spec defaults (0.4mm frame, 0.25mm grid, no dash) when omitted", () => {
    const result = exportReportlabTemplate(tableWith({}), FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      "_rect(c, 15, y0, 90, 10 + chunk_size * 10, 0.4, (0, 0, 0), None, None, 0, 0)",
    );
    expect(result.code).toContain(
      "_line(c, 15, y0 + 10 + q * 10, 105, y0 + 10 + q * 10, 0.25, (0, 0, 0), None, 0)",
    );
  });

  it("applies explicit frameWidth/gridWidth/frameStyle/gridStyle to the frame and grid draw calls", () => {
    const result = exportReportlabTemplate(
      tableWith({
        frameWidth: 1,
        gridWidth: 0.6,
        frameStyle: "dashed",
        gridStyle: "dotted",
      }),
      FONT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      "_rect(c, 15, y0, 90, 10 + chunk_size * 10, 1, (0, 0, 0), None, [2 * mm, 1 * mm], 0, 0)",
    );
    expect(result.code).toContain(
      "_line(c, 15, y0 + 10 + q * 10, 105, y0 + 10 + q * 10, 0.6, (0, 0, 0), [0.4 * mm, 0.8 * mm], 0)",
    );
  });
});

describe("exportReportlabTemplate — ellipse", () => {
  it("draws a static ellipse via _ellipse and includes the helper", () => {
    const doc = docOf({
      type: "ellipse",
      id: "el",
      x: 0,
      y: 0,
      pages: "all",
      w: 30,
      h: 20,
      borderWidth: 0.3,
    });
    const result = exportReportlabTemplate(doc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain("def _ellipse(c, x, y, w, h,");
    expect(result.code).toContain(
      "_ellipse(c, 0, 0, 30, 20, 0.3, (0, 0, 0), None, 0)",
    );
  });

  it("omits the _ellipse helper for a document without ellipse elements", () => {
    const result = exportReportlabTemplate(docOf(), FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).not.toContain("_ellipse(");
  });
});

describe("exportReportlabTemplate — static text with {key} tokens", () => {
  const tokenDoc = docOf({
    type: "text",
    id: "total",
    x: 0,
    y: 0,
    pages: "all",
    w: 100,
    h: 10,
    text: "合計: {total} 円",
    fontSize: 12,
    align: "left",
    lineHeight: 1.2,
  });

  it("interpolates at draw time via _interpolate/_bind_str instead of embedding a literal", () => {
    const result = exportReportlabTemplate(tokenDoc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      '_text(c, "NotoSansJP", 0, 0, 100, 10, 12, "left", 1.2, (0, 0, 0), 0, False, _wrap("NotoSansJP", 12, 100, _interpolate(data, "合計: {total} 円")))',
    );
    expect(result.code).not.toContain('["合計: {total} 円"]');
  });

  it("includes _bind_str, _TOKEN_RE and _interpolate, and imports re", () => {
    const result = exportReportlabTemplate(tokenDoc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain("def _bind_str(data, key):");
    expect(result.code).toContain(
      '_TOKEN_RE = re.compile(r"\\{([A-Za-z_][A-Za-z0-9_]{0,63})\\}")',
    );
    expect(result.code).toContain("def _interpolate(data, template):");
    expect(result.code).toContain("import re");
  });

  it("omits _bind_str/_interpolate/import re for a document without tokens or binds", () => {
    const doc = docOf({
      type: "text",
      id: "t1",
      x: 0,
      y: 0,
      pages: "all",
      w: 100,
      h: 10,
      text: "静的",
      fontSize: 12,
      align: "left",
      lineHeight: 1.2,
    });
    const result = exportReportlabTemplate(doc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).not.toContain("_bind_str(");
    expect(result.code).not.toContain("_interpolate(");
    expect(result.code).not.toContain("import re");
  });
});

describe("exportReportlabTemplate — _wrap inclusion", () => {
  it("includes _wrap/_KINSOKU_HEAD when a text has {key} tokens", () => {
    const doc = docOf({
      type: "text",
      id: "total",
      x: 0,
      y: 0,
      pages: "all",
      w: 100,
      h: 10,
      text: "合計: {total} 円",
      fontSize: 12,
      align: "left",
      lineHeight: 1.2,
    });
    const result = exportReportlabTemplate(doc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      '_KINSOKU_HEAD = "、。，．）｝］」』】〕〉》｡､｣,.)]}"',
    );
    expect(result.code).toContain("def _wrap(font, size, w, text):");
  });

  it("includes _wrap/_KINSOKU_HEAD for a pageNumber even without tokens or tables", () => {
    const doc = docOf({
      type: "pageNumber",
      id: "p1",
      x: 0,
      y: 285,
      pages: "all",
      w: 210,
      h: 6,
      format: "{n} / {N}",
      fontSize: 9,
      align: "center",
      lineHeight: 1.25,
    });
    const result = exportReportlabTemplate(doc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain("def _wrap(font, size, w, text):");
    expect(result.code).toContain(
      '_text(c, "NotoSansJP", 0, 285, 210, 6, 9, "center", 1.25, (0, 0, 0), 0, False, _wrap("NotoSansJP", 9, 210, _page_label("{n} / {N}", page, page_count)))',
    );
  });

  it("maps explicit text and pageNumber color through, including the {key} token branch", () => {
    const doc = docOf(
      {
        type: "text",
        id: "static",
        x: 0,
        y: 0,
        pages: "all",
        w: 50,
        h: 10,
        text: "赤字",
        fontSize: 10,
        align: "left",
        lineHeight: 1.25,
        color: "#ff0000",
      },
      {
        type: "text",
        id: "token",
        x: 0,
        y: 10,
        pages: "all",
        w: 50,
        h: 10,
        text: "{note}",
        fontSize: 10,
        align: "left",
        lineHeight: 1.25,
        color: "#00ff00",
      },
      {
        type: "pageNumber",
        id: "p1",
        x: 0,
        y: 285,
        pages: "all",
        w: 210,
        h: 6,
        format: "{n} / {N}",
        fontSize: 9,
        align: "center",
        lineHeight: 1.25,
        color: "#0000ff",
      },
    );
    const result = exportReportlabTemplate(doc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      '_text(c, "NotoSansJP", 0, 0, 50, 10, 10, "left", 1.25, (1, 0, 0), 0, False, ["赤字"])',
    );
    expect(result.code).toContain(
      '_text(c, "NotoSansJP", 0, 10, 50, 10, 10, "left", 1.25, (0, 1, 0), 0, False, _wrap("NotoSansJP", 10, 50, _interpolate(data, "{note}")))',
    );
    expect(result.code).toContain(
      '_text(c, "NotoSansJP", 0, 285, 210, 6, 9, "center", 1.25, (0, 0, 1), 0, False, _wrap("NotoSansJP", 9, 210, _page_label("{n} / {N}", page, page_count)))',
    );
  });

  it("omits _wrap/_KINSOKU_HEAD for a document with only static, non-table, non-pageNumber elements", () => {
    const doc = docOf({
      type: "text",
      id: "t1",
      x: 0,
      y: 0,
      pages: "all",
      w: 100,
      h: 10,
      text: "静的",
      fontSize: 12,
      align: "left",
      lineHeight: 1.2,
    });
    const result = exportReportlabTemplate(doc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).not.toContain("_wrap(");
    expect(result.code).not.toContain("_KINSOKU_HEAD");
  });
});

describe("exportReportlabTemplate — barcode", () => {
  it("embeds a literal value/name when the barcode value has no tokens", () => {
    const doc = docOf({
      type: "barcode",
      id: "bc1",
      x: 0,
      y: 0,
      pages: "all",
      w: 30,
      h: 30,
      symbology: "ean13",
      value: "4912345678904",
    });
    const result = exportReportlabTemplate(doc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      '_barcode(c, "EAN13", "4912345678904", 0, 0, 30, 30, 0)',
    );
    expect(result.code).not.toContain("_interpolate(data,");
  });

  it("resolves a token value via _interpolate at draw time", () => {
    const doc = docOf({
      type: "barcode",
      id: "bc1",
      x: 0,
      y: 0,
      pages: "all",
      w: 30,
      h: 30,
      symbology: "qrcode",
      value: "{code}",
    });
    const result = exportReportlabTemplate(doc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      '_barcode(c, "QR", _interpolate(data, "{code}"), 0, 0, 30, 30, 0)',
    );
    expect(result.code).toContain("def _bind_str(data, key):");
    expect(result.code).toContain("import re");
  });

  it("omits createBarcodeDrawing/_barcode for a document without a barcode element", () => {
    const doc = docOf({
      type: "text",
      id: "t1",
      x: 0,
      y: 0,
      pages: "all",
      w: 100,
      h: 10,
      text: "静的",
      fontSize: 12,
      align: "left",
      lineHeight: 1.2,
    });
    const result = exportReportlabTemplate(doc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).not.toContain("createBarcodeDrawing");
    expect(result.code).not.toContain("def _barcode(");
  });
});

describe("exportReportlabTemplate — rotate", () => {
  it("passes rotate through the interpolated text, pageNumber and barcode paths", () => {
    const doc = docOf(
      {
        type: "text",
        id: "token",
        x: 0,
        y: 10,
        pages: "all",
        w: 50,
        h: 10,
        text: "{note}",
        fontSize: 10,
        align: "left",
        lineHeight: 1.25,
        rotate: 45,
      },
      {
        type: "pageNumber",
        id: "p1",
        x: 0,
        y: 285,
        pages: "all",
        w: 210,
        h: 6,
        format: "{n} / {N}",
        fontSize: 9,
        align: "center",
        lineHeight: 1.25,
        rotate: -90,
      },
      {
        type: "barcode",
        id: "bc1",
        x: 0,
        y: 0,
        pages: "all",
        w: 30,
        h: 30,
        symbology: "qrcode",
        value: "{code}",
        rotate: 30,
      },
    );
    const result = exportReportlabTemplate(doc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      '_text(c, "NotoSansJP", 0, 10, 50, 10, 10, "left", 1.25, (0, 0, 0), 45, False, _wrap("NotoSansJP", 10, 50, _interpolate(data, "{note}")))',
    );
    expect(result.code).toContain(
      '_text(c, "NotoSansJP", 0, 285, 210, 6, 9, "center", 1.25, (0, 0, 0), -90, False, _wrap("NotoSansJP", 9, 210, _page_label("{n} / {N}", page, page_count)))',
    );
    expect(result.code).toContain(
      '_barcode(c, "QR", _interpolate(data, "{code}"), 0, 0, 30, 30, 30)',
    );
  });
});

describe("exportReportlabTemplate — font gate", () => {
  it("rejects a CFF font with errors always empty", () => {
    const result = exportReportlabTemplate(docOf(), {
      regular: syntheticCff(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors).toEqual([]);
    expect(result.fontIssues).toHaveLength(1);
    expect(result.fontIssues[0]?.format).toBe("cff");
  });
});

describe("exportReportlabTemplate — page count parity with the data-mode chunking rule", () => {
  // lowerIr の computeTableSpan と同じ算術（乖離があればここで検出する）
  function chunkSizesJs(
    rowCount: number,
    minRows: number,
    kFirst: number,
    kCont: number,
  ): number[] {
    const m = Math.max(rowCount, minRows);
    if (m <= kFirst) return [Math.min(m, kFirst)];
    const chunks = [kFirst];
    let remaining = m - kFirst;
    while (remaining > 0) {
      const size = Math.min(remaining, kCont);
      chunks.push(size);
      remaining -= size;
    }
    return chunks;
  }

  it("matches lowerIr's pageCount for the multipage invoice fixture", () => {
    const parsed = parseIr(
      readFileSync(`${coreFixturesDir}/invoice-multipage.json`, "utf-8"),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("expected valid IR fixture");
    const data = readJson<IrData>(fixturesDir, "invoice-multipage-data.json");

    const lowered = lowerIr(parsed.document, data);
    expect(lowered.ok).toBe(true);
    if (!lowered.ok) throw new Error("expected lowering success");

    const templateResult = exportReportlabTemplate(parsed.document, FONT);
    expect(templateResult.ok).toBe(true);
    if (!templateResult.ok) throw new Error("expected success");
    const match = templateResult.code.match(
      /_chunk_sizes\(len\(rows_items\), (\d+), (\d+), (\d+)\)/,
    );
    expect(match).not.toBeNull();
    const [, minRows, kFirst, kCont] = match as unknown as [
      string,
      string,
      string,
      string,
    ];
    const items = (data as { items: readonly unknown[] }).items;
    const chunks = chunkSizesJs(
      items.length,
      Number(minRows),
      Number(kFirst),
      Number(kCont),
    );
    expect(chunks.length).toBe(lowered.document.pageCount);
  });
});

describe("exportReportlabTemplate — footnotes", () => {
  it("resolves marks to *n and emits the note block as ordinary static text", () => {
    const doc: IrDocument = {
      ...docOf({
        type: "text",
        id: "t1",
        x: 0,
        y: 0,
        pages: "all",
        w: 100,
        h: 10,
        text: "税抜{#tax}価格",
        fontSize: 12,
        align: "left",
        lineHeight: 1.2,
      }),
      footnotes: {
        x: 15,
        w: 180,
        bottom: 10,
        fontSize: 8,
        lineHeight: 1.25,
        pages: "all",
        notes: [{ id: "tax", text: "本体価格は税抜表示です" }],
      },
    };
    const result = exportReportlabTemplate(doc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      '_text(c, "NotoSansJP", 0, 0, 100, 10, 12, "left", 1.2, (0, 0, 0), 0, False, ["税抜*1価格"])',
    );
    expect(result.code).toContain("*1 本体価格は税抜表示です");
    expect(result.code).not.toContain("{#");
    // Python 側に脚注専用のロジックを複製しない（採番・注記合成は core 側で解決済み）
    expect(result.code).not.toContain("footnote");
    expect(result.code).not.toContain("_bind_str(");
    expect(result.code).not.toContain("_interpolate(");
  });

  it("wraps the note block in the pages page-guard like any other static text", () => {
    const doc: IrDocument = {
      ...docOf({
        type: "text",
        id: "t1",
        x: 0,
        y: 0,
        pages: "all",
        w: 100,
        h: 10,
        text: "{#a}",
        fontSize: 12,
        align: "left",
        lineHeight: 1.2,
      }),
      footnotes: {
        x: 15,
        w: 180,
        bottom: 10,
        fontSize: 8,
        lineHeight: 1.25,
        pages: "last",
        notes: [{ id: "a", text: "本文" }],
      },
    };
    const result = exportReportlabTemplate(doc, FONT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toMatch(
      /if page == page_count:\n {8}_text\(c, "NotoSansJP", 15, [-\d.]+, 180, [-\d.]+, 8, "left", 1\.25, \(0, 0, 0\), 0, False, \["\*1 本文"\]\)/,
    );
  });
});

describe("exportReportlabTemplate — font slots and underline", () => {
  const BOLD_FONT_SET = {
    regular: buildUniformWidthTtf(1, 1),
    bold: buildUniformWidthTtf(2, 1, 900),
  };

  function styledDoc(
    overrides: Partial<
      Extract<IrDocument["elements"][number], { type: "text" }>
    >,
  ): IrDocument {
    return {
      version: "1.0",
      page: { width: 210, height: 297 },
      font: { regular: "Base", bold: "BaseBold" },
      elements: [
        {
          type: "text",
          id: "t1",
          x: 10,
          y: 20,
          pages: "first",
          w: 100,
          h: 20,
          text: "見出し",
          fontSize: 12,
          align: "left",
          lineHeight: 1.25,
          ...overrides,
        } as IrDocument["elements"][number],
      ],
    };
  }

  it("registers every declared slot in the FONTS constant", () => {
    const result = exportReportlabTemplate(styledDoc({}), BOLD_FONT_SET);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain('"Base": ("Base.ttf", 800)');
    expect(result.code).toContain('"BaseBold": ("BaseBold.ttf", 900)');
    expect(result.fontFiles.map((file) => file.filename)).toEqual([
      "Base.ttf",
      "BaseBold.ttf",
    ]);
  });

  it("emits the resolved slot's name into static and token text alike", () => {
    const result = exportReportlabTemplate(
      styledDoc({ fontWeight: "bold", text: "合計: {total}", underline: true }),
      BOLD_FONT_SET,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).toContain(
      '_text(c, "BaseBold", 10, 20, 100, 20, 12, "left", 1.25, (0, 0, 0), 0, True, _wrap("BaseBold", 12, 100, _interpolate(data, "合計: {total}")))',
    );
  });

  it("keeps table cells and pageNumber on the regular slot", () => {
    const doc: IrDocument = {
      version: "1.0",
      page: { width: 210, height: 297 },
      font: { regular: "Base", bold: "BaseBold" },
      elements: [
        {
          type: "table",
          id: "items",
          x: 15,
          y: 40,
          bind: "items",
          columns: [{ key: "name", label: "品目", width: 90, align: "left" }],
          rowHeight: 9,
          headerHeight: 9,
          fontSize: 10,
          maxY: 240,
          continuationY: 30,
          minRows: 0,
        },
        {
          type: "pageNumber",
          id: "pageNo",
          x: 0,
          y: 285,
          pages: "all",
          w: 210,
          h: 6,
          format: "{n} / {N}",
          fontSize: 9,
          align: "center",
          lineHeight: 1.25,
        },
      ],
    };
    const result = exportReportlabTemplate(doc, BOLD_FONT_SET);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.code).not.toContain('"BaseBold",');
    expect(result.code).toContain('_wrap("Base", 10,');
    expect(result.code).toContain('_wrap("Base", 9,');
  });
});
