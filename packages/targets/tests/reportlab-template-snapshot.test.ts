import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { IrData, IrDocument } from "@denreport/core";
import { parseIr } from "@denreport/core";
import { describe, expect, it } from "vitest";
import { EMBEDDED_FONT_URL } from "../src/fonts/embedded";
import { exportReportlabTemplate } from "../src/reportlab/export-template";

const fixturesDir = fileURLToPath(new URL("fixtures", import.meta.url));
const coreFixturesDir = fileURLToPath(
  new URL("../../core/tests/fixtures", import.meta.url),
);

function readJson<T>(dir: string, name: string): T {
  return JSON.parse(readFileSync(`${dir}/${name}`, "utf-8")) as T;
}

function staticDocument(): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { name: "NotoSansJP" },
    elements: [
      {
        type: "text",
        id: "title",
        x: 0,
        y: 18,
        pages: "all",
        w: 210,
        h: 12,
        text: "見本",
        fontSize: 22,
        align: "center",
        lineHeight: 1.25,
      },
      {
        type: "line",
        id: "underline",
        orientation: "horizontal",
        x: 15,
        y: 32,
        pages: "all",
        length: 180,
        thickness: 0.4,
      },
    ],
  };
}

function tokenDocument(): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { name: "NotoSansJP" },
    elements: [
      {
        type: "text",
        id: "customerName",
        x: 0,
        y: 0,
        pages: "first",
        w: 100,
        h: 10,
        text: "{customerName}",
        fontSize: 12,
        align: "left",
        lineHeight: 1.2,
      },
      {
        type: "text",
        id: "total",
        x: 0,
        y: 10,
        pages: "first",
        w: 100,
        h: 10,
        text: "合計: {total} 円",
        fontSize: 12,
        align: "left",
        lineHeight: 1.2,
      },
    ],
  };
}

function footnotesDocument(): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { name: "NotoSansJP" },
    elements: [
      {
        type: "text",
        id: "notice",
        x: 0,
        y: 18,
        pages: "all",
        w: 210,
        h: 12,
        text: "税抜{#tax}価格です",
        fontSize: 12,
        align: "left",
        lineHeight: 1.25,
      },
    ],
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
}

describe("exportReportlabTemplate — golden fixture snapshots", () => {
  it("reportlab-template-token", async () => {
    const fontData = new Uint8Array(readFileSync(EMBEDDED_FONT_URL));
    const result = exportReportlabTemplate(tokenDocument(), fontData);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");

    await expect(result.code).toMatchFileSnapshot(
      "./__snapshots__/reportlab-template-token.py",
    );
    await expect(
      JSON.stringify(
        {
          data: { customerName: "株式会社サンプル", total: "12,000" },
          pages: 1,
        },
        null,
        2,
      ),
    ).toMatchFileSnapshot("./__snapshots__/reportlab-template-token.data.json");
  });

  it("reportlab-template-static", async () => {
    const fontData = new Uint8Array(readFileSync(EMBEDDED_FONT_URL));
    const result = exportReportlabTemplate(staticDocument(), fontData);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");

    await expect(result.code).toMatchFileSnapshot(
      "./__snapshots__/reportlab-template-static.py",
    );
    await expect(
      JSON.stringify({ data: {}, pages: 1 }, null, 2),
    ).toMatchFileSnapshot(
      "./__snapshots__/reportlab-template-static.data.json",
    );
  });

  it("reportlab-template-invoice-multipage", async () => {
    const parsed = parseIr(
      readFileSync(`${coreFixturesDir}/invoice-multipage.json`, "utf-8"),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("expected valid IR fixture");
    const data = readJson<IrData>(fixturesDir, "invoice-multipage-data.json");
    const fontData = new Uint8Array(readFileSync(EMBEDDED_FONT_URL));

    const result = exportReportlabTemplate(parsed.document, fontData);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");

    await expect(result.code).toMatchFileSnapshot(
      "./__snapshots__/reportlab-template-invoice-multipage.py",
    );
    await expect(
      JSON.stringify({ data, pages: 3 }, null, 2),
    ).toMatchFileSnapshot(
      "./__snapshots__/reportlab-template-invoice-multipage.data.json",
    );
  });

  it("reportlab-template-footnotes", async () => {
    const fontData = new Uint8Array(readFileSync(EMBEDDED_FONT_URL));
    const result = exportReportlabTemplate(footnotesDocument(), fontData);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");

    await expect(result.code).toMatchFileSnapshot(
      "./__snapshots__/reportlab-template-footnotes.py",
    );
    await expect(
      JSON.stringify({ data: {}, pages: 1 }, null, 2),
    ).toMatchFileSnapshot(
      "./__snapshots__/reportlab-template-footnotes.data.json",
    );
  });
});
