import type { IrData, IrDocument, IrError } from "@denreport/core";
import { emptyDataFor } from "@denreport/core";
import type {
  ExportReportlabResult,
  FontIssue,
  FontSetData,
} from "@denreport/targets";
import {
  exportPdfme,
  exportReportlab,
  exportReportlabTemplate,
} from "@denreport/targets";
import type { Locale } from "../../i18n/locale.js";
import type { Messages } from "../../i18n/messages/index.js";
import { buildZip } from "./zip.js";

export type { FontIssue };

// File names for generated artifacts (fixed; the IR has no document name)
export const PDFME_EXPORT_FILE_NAME = "report-pdfme.json";
export const REPORTLAB_EXPORT_FILE_NAME = "report-reportlab.zip";
export const REPORTLAB_CODE_FILE_NAME = "report.py";
export const REPORTLAB_LICENSE_FILE_NAME = "OFL.txt";

export type ExportMessages = Messages["export"];

export type ParseExportDataResult =
  | { readonly ok: true; readonly mode: "data"; readonly data: IrData }
  | { readonly ok: true; readonly mode: "template" }
  | { readonly ok: false; readonly message: string };

/** Strict parse of the sample data JSON. Export does not fill in missing values.
    An empty string (after trim) means template mode. A non-empty string is parsed
    strictly; a JSON.parse failure or a top-level value that isn't an object
    (including arrays and null) is an error.
    message is user-facing text (including guidance pointing to the preview's sample
    data field) */
export function parseExportData(
  json: string,
  m: ExportMessages,
): ParseExportDataResult {
  if (json.trim() === "") {
    return { ok: true, mode: "template" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, message: m.jsonParseError };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, message: m.notObjectError };
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

/** Logical names of the document's declared slots (in order of appearance, no duplicates) */
function declaredFontNames(document: IrDocument): readonly string[] {
  const names: string[] = [];
  for (const name of [
    document.font.regular,
    document.font.bold,
    document.font.italic,
    document.font.boldItalic,
  ]) {
    if (name !== undefined && !names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

/** Calls exportPdfme and returns an ExportFile with { template, inputs } combined into a
    single JSON (2-space indent). C-group errors and FontIssues pass through unchanged, as
    do missing-key warnings.
    Only when fontSubset is false does the JSON include a font block (all logical names of
    the declared slots) telling the consumer to fully embed the font */
export function buildPdfmeArtifact(
  document: IrDocument,
  data: IrData,
  fonts: FontSetData,
  locale: Locale,
  fontSubset?: boolean,
): BuildPdfmeArtifactResult {
  const result = exportPdfme(document, data, fonts, { locale });
  if (!result.ok) {
    return { ok: false, errors: result.errors, fontIssues: result.fontIssues };
  }
  const envelope =
    fontSubset === false
      ? {
          template: result.template,
          inputs: result.inputs,
          font: { names: declaredFontNames(document), subset: false },
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

/** pdfme export for when no sample data has been entered. Synthesizes empty data that
    satisfies C01/C02 via emptyDataFor and passes it straight through to the existing
    buildPdfmeArtifact */
export function buildPdfmeTemplateArtifact(
  document: IrDocument,
  fonts: FontSetData,
  locale: Locale,
  fontSubset?: boolean,
): BuildPdfmeArtifactResult {
  return buildPdfmeArtifact(
    document,
    emptyDataFor(document),
    fonts,
    locale,
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
  embeddedFontLicense: Uint8Array | undefined,
): BuildReportlabArtifactResult {
  if (!result.ok) {
    return { ok: false, errors: result.errors, fontIssues: result.fontIssues };
  }
  const zip = buildZip([
    {
      name: REPORTLAB_CODE_FILE_NAME,
      data: new TextEncoder().encode(result.code),
    },
    ...result.fontFiles.map((fontFile) => ({
      name: fontFile.filename,
      data: fontFile.data,
    })),
    ...(embeddedFontLicense === undefined
      ? []
      : [{ name: REPORTLAB_LICENSE_FILE_NAME, data: embeddedFontLicense }]),
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

/** Calls exportReportlab and returns an ExportFile that bundles code
    (REPORTLAB_CODE_FILE_NAME), fontFiles (one per declared slot), and — when
    embeddedFontLicense is passed — REPORTLAB_LICENSE_FILE_NAME (OFL.txt) at the zip root, via
    buildZip. C-group errors and FontIssues pass through unchanged (both can occur at the same
    time). Missing-key warnings also pass through (always empty for template-mode builders) */
export function buildReportlabArtifact(
  document: IrDocument,
  data: IrData,
  fonts: FontSetData,
  locale: Locale,
  embeddedFontLicense?: Uint8Array,
): BuildReportlabArtifactResult {
  return bundleReportlabResult(
    exportReportlab(document, data, fonts, { locale }),
    embeddedFontLicense,
  );
}

/** ReportLab export for when no sample data has been entered. Wraps exportReportlabTemplate
    in the same zip layout.
    errors is always empty (data validation moves to runtime of the generated code) */
export function buildReportlabTemplateArtifact(
  document: IrDocument,
  fonts: FontSetData,
  locale: Locale,
  embeddedFontLicense?: Uint8Array,
): BuildReportlabArtifactResult {
  return bundleReportlabResult(
    exportReportlabTemplate(document, fonts, { locale }),
    embeddedFontLicense,
  );
}
