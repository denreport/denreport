import type { CompatTargetId, IrError } from "@denreport/core";
import { COMPAT_MATRICES, checkCompat } from "@denreport/core";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { triggerDownload } from "../../api/download";
import {
  EXPORT_TARGET_IDS,
  groupCompatFindings,
} from "../../state/export-warnings";
import { resolveFont } from "../../state/fonts";
import { layoutDocument, visibleInContext } from "../../state/geometry";
import { activeSampleJson } from "../../state/sample-scenarios";
import type { EditorStore } from "../../state/store";
import { Dialog } from "../dialog/Dialog";
import { EMBEDDED_FONT_NAME } from "../fonts/font-registration";
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
  | { readonly kind: "font-missing"; readonly name: string };

const RUN_IDLE: RunState = { kind: "idle" };

const TARGET_DESCRIPTIONS: Readonly<Record<CompatTargetId, string>> = {
  pdfme: "テンプレート+inputs（JSON）",
  reportlab: "生成コード（.py + フォント、zip）",
};

export function ExportDialog(props: {
  readonly store: EditorStore;
  readonly onClose: () => void;
  /** 要素ジャンプ時、選択・文脈切替の後に呼ぶ */
  readonly onReveal: (id: string) => void;
}): ReactNode {
  const { store, onClose, onReveal } = props;
  const state = useEditorState(store);
  const target = state.selectedExportTarget;
  const [run, setRun] = useState<RunState>(RUN_IDLE);
  const [fullEmbedFont, setFullEmbedFont] = useState(false);

  const groups = useMemo(
    () =>
      groupCompatFindings(checkCompat(state.document, COMPAT_MATRICES[target])),
    [state.document, target],
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
    const parsed = parseExportData(activeSampleJson(current.sampleScenarios));
    if (!parsed.ok) {
      setRun({ kind: "data-error", message: parsed.message });
      return;
    }

    const runWithFontData = (fontData: Uint8Array): void => {
      const built =
        target === "pdfme"
          ? parsed.mode === "template"
            ? buildPdfmeTemplateArtifact(
                current.document,
                fontData,
                !fullEmbedFont,
              )
            : buildPdfmeArtifact(
                current.document,
                parsed.data,
                fontData,
                !fullEmbedFont,
              )
          : parsed.mode === "template"
            ? buildReportlabTemplateArtifact(current.document, fontData)
            : buildReportlabArtifact(current.document, parsed.data, fontData);
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

    const resolution = resolveFont(
      current.document.font.name,
      current.fontRegistry,
      EMBEDDED_FONT_NAME,
    );
    if (resolution.kind === "missing") {
      setRun({ kind: "font-missing", name: resolution.name });
      return;
    }
    if (resolution.kind === "registered") {
      runWithFontData(resolution.font.data);
      return;
    }
    setRun({ kind: "running" });
    fetchEmbeddedFontData().then(runWithFontData, () => {
      setRun({ kind: "font-fetch-error" });
    });
  };

  return (
    <Dialog
      title="書き出し"
      onClose={onClose}
      wide
      footer={
        <>
          <span className="apx-dialog-note">
            {validationErrorCount > 0
              ? `検証エラーが ${validationErrorCount} 件あるため実行できません。`
              : "警告は書き出しを妨げません。検証エラーがある場合は実行できません。"}
          </span>
          <button
            type="button"
            className="apx-btn apx-btn-secondary"
            onClick={onClose}
          >
            閉じる
          </button>
          <button
            type="button"
            className="apx-btn apx-btn-primary"
            disabled={validationErrorCount > 0 || running}
            onClick={(event) => runExport(event.currentTarget.ownerDocument)}
          >
            書き出す
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
              <span className="apx-tcard-sub">{TARGET_DESCRIPTIONS[id]}</span>
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
            フォントをまるごと埋め込む（サブセット化しない）
          </label>
          <p className="apx-dialog-note">
            pdfme
            は既定で使用文字のみを埋め込みますが、一部の日本語フォントで文字化けする場合が
            あります。文字化けする場合はオンにしてください。
          </p>
        </>
      )}
      <div className="apx-export-warns">
        <p className="apx-export-warns-h">
          互換性警告
          {findingTotal > 0 && (
            <span className="apx-badge apx-badge-warn">{findingTotal}</span>
          )}
        </p>
        {groups.length === 0 ? (
          <p className="apx-export-ok">
            ✓ 選択中のターゲットですべての要素を書き出せます。
          </p>
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
        <p className="apx-dialog-note">
          サンプルデータが未入力のため、雛形として書き出します。pdfme
          は差し込み値が空の テンプレート、ReportLab は build(出力パス, data)
          にデータを渡す形式になります。
        </p>
      )}
      {running && <p className="apx-export-running">書き出しています…</p>}
      {run.kind === "data-error" && (
        <div className="apx-export-error" role="alert">
          <p>{run.message}</p>
          <p className="apx-dialog-note">生成物は作成されていません。</p>
        </div>
      )}
      {run.kind === "font-fetch-error" && (
        <div className="apx-export-error" role="alert">
          <p>同梱フォントを取得できませんでした。もう一度お試しください。</p>
          <p className="apx-dialog-note">生成物は作成されていません。</p>
        </div>
      )}
      {run.kind === "font-missing" && (
        <div className="apx-export-error" role="alert">
          <p>
            フォント「{run.name}
            」の実データがありません。文書設定の「PC
            のフォントから選択」で選び直してください。
          </p>
          <p className="apx-dialog-note">生成物は作成されていません。</p>
        </div>
      )}
      {run.kind === "export-error" && (
        <div className="apx-export-error" role="alert">
          <p>書き出せませんでした。</p>
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
          <p className="apx-dialog-note">生成物は作成されていません。</p>
        </div>
      )}
      {run.kind === "export-warning" && (
        <div role="status">
          <p className="apx-dialog-note">
            生成物は作成されています。次のキーがサンプルデータに無かったため、
            テキストは空文字列・表は空行（minRows 分）で出力しました。
          </p>
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
