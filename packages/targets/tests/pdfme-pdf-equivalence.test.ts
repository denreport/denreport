import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { IrData, IrDocument } from "@denreport/core";
import { parseIr } from "@denreport/core";
import { describe, expect, it } from "vitest";
import { EMBEDDED_FONT_URL } from "../src/fonts/embedded";
import { checkAgainstReference, checkCrossTarget } from "./helpers/equivalence";
import type { ExtractedPdf } from "./helpers/pdf-text";
import { extractPdf } from "./helpers/pdf-text";
import { generatePdfmePdf } from "./helpers/pdfme-generate";
import type { ReferenceExpectation } from "./helpers/reference-text";
import { buildReferenceExpectation } from "./helpers/reference-text";

const fixturesDir = fileURLToPath(new URL("fixtures", import.meta.url));
const coreFixturesDir = fileURLToPath(
  new URL("../../core/tests/fixtures", import.meta.url),
);
const outputDir = fileURLToPath(new URL("output", import.meta.url));

const fontData = new Uint8Array(readFileSync(EMBEDDED_FONT_URL));

const MM_PER_PT = 25.4 / 72;
// 同梱 Noto Sans JP の hhea.ascender / head.unitsPerEm（fonts-metrics.test.ts で機械検証済み）
const EMBEDDED_ASCENT_PER_EM = 1.16;

function normativeBaselineY(
  y: number,
  fontSize: number,
  lineHeight: number,
  lineIndex: number,
): number {
  return (
    y +
    (EMBEDDED_ASCENT_PER_EM + (lineHeight - 1) / 2 + lineIndex * lineHeight) *
      fontSize *
      MM_PER_PT
  );
}

function loadFixture(
  irFile: string,
  dataFile: string,
): { document: IrDocument; data: IrData } {
  const parsed = parseIr(readFileSync(`${coreFixturesDir}/${irFile}`, "utf-8"));
  if (!parsed.ok) throw new Error(`invalid IR fixture: ${irFile}`);
  const data = JSON.parse(
    readFileSync(`${fixturesDir}/${dataFile}`, "utf-8"),
  ) as IrData;
  return { document: parsed.document, data };
}

function parseInline(document: unknown): IrDocument {
  const parsed = parseIr(JSON.stringify(document));
  if (!parsed.ok) throw new Error("invalid inline IR document");
  return parsed.document;
}

describe("extractPdf — pt→mm・左上原点への正規化", () => {
  it("単一テキスト要素の PDF から寸法と位置を mm で取り出す", async () => {
    const document = parseInline({
      version: "1.0",
      page: { width: 210, height: 297 },
      font: { name: "NotoSansJP" },
      elements: [
        {
          type: "text",
          id: "t1",
          text: "Hello",
          x: 10,
          y: 20,
          w: 60,
          h: 10,
          fontSize: 12,
        },
      ],
    });
    const pdf = await extractPdf(
      await generatePdfmePdf(document, {}, fontData),
    );

    expect(pdf.pageCount).toBe(1);
    expect(pdf.pageWidth).toBeCloseTo(210, 0);
    expect(pdf.pageHeight).toBeCloseTo(297, 0);

    const items = (pdf.pages[0]?.textItems ?? []).filter(
      (item) => item.str.trim() !== "",
    );
    expect(items.map((item) => item.str).join("")).toBe("Hello");
    const first = items[0];
    if (first === undefined) throw new Error("expected a text item");
    expect(first.x).toBeGreaterThan(9);
    expect(first.x).toBeLessThan(11);
    expect(first.baselineY).toBeCloseTo(normativeBaselineY(20, 12, 1.25, 0), 0);
    expect(first.width).toBeGreaterThan(0);
  });

  it("楕円要素を含む PDF を生成できる", async () => {
    const document = parseInline({
      version: "1.0",
      page: { width: 210, height: 297 },
      font: { name: "NotoSansJP" },
      elements: [
        {
          type: "ellipse",
          id: "e1",
          x: 10,
          y: 10,
          w: 30,
          h: 20,
          borderWidth: 0.4,
          borderColor: "#123456",
          fillColor: "#abcdef",
        },
      ],
    });
    const pdf = await extractPdf(
      await generatePdfmePdf(document, {}, fontData),
    );
    expect(pdf.pageCount).toBe(1);
  });
});

