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
  it("becomes template mode for an empty string (including whitespace-only)", () => {
    for (const json of ["", "  \n"]) {
      const result = parseExportData(json, ja.export);
      expect(result).toEqual({ ok: true, mode: "template" });
    }
  });

  it("becomes a parse error when JSON.parse fails, and directs the user to the preview", () => {
    const result = parseExportData('{"a":', ja.export);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("失敗を期待");
    expect(result.message).toContain("JSON として解釈できません");
    expect(result.message).toContain("プレビューのサンプルデータ欄");
  });

  it("errors when the top level is not an object (array, null, number)", () => {
    for (const json of ["[]", "null", "1", '"a"']) {
      const result = parseExportData(json, ja.export);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("失敗を期待");
      expect(result.message).toContain("オブジェクトではありません");
      expect(result.message).toContain("プレビューのサンプルデータ欄");
    }
  });

  it("returns data mode when the top level is an object", () => {
    const result = parseExportData('{"title": "請求書"}', ja.export);
    expect(result).toEqual({
      ok: true,
      mode: "data",
      data: { title: "請求書" },
    });
  });
});

describe("buildPdfmeArtifact", () => {
  it("produces a single JSON file whose template / inputs equal exportPdfme's", async () => {
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

  it("propagates the IrError and returns no artifact for C01 type-mismatched data", () => {
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

  it("returns an artifact and propagates warnings when a bind key is missing", () => {
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

  it("propagates fontIssues and returns no artifact for a CFF font", () => {
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

  it("keeps the top-level JSON keys to only template / inputs when fontSubset is omitted", async () => {
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

  it("adds a font block when fontSubset: false", async () => {
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
  it("empties bind-derived keys while static text keeps its original value", async () => {
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

  it("produces an artifact equal to exportPdfme(document, emptyDataFor(document))", async () => {
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

  it("adds a font block when fontSubset: false", async () => {
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
  it("has 2 entries in the zip: report.py and fontFile.filename", async () => {
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

  it("propagates locale into the generated script's wording", async () => {
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

  it("propagates fontIssues and returns no artifact for a CFF font", () => {
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

  it("reports C-group violations and font violations together", () => {
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

  it("returns an artifact and propagates warnings when a bind key is missing", () => {
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

  it("adds OFL.txt at the zip root with content identical to the asset when embeddedFontLicense is passed", async () => {
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

  it("excludes OFL.txt when embeddedFontLicense is omitted (the case of not using the bundled font)", async () => {
    const result = buildReportlabArtifact(docOf(), {}, FONT_SET, "ja");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("成功を期待");

    const zip = new Uint8Array(await result.file.blob.arrayBuffer());
    const entries = listZipEntries(zip);
    expect(entries.map((e) => e.name)).toEqual(["report.py", "NotoSansJP.ttf"]);
  });
});

describe("buildReportlabTemplateArtifact", () => {
  it("has 2 entries in the zip (report.py, fontFile.filename) and includes the template's build signature", async () => {
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

  it("propagates fontIssues and returns no artifact for a CFF font (errors is always empty)", () => {
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

  it("adds OFL.txt at the zip root when embeddedFontLicense is passed", async () => {
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

  it("excludes OFL.txt when embeddedFontLicense is omitted", async () => {
    const result = buildReportlabTemplateArtifact(docOf(), FONT_SET, "ja");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("成功を期待");

    const zip = new Uint8Array(await result.file.blob.arrayBuffer());
    const entries = listZipEntries(zip);
    expect(entries.map((e) => e.name)).toEqual(["report.py", "NotoSansJP.ttf"]);
  });
});
