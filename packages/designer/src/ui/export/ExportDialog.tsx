import type { IrError, IrFontSlot } from "@denreport/core";
import { COMPAT_MATRICES, checkCompat } from "@denreport/core";
import type { FontSetData } from "@denreport/targets";
import { EMBEDDED_BOLD_FONT_URL, EMBEDDED_FONT_URL } from "@denreport/targets";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { triggerDownload } from "../../api/download";
import { useLocale, useMessages } from "../../i18n/context";
import {
  EXPORT_TARGET_IDS,
  groupCompatFindings,
} from "../../state/export-warnings";
import type { FontResolution } from "../../state/fonts";
import { resolveFontSet } from "../../state/fonts";
import { layoutDocument, visibleInContext } from "../../state/geometry";
import { activeSampleJson } from "../../state/sample-scenarios";
import type { EditorStore } from "../../state/store";
import { Dialog } from "../dialog/Dialog";
import {
  EMBEDDED_BOLD_FONT_NAME,
  EMBEDDED_FONT_NAME,
} from "../fonts/font-registration";
import { useEditorState } from "../useEditorState";
import { fetchEmbeddedFontData } from "./export-font";
import type { ExportFile, FontIssue } from "./run-export";
import {
  buildPdfmeArtifact,
  buildPdfmeTemplateArtifact,
  buildReportlabArtifact,
  buildReportlabTemplateArtifact,
  parseExportData,
} from "./run-export";
import { WarningGroupCard } from "./WarningGroupCard";

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

/** 解決済みスロットの実データを取得する。missing は呼び出し側が先に弾いている前提 */
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
  /** 要素ジャンプ時、選択・文脈切替の後に呼ぶ */
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

  // 生成物のダウンロードは欠落キー警告の有無によらず実行する。警告があれば
  // ダイアログを開いたまま export-warning を表示し、なければ従来どおり閉じる
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

    const runWithFonts = (fonts: FontSetData): void => {
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
            ? buildReportlabTemplateArtifact(current.document, fonts, locale)
            : buildReportlabArtifact(
                current.document,
                parsed.data,
                fonts,
                locale,
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
    Promise.all(
      entries.map(([slot, resolution]) =>
        fontDataFor(resolution).then((data) => [slot, data] as const),
      ),
    ).then(
      (loaded) => {
        const bySlot = new Map<IrFontSlot, Uint8Array>(loaded);
        const regular = bySlot.get("regular");
        if (regular === undefined) {
          setRun({ kind: "font-fetch-error" });
          return;
        }
        const bold = bySlot.get("bold");
        const italic = bySlot.get("italic");
        const boldItalic = bySlot.get("boldItalic");
        runWithFonts({
          regular,
          ...(bold !== undefined ? { bold } : {}),
          ...(italic !== undefined ? { italic } : {}),
          ...(boldItalic !== undefined ? { boldItalic } : {}),
        });
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
          <span className="apx-dialog-note">
            {validationErrorCount > 0
              ? m.export.blockedByErrors(validationErrorCount)
              : m.export.warningsNote}
          </span>
          <button
            type="button"
            className="apx-btn apx-btn-secondary"
            onClick={onClose}
          >
            {m.export.close}
          </button>
          <button
            type="button"
            className="apx-btn apx-btn-primary"
            disabled={validationErrorCount > 0 || running}
            onClick={(event) => runExport(event.currentTarget.ownerDocument)}
          >
            {m.export.run}
          </button>
        </>
      }
    >
      <div className="apx-tcards">
        {EXPORT_TARGET_IDS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={target === id}
            className={`apx-tcard${target === id ? " is-selected" : ""}`}
            onClick={() => {
              store.setSelectedExportTarget(id);
              setRun(RUN_IDLE);
            }}
          >
            <span className="apx-rdot" aria-hidden="true" />
            <span className="apx-tcard-label">
              <span className="apx-tcard-name">
                {COMPAT_MATRICES[id].displayName}
              </span>
              <span className="apx-tcard-sub">
                {m.export.targetDescriptions[id]}
              </span>
            </span>
          </button>
        ))}
      </div>
      {target === "pdfme" && (
        <>
          <label className="apx-check">
            <input
              type="checkbox"
              checked={fullEmbedFont}
              onChange={(e) => setFullEmbedFont(e.currentTarget.checked)}
            />
            {m.export.fullEmbedFont}
          </label>
          <p className="apx-dialog-note">{m.export.fullEmbedFontNote}</p>
        </>
      )}
      <div className="apx-export-warns">
        <p className="apx-export-warns-h">
          {m.export.compatWarnings}
          {findingTotal > 0 && (
            <span className="apx-badge apx-badge-warn">{findingTotal}</span>
          )}
        </p>
        {groups.length === 0 ? (
          <p className="apx-export-ok">{m.export.compatOk}</p>
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
        <p className="apx-dialog-note">{m.export.templateModeNote}</p>
      )}
      {running && <p className="apx-export-running">{m.export.running}</p>}
      {run.kind === "data-error" && (
        <div className="apx-export-error" role="alert">
          <p>{run.message}</p>
          <p className="apx-dialog-note">{m.export.noArtifact}</p>
        </div>
      )}
      {run.kind === "font-fetch-error" && (
        <div className="apx-export-error" role="alert">
          <p>{m.export.fontFetchFailed}</p>
          <p className="apx-dialog-note">{m.export.noArtifact}</p>
        </div>
      )}
      {run.kind === "font-missing" && (
        <div className="apx-export-error" role="alert">
          <p>{m.export.fontMissing(m.fonts.slotLabels[run.slot], run.name)}</p>
          <p className="apx-dialog-note">{m.export.noArtifact}</p>
        </div>
      )}
      {run.kind === "export-error" && (
        <div className="apx-export-error" role="alert">
          <p>{m.export.failed}</p>
          {run.errors.length > 0 && (
            <ul className="apx-dialog-errors">
              {run.errors.map((error, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: 同一 rule / path のエラーが並び得るため index で識別する
                <li key={i}>
                  <span className="apx-verr-rule">{error.rule}</span>
                  <span className="apx-verr-path">{error.path}</span>
                  <span>{error.message}</span>
                </li>
              ))}
            </ul>
          )}
          {run.fontIssues.length > 0 && (
            <ul className="apx-export-font-issues">
              {run.fontIssues.map((issue, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: 同一 format のエラーが並び得るため index で識別する
                <li key={i}>
                  <span className="apx-verr-rule">{issue.format}</span>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="apx-dialog-note">{m.export.noArtifact}</p>
        </div>
      )}
      {run.kind === "export-warning" && (
        <div role="status">
          <p className="apx-dialog-note">{m.export.warningsProduced}</p>
          <ul className="apx-dialog-errors">
            {run.warnings.map((warning, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 同一 rule / path の警告が並び得るため index で識別する
              <li key={i}>
                <span className="apx-verr-rule">{warning.rule}</span>
                <span className="apx-verr-path">{warning.path}</span>
                <span>{warning.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
