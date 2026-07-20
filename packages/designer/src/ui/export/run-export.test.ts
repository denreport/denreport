import { readFileSync } from "node:fs";
import type { IrDocument } from "@denreport/core";
import { emptyDataFor } from "@denreport/core";
import {
  EMBEDDED_FONT_LICENSE_URL,
  EMBEDDED_FONT_URL,
  exportPdfme,
} from "@denreport/targets";
import { describe, expect, it } from "vitest";
import { ja } from "../../i18n/messages/ja";
import {
  buildPdfmeArtifact,
  buildPdfmeTemplateArtifact,
  buildReportlabArtifact,
  buildReportlabTemplateArtifact,
  parseExportData,
} from "./run-export";

// Under jsdom, the URL derived from import.meta.url becomes http://localhost:3000/@fs/...
const EMBEDDED_FONT = new Uint8Array(
  readFileSync(EMBEDDED_FONT_URL.pathname.replace(/^\/@fs/, "")),
);
const EMBEDDED_LICENSE = new Uint8Array(
  readFileSync(EMBEDDED_FONT_LICENSE_URL.pathname.replace(/^\/@fs/, "")),
);
const FONT_SET = { regular: EMBEDDED_FONT };

// A synthetic font with just an OTTO header + CFF table. Format detection only reads the directory
function syntheticCff(): Uint8Array {
  const bytes = new Uint8Array(12 + 16);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x4f54544f); // "OTTO"
  view.setUint16(4, 1);
  view.setUint32(12, 0x43464620); // "CFF "
  return bytes;
}

function docOf(...elements: IrDocument["elements"]): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements,
  };
}

function textBound(id: string, key: string): IrDocument["elements"][number] {
  return {
    type: "text",
    id,
    x: 10,
    y: 10,
    pages: "first",
    w: 100,
    h: 10,
    text: `{${key}}`,
    fontSize: 10,
    align: "left",
    lineHeight: 1.2,
  };
}

function staticText(id: string, text: string): IrDocument["elements"][number] {
  return {
    type: "text",
    id,
    x: 0,
    y: 0,
    pages: "first",
    w: 100,
    h: 10,
    text,
    fontSize: 10,
    align: "left",
    lineHeight: 1.2,
  };
}

interface ZipListing {
  readonly name: string;
  readonly data: Uint8Array;
}

function listZipEntries(bytes: Uint8Array): ZipListing[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  expect(view.getUint32(eocd, true)).toBe(0x06054b50);
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries: ZipListing[] = [];
  for (let i = 0; i < count; i++) {
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
    );
    const localNameLength = view.getUint16(localOffset + 26, true);
    const dataStart = localOffset + 30 + localNameLength;
    entries.push({ name, data: bytes.subarray(dataStart, dataStart + size) });
    offset += 46 + nameLength;
  }
  return entries;
}

describe("parseExportData", () => {
  it("空文字列（空白のみ含む）は雛形モードになる", () => {
    for (const json of ["", "  \n"]) {
      const result = parseExportData(json, ja.export);
      expect(result).toEqual({ ok: true, mode: "template" });
    }
  });

  it("JSON.parse 不能はパースエラーになり、プレビューへ誘導する", () => {
    const result = parseExportData('{"a":', ja.export);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("失敗を期待");
    expect(result.message).toContain("JSON として解釈できません");
    expect(result.message).toContain("プレビューのサンプルデータ欄");
  });

  it("トップレベルが非オブジェクト（配列・null・数値）はエラーになる", () => {
    for (const json of ["[]", "null", "1", '"a"']) {
      const result = parseExportData(json, ja.export);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("失敗を期待");
      expect(result.message).toContain("オブジェクトではありません");
      expect(result.message).toContain("プレビューのサンプルデータ欄");
    }
  });

  it("トップレベルがオブジェクトならデータモードで返す", () => {
    const result = parseExportData('{"title": "請求書"}', ja.export);
    expect(result).toEqual({
      ok: true,
      mode: "data",
      data: { title: "請求書" },
    });
  });
});

