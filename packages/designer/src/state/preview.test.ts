import type {
  IrDocument,
  IrElement,
  IrPageNumberElement,
  IrTableElement,
  IrTextElement,
  LoweredElement,
  LoweredLineElement,
  LoweredTextElement,
} from "@denreport/core";
import { describe, expect, it } from "vitest";
import {
  buildPreview,
  generateSampleData,
  PT_TO_MM,
  textBaselinesMm,
} from "./preview";

function makeDocument(elements: readonly IrElement[]): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements,
  };
}

function boundText(id: string, key: string): IrTextElement {
  return {
    type: "text",
    id,
    x: 10,
    y: 10,
    pages: "first",
    w: 80,
    h: 6,
    text: `{${key}}`,
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  };
}

function tokenText(id: string, text: string): IrTextElement {
  return {
    type: "text",
    id,
    x: 10,
    y: 10,
    pages: "first",
    w: 80,
    h: 6,
    text,
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  };
}

// First-page capacity kFirst = floor((100 - 20 - 8) / 8) = 9, continuation-page capacity kCont = 9
function itemsTable(overrides: Partial<IrTableElement> = {}): IrTableElement {
  return {
    type: "table",
    id: "items",
    x: 10,
    y: 20,
    bind: "items",
    columns: [
      { key: "name", label: "品名", width: 100, align: "left" },
      { key: "qty", label: "数量", width: 40, align: "right" },
    ],
    rowHeight: 8,
    headerHeight: 8,
    fontSize: 10,
    maxY: 100,
    continuationY: 20,
    minRows: 3,
    ...overrides,
  };
}

const PAGE_NO: IrPageNumberElement = {
  type: "pageNumber",
  id: "pageno",
  x: 90,
  y: 285,
  pages: "all",
  w: 30,
  h: 6,
  format: "{n} / {N}",
  fontSize: 10,
  align: "center",
  lineHeight: 1.25,
};

function rows(n: number): readonly Record<string, string>[] {
  return Array.from({ length: n }, (_, i) => ({
    name: `品${i + 1}`,
    qty: String(i + 1),
  }));
}

function sampleWithRows(n: number): string {
  return JSON.stringify({ items: rows(n) });
}

function pagesOf(
  document: IrDocument,
  sampleJson: string,
): readonly (readonly LoweredElement[])[] {
  const result = buildPreview(document, sampleJson, "ja");
  if (!result.ok) {
    throw new Error(`buildPreview が失敗: ${JSON.stringify(result.errors)}`);
  }
  return result.document.pages;
}

function textsBySource(
  page: readonly LoweredElement[],
  sourceId: string,
): readonly LoweredTextElement[] {
  return page.filter(
    (el): el is LoweredTextElement =>
      el.type === "text" && el.sourceId === sourceId,
  );
}

function rowLines(
  page: readonly LoweredElement[],
): readonly LoweredLineElement[] {
  return page.filter(
    (el): el is LoweredLineElement =>
      el.type === "line" &&
      el.sourceId === "items" &&
      el.orientation === "horizontal",
  );
}