describe("buildReferenceExpectation — 参照意味論からの期待行導出", () => {
  it("複数行 text を規範ベースラインの行に分割し、空文字列の行を除外する", () => {
    const document = parseInline({
      version: "1.0",
      page: { width: 210, height: 297 },
      font: { name: "NotoSansJP" },
      elements: [
        {
          type: "text",
          id: "t1",
          text: "A\n\nB",
          x: 10,
          y: 20,
          w: 60,
          h: 20,
          fontSize: 12,
        },
      ],
    });
    const expectation = buildReferenceExpectation(document, {}, fontData);

    expect(expectation.lines).toHaveLength(2);
    const [a, b] = expectation.lines;
    expect(a).toMatchObject({ text: "A", page: 1, x: 10, w: 60 });
    expect(a?.baselineY).toBeCloseTo(normativeBaselineY(20, 12, 1.25, 0), 5);
    expect(b?.text).toBe("B");
    expect(b?.baselineY).toBeCloseTo(normativeBaselineY(20, 12, 1.25, 2), 5);
  });

  it("invoice: 空行（t ≥ n）のセルは期待行に含めない", () => {
    const { document, data } = loadFixture("invoice.json", "invoice-data.json");
    const expectation = buildReferenceExpectation(document, data, fontData);

    expect(expectation.pageCount).toBe(1);
    // minRows=3・データ2行: 明細セルはデータ行のぶんだけ（2行×2列）
    const cellTexts = expectation.lines.filter((line) =>
      /^商品|^[\d,]+$/.test(line.text),
    );
    expect(cellTexts).toHaveLength(4);
    expect(expectation.lines.every((line) => line.text !== "")).toBe(true);
    expect(expectation.imageCountByPage).toEqual([1]);
  });

  it("invoice-multipage: pageNumber がページ毎に異なる期待文字列になる", () => {
    const { document, data } = loadFixture(
      "invoice-multipage.json",
      "invoice-multipage-data.json",
    );
    const expectation = buildReferenceExpectation(document, data, fontData);

    expect(expectation.pageCount).toBe(3);
    const pageNumbers = expectation.lines.filter((line) =>
      / \/ /.test(line.text),
    );
    expect(pageNumbers.map((line) => [line.page, line.text])).toEqual([
      [1, "1 / 3"],
      [2, "2 / 3"],
      [3, "3 / 3"],
    ]);
    // ヘッダは各ページで再表示される
    const headers = expectation.lines.filter((line) => line.text === "品目");
    expect(headers.map((line) => line.page)).toEqual([1, 2, 3]);
    // pages: "last" の合計欄は最終ページのみ
    const totals = expectation.lines.filter(
      (line) => line.text === "合計(税込)",
    );
    expect(totals.map((line) => line.page)).toEqual([3]);
    expect(expectation.imageCountByPage).toEqual([1, 0, 0]);
  });
});

describe("checkAgainstReference / checkCrossTarget — 照合器の境界", () => {
  const expectation: ReferenceExpectation = {
    pageCount: 1,
    pageWidth: 210,
    pageHeight: 297,
    lines: [{ page: 1, text: "abc", x: 10, w: 50, baselineY: 24 }],
    imageCountByPage: [1],
  };

  function pdfWith(
    items: readonly {
      str: string;
      x: number;
      baselineY: number;
      width: number;
    }[],
    imageDrawCount = 1,
  ): ExtractedPdf {
    return {
      pageCount: 1,
      pageWidth: 210,
      pageHeight: 297,
      pages: [{ textItems: items, imageDrawCount }],
    };
  }

  it("許容誤差内の分割項目を連結してマッチする", () => {
    const pdf = pdfWith([
      { str: "a", x: 10.3, baselineY: 24.05, width: 3 },
      { str: "bc", x: 13.3, baselineY: 24.15, width: 6 },
    ]);
    expect(checkAgainstReference(pdf, expectation)).toEqual([]);
  });

  it("規範ベースライン外・水平範囲超過・期待行の欠落を検出する", () => {
    const offBaseline = pdfWith([
      { str: "abc", x: 10, baselineY: 24.5, width: 9 },
    ]);
    const tooWide = pdfWith([{ str: "abc", x: 9, baselineY: 24, width: 9 }]);
    const empty = pdfWith([]);
    for (const pdf of [offBaseline, tooWide, empty]) {
      const mismatches = checkAgainstReference(pdf, expectation);
      expect(
        mismatches.some((m) =>
          m.message.includes("期待行「abc」が見つかりません"),
        ),
      ).toBe(true);
    }
  });

  it("どの期待行にもマッチしない項目と画像件数不一致をすべて列挙する", () => {
    const pdf = pdfWith(
      [
        { str: "abc", x: 10, baselineY: 24, width: 9 },
        { str: "xyz", x: 100, baselineY: 200, width: 9 },
      ],
      0,
    );
    const mismatches = checkAgainstReference(pdf, expectation);
    expect(mismatches).toHaveLength(2);
    expect(mismatches.some((m) => m.message.includes("「xyz」"))).toBe(true);
    expect(mismatches.some((m) => m.message.includes("画像描画件数"))).toBe(
      true,
    );
  });

  it("checkCrossTarget: 許容内は空配列・許容超過は差の実測値つきで報告する", () => {
    const a = pdfWith([{ str: "abc", x: 10, baselineY: 24, width: 9 }]);
    const withinTol = pdfWith([
      { str: "abc", x: 10.8, baselineY: 24.15, width: 9.5 },
    ]);
    expect(checkCrossTarget(a, withinTol, expectation)).toEqual([]);

    const beyondTol = pdfWith([
      { str: "abc", x: 12, baselineY: 24.1, width: 11 },
    ]);
    const mismatches = checkCrossTarget(a, beyondTol, expectation);
    expect(mismatches).toHaveLength(2);
    expect(mismatches.some((m) => m.message.includes("左端差 2.00mm"))).toBe(
      true,
    );
    expect(mismatches.some((m) => m.message.includes("全幅差 2.00mm"))).toBe(
      true,
    );
  });
});

