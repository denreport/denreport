import type { IrError, IrFontSlot } from "@denreport/core";
import { COMPAT_MATRICES, checkCompat } from "@denreport/core";
import type { FontSetData } from "@denreport/targets";
import {
  EMBEDDED_BOLD_FONT_URL,
  EMBEDDED_FONT_LICENSE_URL,
  EMBEDDED_FONT_URL,
} from "@denreport/targets";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { triggerDownload } from "../../api/download.js";
import { useLocale, useMessages } from "../../i18n/context.js";
import {
  EXPORT_TARGET_IDS,
  groupCompatFindings,
} from "../../state/export-warnings.js";
import type { FontResolution } from "../../state/fonts.js";
import { resolveFontSet } from "../../state/fonts.js";
import { layoutDocument, visibleInContext } from "../../state/geometry.js";
import { activeSampleJson } from "../../state/sample-scenarios.js";
import type { EditorStore } from "../../state/store.js";
import { Dialog } from "../dialog/Dialog.js";
import {
  EMBEDDED_BOLD_FONT_NAME,
  EMBEDDED_FONT_NAME,
} from "../fonts/font-registration.js";
import { useEditorState } from "../useEditorState.js";
import { fetchEmbeddedFontData } from "./export-font.js";
import type { ExportFile, FontIssue } from "./run-export.js";
import {
  buildPdfmeArtifact,
  buildPdfmeTemplateArtifact,
  buildReportlabArtifact,
  buildReportlabTemplateArtifact,
  parseExportData,
} from "./run-export.js";
import { WarningGroupCard } from "./WarningGroupCard.js";

type RunState =
  | { readonly kind: "idle" }
  | { readonly kind: "running" }
  | { readonly kind: "data-error"; readonly message: string }
  | {
      readonly kind: "export-error";
      readonly errors: readonly IrError[];
      readonly fontIssues: readonly FontIssue[];
    }
  | { readonly kind: "export-warning"; readonly warnings: readonly IrError[] }
  | { readonly kind: "font-fetch-error" }
  | {
      readonly kind: "font-missing";
      readonly slot: IrFontSlot;
      readonly name: string;
    };

const EMBEDDED_NAMES: ReadonlySet<string> = new Set([
  EMBEDDED_FONT_NAME,
  EMBEDDED_BOLD_FONT_NAME,
]);

const EMBEDDED_URLS: Readonly<Record<string, URL>> = {
  [EMBEDDED_FONT_NAME]: EMBEDDED_FONT_URL,
  [EMBEDDED_BOLD_FONT_NAME]: EMBEDDED_BOLD_FONT_URL,
};

/** Fetches the actual data for a resolved slot. Assumes the caller has already filtered out
    "missing" beforehand */
async function fontDataFor(resolution: FontResolution): Promise<Uint8Array> {
  if (resolution.kind === "registered") {
    return resolution.font.data;
  }
  if (resolution.kind === "embedded") {
    const url = EMBEDDED_URLS[resolution.name];
    if (url !== undefined) {
      return fetchEmbeddedFontData(url);
    }
  }
  throw new Error("フォントの実データを解決できません");
}

const RUN_IDLE: RunState = { kind: "idle" };