describe("buildPreview: row count and page expansion", () => {
  const doc = makeDocument([itemsTable(), PAGE_NO]);

  it("becomes a single page with minRows worth of empty row slots when there are 0 rows", () => {
    const result = buildPreview(doc, sampleWithRows(0), "ja");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
    expect(result.document.pageCount).toBe(1);
    const page = result.document.pages[0] ?? [];
    expect(rowLines(page)).toHaveLength(3);
    // Only the 2 header columns; no cell text
    expect(textsBySource(page, "items")).toHaveLength(2);
  });

  it("keeps the frame at minRows while the content matches the data row count, when rows are fewer than minRows", () => {
    const page = pagesOf(doc, sampleWithRows(2))[0] ?? [];
    expect(rowLines(page)).toHaveLength(3);
    expect(textsBySource(page, "items")).toHaveLength(2 + 2 * 2);
  });

  it("fits on 1 page when the row count exactly matches the first-page capacity (9 rows)", () => {
    const result = buildPreview(doc, sampleWithRows(9), "ja");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.pageCount).toBe(1);
    const page = result.document.pages[0] ?? [];
    expect(textsBySource(page, "items")).toHaveLength(2 + 9 * 2);
    expect(textsBySource(page, "pageno").map((t) => t.content)).toEqual([
      "1 / 1",
    ]);
  });

  it("splits into 2 pages when capacity overflows (10 rows), and page numbers follow along", () => {
    const result = buildPreview(doc, sampleWithRows(10), "ja");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.pageCount).toBe(2);
    const [page1 = [], page2 = []] = result.document.pages;
    expect(rowLines(page1)).toHaveLength(9);
    expect(textsBySource(page1, "items")).toHaveLength(2 + 9 * 2);
    expect(rowLines(page2)).toHaveLength(1);
    expect(textsBySource(page2, "items")).toHaveLength(2 + 1 * 2);
    expect(textsBySource(page1, "pageno").map((t) => t.content)).toEqual([
      "1 / 2",
    ]);
    expect(textsBySource(page2, "pageno").map((t) => t.content)).toEqual([
      "2 / 2",
    ]);
  });
});

describe("buildPreview: C01/C02 completion and warnings", () => {
  it("fills a missing {key} token in text with the {keyName} placeholder, and adds a warning", () => {
    const doc = makeDocument([boundText("t1", "customerName")]);
    const result = buildPreview(doc, "{}", "ja");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const texts = textsBySource(result.document.pages[0] ?? [], "t1");
    expect(texts.map((t) => t.content)).toEqual(["{customerName}"]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.source).toBe("data");
    expect(result.warnings[0]?.message).toContain("customerName");
  });

  it("also fills a type-mismatched {key} token in text with a placeholder", () => {
    const doc = makeDocument([boundText("t1", "customerName")]);
    const result = buildPreview(doc, '{"customerName": 5}', "ja");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const texts = textsBySource(result.document.pages[0] ?? [], "t1");
    expect(texts.map((t) => t.content)).toEqual(["{customerName}"]);
    expect(result.warnings.map((w) => w.source)).toEqual(["data"]);
  });

  it("leaves a missing {key} token inside text shown in token form, and adds a warning", () => {
    const doc = makeDocument([tokenText("t1", "合計: {total} 円")]);
    const result = buildPreview(doc, "{}", "ja");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const texts = textsBySource(result.document.pages[0] ?? [], "t1");
    expect(texts.map((t) => t.content)).toEqual(["合計: {total} 円"]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.source).toBe("data");
    expect(result.warnings[0]?.message).toContain("total");
  });

  it("fills each of multiple tokens in the same text independently, with one warning per key", () => {
    const doc = makeDocument([tokenText("t1", "{a} / {b}")]);
    const result = buildPreview(doc, "{}", "ja");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const texts = textsBySource(result.document.pages[0] ?? [], "t1");
    expect(texts.map((t) => t.content)).toEqual(["{a} / {b}"]);
    expect(result.warnings).toHaveLength(2);
  });

  it("fills a missing table bind with an empty array, producing minRows worth of empty row slots", () => {
    const doc = makeDocument([itemsTable()]);
    const result = buildPreview(doc, "{}", "ja");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const page = result.document.pages[0] ?? [];
    expect(rowLines(page)).toHaveLength(3);
    expect(textsBySource(page, "items")).toHaveLength(2);
    expect(result.warnings.map((w) => w.source)).toEqual(["data"]);
    expect(result.warnings[0]?.message).toContain("items");
  });

  it("treats invalid JSON as empty data, fills all keys, and prepends a source: json warning", () => {
    const doc = makeDocument([boundText("t1", "customerName"), itemsTable()]);
    const result = buildPreview(doc, "{oops", "ja");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.map((w) => w.source)).toEqual([
      "json",
      "data",
      "data",
    ]);
    const page = result.document.pages[0] ?? [];
    expect(textsBySource(page, "t1").map((t) => t.content)).toEqual([
      "{customerName}",
    ]);
    expect(rowLines(page)).toHaveLength(3);
  });

  it("the JSON warning follows the locale", () => {
    const doc = makeDocument([boundText("t1", "customerName")]);
    const ja = buildPreview(doc, "{oops", "ja");
    const en = buildPreview(doc, "{oops", "en");
    expect(ja.ok).toBe(true);
    expect(en.ok).toBe(true);
    if (!ja.ok || !en.ok) return;
    expect(ja.warnings[0]?.message).toBe(
      "サンプルデータを JSON として解釈できないため、空のデータとして扱います",
    );
    expect(en.warnings[0]?.message).toBe(
      "The sample data cannot be parsed as JSON, so it is treated as empty data.",
    );
  });

  it("the non-top-level-object JSON warning also follows the locale", () => {
    const doc = makeDocument([boundText("t1", "customerName")]);
    const en = buildPreview(doc, "[1, 2]", "en");
    expect(en.ok).toBe(true);
    if (!en.ok) return;
    expect(en.warnings[0]?.message).toBe(
      "The sample data is not a top-level object, so it is treated as empty data.",
    );
  });

  it("treats an empty string as no input, with no JSON warning (only completion warnings)", () => {
    const doc = makeDocument([boundText("t1", "customerName")]);
    const result = buildPreview(doc, "", "ja");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.filter((w) => w.source === "json")).toEqual([]);
    expect(result.warnings.map((w) => w.source)).toEqual(["data"]);
  });

  it("produces no warnings when the data is complete", () => {
    const doc = makeDocument([boundText("t1", "customerName"), itemsTable()]);
    const result = buildPreview(
      doc,
      JSON.stringify({ customerName: "株式会社サンプル", items: rows(2) }),
      "ja",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
  });
});