// IR の rotate（時計回り・外接箱中心）で回転したテキストの、規範ベースライン原点の写像先
function rotatedBaselineOrigin(
  el: { x: number; y: number; w: number; h: number },
  fontSize: number,
  lineHeight: number,
  deg: number,
): { x: number; y: number } {
  const origin = {
    x: el.x,
    y: normativeBaselineY(el.y, fontSize, lineHeight, 0),
  };
  const center = { x: el.x + el.w / 2, y: el.y + el.h / 2 };
  const rad = (deg * Math.PI) / 180;
  const dx = origin.x - center.x;
  const dy = origin.y - center.y;
  return {
    x: center.x + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: center.y + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

function findItem(
  pdf: ExtractedPdf,
  text: string,
): { x: number; baselineY: number } {
  const item = pdf.pages[0]?.textItems.find((i) => i.str.trim() === text);
  if (item === undefined) throw new Error(`text item "${text}" not found`);
  return item;
}

describe("pdfme 実 PDF — 回転の向きと中心", () => {
  it("rotation: 回転テキストの原点が要素中心周りの時計回り写像に一致する", async () => {
    const { document, data } = loadFixture("rotation.json", "rotation-data.json");
    const pdfBytes = await generatePdfmePdf(document, data, fontData);
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(`${outputDir}/pdfme-rotation.pdf`, pdfBytes);
    const pdf = await extractPdf(pdfBytes);

    // 非回転の基準要素で抽出系そのものの健全性を確認する
    const flat = findItem(pdf, "水平");
    expect(flat.x).toBeCloseTo(20, 0);
    expect(flat.baselineY).toBeCloseTo(normativeBaselineY(20, 12, 1.25, 0), 0);

    const cases = [
      { text: "R", el: { x: 20, y: 100, w: 60, h: 10 }, deg: 90 },
      { text: "U", el: { x: 100, y: 100, w: 60, h: 10 }, deg: 180 },
    ];
    for (const { text, el, deg } of cases) {
      const expected = rotatedBaselineOrigin(el, 12, 1.25, deg);
      const item = findItem(pdf, text);
      expect(Math.abs(item.x - expected.x)).toBeLessThan(1);
      expect(Math.abs(item.baselineY - expected.y)).toBeLessThan(1);
    }
  });
});

describe("pdfme 実 PDF — 参照適合", () => {
  it.each([
    {
      name: "invoice",
      irFile: "invoice.json",
      dataFile: "invoice-data.json",
    },
    {
      name: "invoice-multipage",
      irFile: "invoice-multipage.json",
      dataFile: "invoice-multipage-data.json",
    },
  ])("$name", async ({ name, irFile, dataFile }) => {
    const { document, data } = loadFixture(irFile, dataFile);
    const pdfBytes = await generatePdfmePdf(document, data, fontData);
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(`${outputDir}/pdfme-${name}.pdf`, pdfBytes);

    const pdf = await extractPdf(pdfBytes);
    const expectation = buildReferenceExpectation(document, data, fontData);
    expect(checkAgainstReference(pdf, expectation)).toEqual([]);
  });
});
