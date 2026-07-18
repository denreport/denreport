import type { IrData, IrDocument, IrError } from "@denreport/core";
import { emptyDataFor } from "@denreport/core";
import type { ExportReportlabResult, FontIssue } from "@denreport/targets";
import {
  exportPdfme,
  exportReportlab,
  exportReportlabTemplate,
} from "@denreport/targets";
import { buildZip } from "./zip";

export type { FontIssue };

// 生成物のファイル名（固定。IR に文書名は存在しない）
export const PDFME_EXPORT_FILE_NAME = "report-pdfme.json";
export const REPORTLAB_EXPORT_FILE_NAME = "report-reportlab.zip";
export const REPORTLAB_CODE_FILE_NAME = "report.py";

const DATA_EDIT_GUIDE = "プレビューのサンプルデータ欄で入力・生成できます。";

export type ParseExportDataResult =
  | { readonly ok: true; readonly mode: "data"; readonly data: IrData }
  | { readonly ok: true; readonly mode: "template" }
  | { readonly ok: false; readonly message: string };

/** サンプルデータ JSON の厳格パース。書き出しは補完しない。
    空文字列（trim 後）は雛形モード。非空は厳格パースし、JSON.parse 不能 /
    トップレベルが非オブジェクト（配列・null 含む）はエラー。
    message は利用者向け文言（プレビューのサンプルデータ欄への誘導を含む） */
export function parseExportData(json: string): ParseExportDataResult {
  if (json.trim() === "") {
    return { ok: true, mode: "template" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      ok: false,
      message: `サンプルデータを JSON として解釈できません。${DATA_EDIT_GUIDE}`,
    };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      message: `サンプルデータのトップレベルがオブジェクトではありません。${DATA_EDIT_GUIDE}`,
    };
  }
  return { ok: true, mode: "data", data: parsed as IrData };
}

export interface ExportFile {
  readonly filename: string;
  readonly blob: Blob;
}

export type BuildPdfmeArtifactResult =
  | {
      readonly ok: true;
      readonly file: ExportFile;
      readonly warnings: readonly IrError[];
    }
  | {
      readonly ok: false;
      readonly errors: readonly IrError[];
      readonly fontIssues: readonly FontIssue[];
    };

/** exportPdfme を呼び、{ template, inputs } を1つの JSON（2スペースインデント）にした
    ExportFile を返す。C 群エラー・FontIssue は透過、欠落キーの警告も透過。
    fontSubset が false のときのみ、利用側へ全体埋め込みを伝える font ブロックを JSON に含める */
export function buildPdfmeArtifact(
  document: IrDocument,
  data: IrData,
  fontData: Uint8Array,
  fontSubset?: boolean,
): BuildPdfmeArtifactResult {
  const result = exportPdfme(document, data, fontData);
  if (!result.ok) {
    return { ok: false, errors: result.errors, fontIssues: result.fontIssues };
  }
  const envelope =
    fontSubset === false
      ? {
          template: result.template,
          inputs: result.inputs,
          font: { name: document.font.name, subset: false },
        }
      : { template: result.template, inputs: result.inputs };
  const json = JSON.stringify(envelope, null, 2);
  return {
    ok: true,
    file: {
      filename: PDFME_EXPORT_FILE_NAME,
      blob: new Blob([json], { type: "application/json" }),
    },
    warnings: result.warnings,
  };
}

/** サンプルデータ未入力時の pdfme 書き出し。emptyDataFor で C01/C02 を満たす空データを
    合成し、既存の buildPdfmeArtifact にそのまま通す */
export function buildPdfmeTemplateArtifact(
  document: IrDocument,
  fontData: Uint8Array,
  fontSubset?: boolean,
): BuildPdfmeArtifactResult {
  return buildPdfmeArtifact(
    document,
    emptyDataFor(document),
    fontData,
    fontSubset,
  );
}

export type BuildReportlabArtifactResult =
  | {
      readonly ok: true;
      readonly file: ExportFile;
      readonly warnings: readonly IrError[];
    }
  | {
      readonly ok: false;
      readonly errors: readonly IrError[];
      readonly fontIssues: readonly FontIssue[];
    };

function bundleReportlabResult(
  result: ExportReportlabResult,
): BuildReportlabArtifactResult {
  if (!result.ok) {
    return { ok: false, errors: result.errors, fontIssues: result.fontIssues };
  }
  const zip = buildZip([
    {
      name: REPORTLAB_CODE_FILE_NAME,
      data: new TextEncoder().encode(result.code),
    },
    { name: result.fontFile.filename, data: result.fontFile.data },
  ]);
  return {
    ok: true,
    file: {
      filename: REPORTLAB_EXPORT_FILE_NAME,
      blob: new Blob([zip], { type: "application/zip" }),
    },
    warnings: result.warnings,
  };
}

/** exportReportlab を呼び、code（REPORTLAB_CODE_FILE_NAME）と fontFile（fontFile.filename）を
    buildZip で束ねた ExportFile を返す。C 群エラー・FontIssue は透過（両方同時にあり得る）。
    欠落キーの警告も透過（雛形系ビルダーは常に空） */
export function buildReportlabArtifact(
  document: IrDocument,
  data: IrData,
  fontData: Uint8Array,
): BuildReportlabArtifactResult {
  return bundleReportlabResult(exportReportlab(document, data, fontData));
}

/** サンプルデータ未入力時の ReportLab 書き出し。exportReportlabTemplate を同じ zip 構成で包む。
    errors は常に空（データ検証は生成コードの実行時に移る） */
export function buildReportlabTemplateArtifact(
  document: IrDocument,
  fontData: Uint8Array,
): BuildReportlabArtifactResult {
  return bundleReportlabResult(exportReportlabTemplate(document, fontData));
}