describe("buildPreview: errors that completion cannot resolve", () => {
  it("returns ok: false with C03 when multiple tables expand to 2+ pages", () => {
    const doc = makeDocument([
      itemsTable(),
      itemsTable({ id: "items2", bind: "items2" }),
    ]);
    const result = buildPreview(
      doc,
      JSON.stringify({ items: rows(20), items2: rows(20) }),
      "ja",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.rule)).toEqual(["C03"]);
    expect(result.errors[0]?.message).not.toBe("");
  });

  it("returns ok: false with C04 when the total expanded page count exceeds the limit", () => {
    // continuationY 83 -> continuation-page capacity is 1 row. 9 + 1001 rows becomes 1002 pages
    const doc = makeDocument([itemsTable({ continuationY: 83 })]);
    const result = buildPreview(doc, sampleWithRows(1010), "ja");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.rule)).toEqual(["C04"]);
  });
});

describe("buildPreview: purity", () => {
  it("does not mutate the input document even when completion occurs", () => {
    const doc = makeDocument([boundText("t1", "customerName"), itemsTable()]);
    const before = JSON.stringify(doc);
    buildPreview(doc, "{oops", "ja");
    buildPreview(doc, "{}", "ja");
    expect(JSON.stringify(doc)).toBe(before);
  });
});