describe("buildPdfmeArtifact", () => {
  it("生成 JSON は exportPdfme の template / inputs と同値の単一ファイルになる", async () => {
    const doc = docOf(textBound("title", "title"));
    const data = { title: "請求書" };
    const result = buildPdfmeArtifact(doc, data, FONT_SET, "ja");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("成功を期待");
    expect(result.file.filename).toBe("report-pdfme.json");
    expect(result.file.blob.type).toBe("application/json");

    const direct = exportPdfme(doc, data, FONT_SET);
    if (!direct.ok) throw new Error("exportPdfme の成功を期待");
    expect(JSON.parse(await result.file.blob.text())).toEqual({
      template: direct.template,
      inputs: direct.inputs,
    });
  });

  it("C01 型不一致データでは IrError を透過して生成物を返さない", () => {
    const result = buildPdfmeArtifact(
      docOf(textBound("title", "title")),
      { title: 123 },
      FONT_SET,
      "ja",
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("失敗を期待");
    expect(result.errors.some((e) => e.rule === "C01")).toBe(true);
  });

  it("bind キー欠落では生成物を返し、warnings を透過する", () => {
    const result = buildPdfmeArtifact(
      docOf(textBound("title", "title")),
      {},
      FONT_SET,
      "ja",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("成功を期待");
    expect(result.warnings.some((w) => w.rule === "C01")).toBe(true);
  });

  it("CFF フォントでは fontIssues を透過して生成物を返さない", () => {
    const result = buildPdfmeArtifact(
      docOf(),
      {},
      { regular: syntheticCff() },
      "ja",
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("失敗を期待");
    expect(result.fontIssues.length).toBeGreaterThan(0);
    expect(result.fontIssues[0]?.format).toBe("cff");
    expect(result.errors).toEqual([]);
  });

  it("fontSubset 省略時は JSON のトップレベルキーが template / inputs のみになる", async () => {
    const result = buildPdfmeArtifact(
      docOf(textBound("title", "title")),
      { title: "請求書" },
      FONT_SET,
      "ja",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("成功を期待");
    const parsed = JSON.parse(await result.file.blob.text());
    expect(Object.keys(parsed).sort()).toEqual(["inputs", "template"]);
  });

  it("fontSubset: false では font ブロックが加わる", async () => {
    const result = buildPdfmeArtifact(
      docOf(textBound("title", "title")),
      { title: "請求書" },
      FONT_SET,
      "ja",
      false,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("成功を期待");
    const parsed = JSON.parse(await result.file.blob.text());
    expect(Object.keys(parsed).sort()).toEqual(["font", "inputs", "template"]);
    expect(parsed.font).toEqual({ names: ["NotoSansJP"], subset: false });
  });
});

describe("buildPdfmeTemplateArtifact", () => {
  it("bind 由来キーは空文字列、静的 text は従来どおりの値になる", async () => {
    const doc = docOf(textBound("title", "title"), staticText("note", "備考"));
    const result = buildPdfmeTemplateArtifact(doc, FONT_SET, "ja");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("成功を期待");

    const parsed = JSON.parse(await result.file.blob.text());
    const names: string[] = parsed.template.schemas[0].map(
      (s: { name: string }) => s.name,
    );
    const titleName = names.find((name) => name.startsWith("p1_title_"));
    const noteName = names.find((name) => name.startsWith("p1_note_"));
    expect(parsed.inputs[0][titleName as string]).toBe("");
    expect(parsed.inputs[0][noteName as string]).toBe("備考");
  });

  it("exportPdfme(document, emptyDataFor(document)) と同値の生成物になる", async () => {
    const doc = docOf(textBound("title", "title"));
    const result = buildPdfmeTemplateArtifact(doc, FONT_SET, "ja");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("成功を期待");

    const direct = exportPdfme(doc, emptyDataFor(doc), FONT_SET);
    if (!direct.ok) throw new Error("exportPdfme の成功を期待");
    expect(JSON.parse(await result.file.blob.text())).toEqual({
      template: direct.template,
      inputs: direct.inputs,
    });
  });

  it("fontSubset: false では font ブロックが加わる", async () => {
    const doc = docOf(textBound("title", "title"));
    const result = buildPdfmeTemplateArtifact(doc, FONT_SET, "ja", false);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("成功を期待");
    const parsed = JSON.parse(await result.file.blob.text());
    expect(Object.keys(parsed).sort()).toEqual(["font", "inputs", "template"]);
    expect(parsed.font).toEqual({ names: ["NotoSansJP"], subset: false });
  });
});

describe("buildReportlabArtifact", () => {
  it("zip 内に report.py と fontFile.filename の2エントリを持つ", async () => {
    const result = buildReportlabArtifact(docOf(), {}, FONT_SET, "ja");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("成功を期待");
    expect(result.file.filename).toBe("report-reportlab.zip");
    expect(result.file.blob.type).toBe("application/zip");

    const zip = new Uint8Array(await result.file.blob.arrayBuffer());
    const entries = listZipEntries(zip);
    expect(entries.map((e) => e.name)).toEqual(["report.py", "NotoSansJP.ttf"]);
    // Fully scanning a several-MB Uint8Array with toEqual would time out, so compare via Buffer instead
    expect(
      Buffer.from(entries[1]?.data ?? []).equals(Buffer.from(EMBEDDED_FONT)),
    ).toBe(true);
    expect(new TextDecoder().decode(entries[0]?.data)).toContain(
      '"NotoSansJP": ("NotoSansJP.ttf", ',
    );
  });

  it("locale が生成スクリプトの文言に伝わる", async () => {
    const scriptOf = async (locale: "ja" | "en"): Promise<string> => {
      const result = buildReportlabArtifact(docOf(), {}, FONT_SET, locale);
      if (!result.ok) throw new Error("成功を期待");
      const zip = new Uint8Array(await result.file.blob.arrayBuffer());
      return new TextDecoder().decode(listZipEntries(zip)[0]?.data);
    };
    expect(await scriptOf("en")).toContain(
      "Generated file; not intended for manual editing.",
    );
    expect(await scriptOf("ja")).not.toContain(
      "Generated file; not intended for manual editing.",
    );
  });

  it("CFF フォントでは fontIssues を透過して生成物を返さない", () => {
    const result = buildReportlabArtifact(
      docOf(),
      {},
      {
        regular: syntheticCff(),
      },
      "ja",
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("失敗を期待");
    expect(result.fontIssues.length).toBeGreaterThan(0);
    expect(result.fontIssues[0]?.format).toBe("cff");
    expect(result.errors).toEqual([]);
  });

  it("C 群違反とフォント違反は同時に報告される", () => {
    const result = buildReportlabArtifact(
      docOf(textBound("title", "title")),
      { title: 123 },
      { regular: syntheticCff() },
      "ja",
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("失敗を期待");
    expect(result.errors.some((e) => e.rule === "C01")).toBe(true);
    expect(result.fontIssues.length).toBeGreaterThan(0);
  });

  it("bind キー欠落では生成物を返し、warnings を透過する", () => {
    const result = buildReportlabArtifact(
      docOf(textBound("title", "title")),
      {},
      FONT_SET,
      "ja",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("成功を期待");
    expect(result.warnings.some((w) => w.rule === "C01")).toBe(true);
  });

  it("embeddedFontLicense を渡すと zip ルートに OFL.txt が追加され、資材と同一内容になる", async () => {
    const result = buildReportlabArtifact(
      docOf(),
      {},
      FONT_SET,
      "ja",
      EMBEDDED_LICENSE,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("成功を期待");

    const zip = new Uint8Array(await result.file.blob.arrayBuffer());
    const entries = listZipEntries(zip);
    expect(entries.map((e) => e.name)).toEqual([
      "report.py",
      "NotoSansJP.ttf",
      "OFL.txt",
    ]);
    expect(
      Buffer.from(entries[2]?.data ?? []).equals(Buffer.from(EMBEDDED_LICENSE)),
    ).toBe(true);
  });

  it("embeddedFontLicense を省略すると OFL.txt を含まない（同梱フォント不使用のケース）", async () => {
    const result = buildReportlabArtifact(docOf(), {}, FONT_SET, "ja");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("成功を期待");

    const zip = new Uint8Array(await result.file.blob.arrayBuffer());
    const entries = listZipEntries(zip);
    expect(entries.map((e) => e.name)).toEqual(["report.py", "NotoSansJP.ttf"]);
  });
});

describe("buildReportlabTemplateArtifact", () => {
  it("zip 内に report.py と fontFile.filename の2エントリを持ち、雛形の build シグネチャを含む", async () => {
    const result = buildReportlabTemplateArtifact(
      docOf(textBound("title", "title")),
      FONT_SET,
      "ja",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("成功を期待");
    expect(result.file.filename).toBe("report-reportlab.zip");

    const zip = new Uint8Array(await result.file.blob.arrayBuffer());
    const entries = listZipEntries(zip);
    expect(entries.map((e) => e.name)).toEqual(["report.py", "NotoSansJP.ttf"]);
    expect(new TextDecoder().decode(entries[0]?.data)).toContain(
      "def build(output_path, data=None):",
    );
  });

  it("CFF フォントでは fontIssues を透過して生成物を返さない（errors は常に空）", () => {
    const result = buildReportlabTemplateArtifact(
      docOf(),
      { regular: syntheticCff() },
      "ja",
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("失敗を期待");
    expect(result.fontIssues.length).toBeGreaterThan(0);
    expect(result.errors).toEqual([]);
  });

  it("embeddedFontLicense を渡すと zip ルートに OFL.txt が追加される", async () => {
    const result = buildReportlabTemplateArtifact(
      docOf(),
      FONT_SET,
      "ja",
      EMBEDDED_LICENSE,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("成功を期待");

    const zip = new Uint8Array(await result.file.blob.arrayBuffer());
    const entries = listZipEntries(zip);
    expect(entries.map((e) => e.name)).toEqual([
      "report.py",
      "NotoSansJP.ttf",
      "OFL.txt",
    ]);
  });

  it("embeddedFontLicense を省略すると OFL.txt を含まない", async () => {
    const result = buildReportlabTemplateArtifact(docOf(), FONT_SET, "ja");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("成功を期待");

    const zip = new Uint8Array(await result.file.blob.arrayBuffer());
    const entries = listZipEntries(zip);
    expect(entries.map((e) => e.name)).toEqual(["report.py", "NotoSansJP.ttf"]);
  });
});