export function ExportDialog(props: {
  readonly store: EditorStore;
  readonly onClose: () => void;
  /** Called after selection/context switch when jumping to an element */
  readonly onReveal: (id: string) => void;
}): ReactNode {
  const { store, onClose, onReveal } = props;
  const m = useMessages();
  const locale = useLocale();
  const state = useEditorState(store);
  const target = state.selectedExportTarget;
  const [run, setRun] = useState<RunState>(RUN_IDLE);
  const [fullEmbedFont, setFullEmbedFont] = useState(false);

  const groups = useMemo(
    () =>
      groupCompatFindings(
        checkCompat(state.document, COMPAT_MATRICES[target], { locale }),
      ),
    [state.document, target, locale],
  );
  const findingTotal = groups.reduce(
    (total, group) => total + group.findingCount,
    0,
  );
  const validationErrorCount = state.validationErrors.length;
  const running = run.kind === "running";
  const isTemplateMode = activeSampleJson(state.sampleScenarios).trim() === "";

  const jumpTo = (id: string): void => {
    onClose();
    const current = store.getState();
    const view = layoutDocument(
      current.document,
      current.view.pageContext,
    ).find((v) => v.id === id);
    if (view === undefined) {
      return;
    }
    if (!visibleInContext(view.pages, current.view.pageContext)) {
      const pages = view.pages;
      if (pages !== null && pages !== "all") {
        store.setView({ pageContext: pages });
      }
    }
    store.setSelection([id]);
    onReveal(id);
  };

  // Downloading the generated artifact happens regardless of missing-key warnings. If
  // there are warnings, show export-warning while keeping the dialog open; otherwise close
  // it as before
  const finishExport = (
    doc: Document,
    file: ExportFile,
    warnings: readonly IrError[],
  ): void => {
    triggerDownload(doc, file.filename, file.blob);
    if (warnings.length === 0) {
      onClose();
      return;
    }
    setRun({ kind: "export-warning", warnings });
  };

  const runExport = (doc: Document): void => {
    const current = store.getState();
    const parsed = parseExportData(
      activeSampleJson(current.sampleScenarios),
      m.export,
    );
    if (!parsed.ok) {
      setRun({ kind: "data-error", message: parsed.message });
      return;
    }

    const runWithFonts = (
      fonts: FontSetData,
      embeddedFontLicense: Uint8Array | undefined,
    ): void => {
      const built =
        target === "pdfme"
          ? parsed.mode === "template"
            ? buildPdfmeTemplateArtifact(
                current.document,
                fonts,
                locale,
                !fullEmbedFont,
              )
            : buildPdfmeArtifact(
                current.document,
                parsed.data,
                fonts,
                locale,
                !fullEmbedFont,
              )
          : parsed.mode === "template"
            ? buildReportlabTemplateArtifact(
                current.document,
                fonts,
                locale,
                embeddedFontLicense,
              )
            : buildReportlabArtifact(
                current.document,
                parsed.data,
                fonts,
                locale,
                embeddedFontLicense,
              );
      if (!built.ok) {
        setRun({
          kind: "export-error",
          errors: built.errors,
          fontIssues: built.fontIssues,
        });
        return;
      }
      finishExport(doc, built.file, built.warnings);
    };

    const resolutions = resolveFontSet(
      current.document.font,
      current.fontRegistry,
      EMBEDDED_NAMES,
    );
    const missing = [...resolutions.entries()].find(
      ([, resolution]) => resolution.kind === "missing",
    );
    if (missing !== undefined && missing[1].kind === "missing") {
      setRun({ kind: "font-missing", slot: missing[0], name: missing[1].name });
      return;
    }
    setRun({ kind: "running" });
    const entries = [...resolutions.entries()];
    // A registered font can share the bundled font's logical name (registration applies no
    // uniqueness check against it), so whether the export actually carries the bundled font
    // comes from each slot's resolved origin, not from the name
    const usesEmbeddedFont = entries.some(
      ([, resolution]) => resolution.kind === "embedded",
    );
    const licensePromise: Promise<Uint8Array | undefined> =
      target === "reportlab" && usesEmbeddedFont
        ? fetchEmbeddedFontData(EMBEDDED_FONT_LICENSE_URL)
        : Promise.resolve(undefined);
    Promise.all([
      Promise.all(
        entries.map(([slot, resolution]) =>
          fontDataFor(resolution).then((data) => [slot, data] as const),
        ),
      ),
      licensePromise,
    ]).then(
      ([loaded, embeddedFontLicense]) => {
        const bySlot = new Map<IrFontSlot, Uint8Array>(loaded);
        const regular = bySlot.get("regular");
        if (regular === undefined) {
          setRun({ kind: "font-fetch-error" });
          return;
        }
        const bold = bySlot.get("bold");
        const italic = bySlot.get("italic");
        const boldItalic = bySlot.get("boldItalic");
        runWithFonts(
          {
            regular,
            ...(bold !== undefined ? { bold } : {}),
            ...(italic !== undefined ? { italic } : {}),
            ...(boldItalic !== undefined ? { boldItalic } : {}),
          },
          embeddedFontLicense,
        );
      },
      () => {
        setRun({ kind: "font-fetch-error" });
      },
    );
  };

  return (
    <Dialog
      title={m.export.title}
      onClose={onClose}
      wide
      footer={
        <>
          <span className="dr-dialog-note">
            {validationErrorCount > 0
              ? m.export.blockedByErrors(validationErrorCount)
              : m.export.warningsNote}
          </span>
          <button
            type="button"
            className="dr-btn dr-btn-secondary"
            onClick={onClose}
          >
            {m.export.close}
          </button>
          <button
            type="button"
            className="dr-btn dr-btn-primary"
            disabled={validationErrorCount > 0 || running}
            onClick={(event) => runExport(event.currentTarget.ownerDocument)}
          >
            {m.export.run}
          </button>
        </>
      }
    >
      <div className="dr-tcards">
        {EXPORT_TARGET_IDS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={target === id}
            className={`dr-tcard${target === id ? " is-selected" : ""}`}
            onClick={() => {
              store.setSelectedExportTarget(id);
              setRun(RUN_IDLE);
            }}
          >
            <span className="dr-rdot" aria-hidden="true" />
            <span className="dr-tcard-label">
              <span className="dr-tcard-name">
                {COMPAT_MATRICES[id].displayName}
              </span>
              <span className="dr-tcard-sub">
                {m.export.targetDescriptions[id]}
              </span>
            </span>
          </button>
        ))}
      </div>
      {target === "pdfme" && (
        <>
          <label className="dr-check">
            <input
              type="checkbox"
              checked={fullEmbedFont}
              onChange={(e) => setFullEmbedFont(e.currentTarget.checked)}
            />
            {m.export.fullEmbedFont}
          </label>
          <p className="dr-dialog-note">{m.export.fullEmbedFontNote}</p>
        </>
      )}
      <div className="dr-export-warns">
        <p className="dr-export-warns-h">
          {m.export.compatWarnings}
          {findingTotal > 0 && (
            <span className="dr-badge dr-badge-warn">{findingTotal}</span>
          )}
        </p>
        {groups.length === 0 ? (
          <p className="dr-export-ok">{m.export.compatOk}</p>
        ) : (
          groups.map((group) => (
            <WarningGroupCard
              key={`${group.level}:${group.userMessage}`}
              group={group}
              onJump={jumpTo}
            />
          ))
        )}
      </div>
      {isTemplateMode && (
        <p className="dr-dialog-note">{m.export.templateModeNote}</p>
      )}
      {running && <p className="dr-export-running">{m.export.running}</p>}
      {run.kind === "data-error" && (
        <div className="dr-export-error" role="alert">
          <p>{run.message}</p>
          <p className="dr-dialog-note">{m.export.noArtifact}</p>
        </div>
      )}
      {run.kind === "font-fetch-error" && (
        <div className="dr-export-error" role="alert">
          <p>{m.export.fontFetchFailed}</p>
          <p className="dr-dialog-note">{m.export.noArtifact}</p>
        </div>
      )}
      {run.kind === "font-missing" && (
        <div className="dr-export-error" role="alert">
          <p>{m.export.fontMissing(m.fonts.slotLabels[run.slot], run.name)}</p>
          <p className="dr-dialog-note">{m.export.noArtifact}</p>
        </div>
      )}
      {run.kind === "export-error" && (
        <div className="dr-export-error" role="alert">
          <p>{m.export.failed}</p>
          {run.errors.length > 0 && (
            <ul className="dr-dialog-errors">
              {run.errors.map((error, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: errors with the same rule/path can appear side by side, so identify by index
                <li key={i}>
                  <span className="dr-verr-rule">{error.rule}</span>
                  <span className="dr-verr-path">{error.path}</span>
                  <span>{error.message}</span>
                </li>
              ))}
            </ul>
          )}
          {run.fontIssues.length > 0 && (
            <ul className="dr-export-font-issues">
              {run.fontIssues.map((issue, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: errors with the same format can appear side by side, so identify by index
                <li key={i}>
                  <span className="dr-verr-rule">{issue.format}</span>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="dr-dialog-note">{m.export.noArtifact}</p>
        </div>
      )}
      {run.kind === "export-warning" && (
        <div role="status">
          <p className="dr-dialog-note">{m.export.warningsProduced}</p>
          <ul className="dr-dialog-errors">
            {run.warnings.map((warning, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: warnings with the same rule/path can appear side by side, so identify by index
              <li key={i}>
                <span className="dr-verr-rule">{warning.rule}</span>
                <span className="dr-verr-path">{warning.path}</span>
                <span>{warning.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