describe("textBaselinesMm", () => {
  const el: LoweredTextElement = {
    type: "text",
    sourceId: "t1",
    x: 10,
    y: 50,
    w: 100,
    h: 20,
    content: "甲\n乙",
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
    color: "#000000",
    fontWeight: "normal",
    fontStyle: "normal",
    underline: false,
    rotate: 0,
  };

  it("PT_TO_MM is the conversion factor 1pt = 0.352778mm", () => {
    expect(PT_TO_MM).toBeCloseTo(0.352778, 5);
  });

  it("returns the baseline per the canonical formula (ascent/em 1.16, 10pt, lineHeight 1.25)", () => {
    const lines = textBaselinesMm(el, 1.16, ["甲", "乙"]);
    expect(lines).toHaveLength(2);
    expect(lines[0]?.text).toBe("甲");
    expect(lines[1]?.text).toBe("乙");
    // (1.16 + 0.125) x 10pt = 12.85pt -> 4.5332mm, the 2nd line is +12.5pt
    expect(lines[0]?.baselineY).toBeCloseTo(50 + 12.85 * (25.4 / 72), 4);
    expect(lines[1]?.baselineY).toBeCloseTo(50 + 25.35 * (25.4 / 72), 4);
  });

  it("counts the given line array as-is, including empty lines", () => {
    const lines = textBaselinesMm(el, 1.16, ["甲", "", "乙"]);
    expect(lines.map((l) => l.text)).toEqual(["甲", "", "乙"]);
    expect(lines[2]?.baselineY).toBeCloseTo(
      50 + (1.16 + 0.125 + 2 * 1.25) * 10 * (25.4 / 72),
      4,
    );
  });
});

describe("generateSampleData", () => {
  const flexWithBind: IrElement = {
    type: "flex",
    id: "f1",
    x: 10,
    y: 200,
    pages: "first",
    direction: "column",
    gap: 0,
    justifyContent: "start",
    alignItems: "start",
    children: [
      {
        type: "text",
        id: "c1",
        w: 20,
        h: 6,
        text: "{tax}",
        fontSize: 10,
        align: "left",
        lineHeight: 1.25,
      },
    ],
  };

  it("collects binds from text / flex descendants / table in appearance order and outputs with 2-space indentation", () => {
    const doc = makeDocument([
      boundText("t1", "customerName"),
      flexWithBind,
      itemsTable(),
    ]);
    const json = generateSampleData(doc);
    expect(json).toBe(
      JSON.stringify(
        {
          customerName: "customerName",
          tax: "tax",
          items: [
            { name: "name 1", qty: "qty 1" },
            { name: "name 2", qty: "qty 2" },
            { name: "name 3", qty: "qty 3" },
          ],
        },
        null,
        2,
      ),
    );
  });

  it("prefers the table when text and table share the same key", () => {
    const before = makeDocument([boundText("t1", "items"), itemsTable()]);
    const after = makeDocument([itemsTable(), boundText("t1", "items")]);
    for (const doc of [before, after]) {
      const parsed = JSON.parse(generateSampleData(doc)) as Record<
        string,
        unknown
      >;
      expect(Array.isArray(parsed.items)).toBe(true);
      expect(parsed.items).toHaveLength(3);
    }
  });

  it("produces no warnings when the generated result is passed to buildPreview", () => {
    const doc = makeDocument([
      boundText("t1", "customerName"),
      flexWithBind,
      itemsTable(),
      PAGE_NO,
    ]);
    const result = buildPreview(doc, generateSampleData(doc), "ja");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
  });

  it("becomes an empty object for a document with no binds", () => {
    expect(generateSampleData(makeDocument([]))).toBe("{}");
  });

  it("includes the key name itself as the value for a {key} token inside text", () => {
    const doc = makeDocument([tokenText("t1", "合計: {total} 円")]);
    expect(JSON.parse(generateSampleData(doc))).toEqual({ total: "total" });
  });

  it("produces no token warnings either when the generated result is passed to buildPreview", () => {
    const doc = makeDocument([tokenText("t1", "合計: {total} 円")]);
    const result = buildPreview(doc, generateSampleData(doc), "ja");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
  });

  it("includes the key name itself as the value for a {key} token inside barcode.value", () => {
    const doc = makeDocument([
      {
        type: "barcode",
        id: "bc1",
        x: 0,
        y: 0,
        pages: "first",
        w: 30,
        h: 30,
        symbology: "qrcode",
        value: "{code}",
      },
    ]);
    expect(JSON.parse(generateSampleData(doc))).toEqual({ code: "code" });
  });
});
