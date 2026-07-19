import type { IrError } from "@denreport/core";
import type { FontIssue } from "../fonts/validate";

/** A font file bundled with a reportlab export, to be placed alongside the generated script (see the script's header comment). */
export interface ReportlabFontFile {
  readonly filename: string;
  readonly data: Uint8Array;
}

/**
 * Result of exportReportlab or exportReportlabTemplate. On success, `code`
 * is the generated Python source and `fontFiles` are the font files it
 * references (one per declared font slot); `warnings` holds non-fatal data
 * problems (always empty for exportReportlabTemplate, which resolves data at
 * Python run time rather than at export time). On failure, `errors` holds
 * IR/data validation errors and `fontIssues` explains any font problem that
 * prevented export (either may be empty depending on which caused the
 * failure).
 */
export type ExportReportlabResult =
  | {
      readonly ok: true;
      readonly code: string;
      readonly fontFiles: readonly ReportlabFontFile[];
      readonly warnings: readonly IrError[];
    }
  | {
      readonly ok: false;
      readonly errors: readonly IrError[];
      readonly fontIssues: readonly FontIssue[];
    };
