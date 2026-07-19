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
    font: { name: "NotoSansJP" },
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

// 先頭ページ容量 kFirst = floor((100 - 20 - 8) / 8) = 9、継続ページ容量 kCont = 9
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
  const result = buildPreview(document, sampleJson);
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

describe("buildPreview: 行数とページ展開", () => {
  const doc = makeDocument([itemsTable(), PAGE_NO]);

  it("0行では minRows 分の空行枠で1ページになる", () => {
    const result = buildPreview(doc, sampleWithRows(0));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
    expect(result.document.pageCount).toBe(1);
    const page = result.document.pages[0] ?? [];
    expect(rowLines(page)).toHaveLength(3);
    // ヘッダ2列のみで、セルのテキストはない
    expect(textsBySource(page, "items")).toHaveLength(2);
  });

  it("minRows 未満の行数では枠は minRows のまま、内容はデータ行数分", () => {
    const page = pagesOf(doc, sampleWithRows(2))[0] ?? [];
    expect(rowLines(page)).toHaveLength(3);
    expect(textsBySource(page, "items")).toHaveLength(2 + 2 * 2);
  });

  it("先頭ページ容量ちょうど（9行）は1ページに収まる", () => {
    const result = buildPreview(doc, sampleWithRows(9));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.pageCount).toBe(1);
    const page = result.document.pages[0] ?? [];
    expect(textsBySource(page, "items")).toHaveLength(2 + 9 * 2);
    expect(textsBySource(page, "pageno").map((t) => t.content)).toEqual([
      "1 / 1",
    ]);
  });

  it("容量を溢れる（10行）と2ページに分かれ、ページ番号も追従する", () => {
    const result = buildPreview(doc, sampleWithRows(10));
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

describe("buildPreview: C01/C02 の補完と警告", () => {
  it("text の {key} トークンの欠損はプレースホルダ {キー名} に補完され、警告が積まれる", () => {
    const doc = makeDocument([boundText("t1", "customerName")]);
    const result = buildPreview(doc, "{}");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const texts = textsBySource(result.document.pages[0] ?? [], "t1");
    expect(texts.map((t) => t.content)).toEqual(["{customerName}"]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.source).toBe("data");
    expect(result.warnings[0]?.message).toContain("customerName");
  });

  it("text の {key} トークンの型不一致もプレースホルダに補完される", () => {
    const doc = makeDocument([boundText("t1", "customerName")]);
    const result = buildPreview(doc, '{"customerName": 5}');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const texts = textsBySource(result.document.pages[0] ?? [], "t1");
    expect(texts.map((t) => t.content)).toEqual(["{customerName}"]);
    expect(result.warnings.map((w) => w.source)).toEqual(["data"]);
  });

  it("text 内の {key} トークン欠損はトークン表記のまま見え、警告が積まれる", () => {
    const doc = makeDocument([tokenText("t1", "合計: {total} 円")]);
    const result = buildPreview(doc, "{}");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const texts = textsBySource(result.document.pages[0] ?? [], "t1");
    expect(texts.map((t) => t.content)).toEqual(["合計: {total} 円"]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.source).toBe("data");
    expect(result.warnings[0]?.message).toContain("total");
  });

  it("同一テキスト内の複数トークンがそれぞれ独立に補完され、警告件数もキー数分になる", () => {
    const doc = makeDocument([tokenText("t1", "{a} / {b}")]);
    const result = buildPreview(doc, "{}");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const texts = textsBySource(result.document.pages[0] ?? [], "t1");
    expect(texts.map((t) => t.content)).toEqual(["{a} / {b}"]);
    expect(result.warnings).toHaveLength(2);
  });

  it("table bind の欠損は空配列に補完され、minRows 分の空行枠になる", () => {
    const doc = makeDocument([itemsTable()]);
    const result = buildPreview(doc, "{}");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const page = result.document.pages[0] ?? [];
    expect(rowLines(page)).toHaveLength(3);
    expect(textsBySource(page, "items")).toHaveLength(2);
    expect(result.warnings.map((w) => w.source)).toEqual(["data"]);
    expect(result.warnings[0]?.message).toContain("items");
  });

  it("不正 JSON は空データ扱いで全キーが補完され、source: json の警告が先頭に付く", () => {
    const doc = makeDocument([boundText("t1", "customerName"), itemsTable()]);
    const result = buildPreview(doc, "{oops");
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

  it("空文字列は未入力扱いで、JSON 警告は付かない（補完の警告のみ）", () => {
    const doc = makeDocument([boundText("t1", "customerName")]);
    const result = buildPreview(doc, "");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.filter((w) => w.source === "json")).toEqual([]);
    expect(result.warnings.map((w) => w.source)).toEqual(["data"]);
  });

  it("完全なデータでは警告が空になる", () => {
    const doc = makeDocument([boundText("t1", "customerName"), itemsTable()]);
    const result = buildPreview(
      doc,
      JSON.stringify({ customerName: "株式会社サンプル", items: rows(2) }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
  });
});

describe("buildPreview: 補完で解消できないエラー", () => {
  it("2ページ以上に展開される表が複数あると C03 で ok: false", () => {
    const doc = makeDocument([
      itemsTable(),
      itemsTable({ id: "items2", bind: "items2" }),
    ]);
    const result = buildPreview(
      doc,
      JSON.stringify({ items: rows(20), items2: rows(20) }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.rule)).toEqual(["C03"]);
    expect(result.errors[0]?.message).not.toBe("");
  });

  it("展開後の総ページ数が上限を超えると C04 で ok: false", () => {
    // continuationY 83 → 継続ページ容量 1 行。9 + 1001 行で 1002 ページになる
    const doc = makeDocument([itemsTable({ continuationY: 83 })]);
    const result = buildPreview(doc, sampleWithRows(1010));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.rule)).toEqual(["C04"]);
  });
});

describe("buildPreview: 純粋性", () => {
  it("補完が起きても入力 document を変更しない", () => {
    const doc = makeDocument([boundText("t1", "customerName"), itemsTable()]);
    const before = JSON.stringify(doc);
    buildPreview(doc, "{oops");
    buildPreview(doc, "{}");
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
    rotate: 0,
  };

  it("PT_TO_MM は 1pt = 0.352778mm の換算値", () => {
    expect(PT_TO_MM).toBeCloseTo(0.352778, 5);
  });

  it("規範式どおりのベースライン（ascent/em 1.16・10pt・lineHeight 1.25）を返す", () => {
    const lines = textBaselinesMm(el, 1.16, ["甲", "乙"]);
    expect(lines).toHaveLength(2);
    expect(lines[0]?.text).toBe("甲");
    expect(lines[1]?.text).toBe("乙");
    // (1.16 + 0.125) × 10pt = 12.85pt → 4.5332mm、2行目は +12.5pt
    expect(lines[0]?.baselineY).toBeCloseTo(50 + 12.85 * (25.4 / 72), 4);
    expect(lines[1]?.baselineY).toBeCloseTo(50 + 25.35 * (25.4 / 72), 4);
  });

  it("与えられた行配列をそのまま行として数える（空行を含む）", () => {
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

  it("text / flex 子孫 / table の bind を出現順に集め、2スペースインデントで出力する", () => {
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

  it("text と table が同一キーを共有する場合は table を優先する", () => {
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

  it("生成結果を buildPreview に渡すと警告が空になる", () => {
    const doc = makeDocument([
      boundText("t1", "customerName"),
      flexWithBind,
      itemsTable(),
      PAGE_NO,
    ]);
    const result = buildPreview(doc, generateSampleData(doc));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
  });

  it("bind のない文書では空オブジェクトになる", () => {
    expect(generateSampleData(makeDocument([]))).toBe("{}");
  });

  it("text 内の {key} トークンキーにもキー名そのものを値として含める", () => {
    const doc = makeDocument([tokenText("t1", "合計: {total} 円")]);
    expect(JSON.parse(generateSampleData(doc))).toEqual({ total: "total" });
  });

  it("生成結果を buildPreview に渡すとトークンの警告も空になる", () => {
    const doc = makeDocument([tokenText("t1", "合計: {total} 円")]);
    const result = buildPreview(doc, generateSampleData(doc));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
  });

  it("barcode.value 内の {key} トークンキーにもキー名そのものを値として含める", () => {
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
