import type { CompatTargetId } from "@denreport/core";
import { COMPAT_MATRICES } from "@denreport/core";
import type { ReactNode } from "react";
import type { DesignerChrome } from "../../api/designer";
import { EXPORT_TARGET_IDS } from "../../state/export-warnings";
import type { EditorStore } from "../../state/store";
import { useEditorState } from "../useEditorState";
import { OpenIrButton } from "./OpenIrButton";

export function Toolbar(props: {
  readonly store: EditorStore;
  readonly chrome: DesignerChrome;
  readonly onPreview: () => void;
  readonly onExport: () => void;
  readonly onManageStyles: () => void;
  readonly onShowShortcuts: () => void;
  readonly sidebarOpen: boolean;
  readonly propsOpen: boolean;
  readonly onToggleSidebar: () => void;
  readonly onToggleProps: () => void;
}): ReactNode {
  const {
    store,
    chrome,
    onPreview,
    onExport,
    onManageStyles,
    onShowShortcuts,
    sidebarOpen,
    propsOpen,
    onToggleSidebar,
    onToggleProps,
  } = props;
  const state = useEditorState(store);
  const isDark = chrome.resolvedTheme === "dark";
  return (
    <header className="apx-toolbar">
      <button
        type="button"
        className="apx-tbtn"
        aria-label="左パネルを開閉"
        aria-expanded={sidebarOpen}
        title="要素・レイヤー"
        onClick={onToggleSidebar}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <rect x="1.5" y="2.5" width="13" height="11" strokeWidth="1.3" />
          <path strokeWidth="1.3" d="M6 2.5v11" />
        </svg>
      </button>
      <div className="apx-brand">
        <span className="apx-brand-mark" aria-hidden="true">
          帳
        </span>
        <span className="apx-brand-name">帳票デザイナー</span>
      </div>
      <span className="apx-toolbar-sep" />
      <span
        className={`apx-doc-dirty${state.dirty ? " is-on" : ""}`}
        title={state.dirty ? "未保存の変更あり" : undefined}
      />
      <span className="apx-toolbar-sep" />
      <button
        type="button"
        className="apx-tbtn"
        aria-label="元に戻す"
        disabled={!store.canUndo()}
        onClick={() => store.undo()}
      >
        ↶
      </button>
      <button
        type="button"
        className="apx-tbtn"
        aria-label="やり直す"
        disabled={!store.canRedo()}
        onClick={() => store.redo()}
      >
        ↷
      </button>
      <span className="apx-toolbar-sep" />
      <fieldset className="apx-seg" aria-label="キャンバスモード">
        <button
          type="button"
          className={
            state.view.canvasMode === "select" ? "is-active" : undefined
          }
          title="選択 (V)"
          onClick={() => store.setView({ canvasMode: "select" })}
        >
          選択
        </button>
        <button
          type="button"
          className={state.view.canvasMode === "pan" ? "is-active" : undefined}
          title="移動 (H)"
          onClick={() => store.setView({ canvasMode: "pan" })}
        >
          移動
        </button>
      </fieldset>
      <span className="apx-toolbar-spacer" />
      <button
        type="button"
        className={`apx-tbtn${isDark ? " is-on" : ""}`}
        aria-pressed={isDark}
        aria-label="テーマ"
        title={
          isDark
            ? "テーマを切り替え（現在: ダーク）"
            : "テーマを切り替え（現在: ライト）"
        }
        onClick={chrome.toggleTheme}
      >
        {isDark ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
            focusable="false"
          >
            <path
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 9.7A6 6 0 0 1 6.3 2.5a6 6 0 1 0 7.2 7.2z"
            />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="8" cy="8" r="3" strokeWidth="1.3" />
            <path
              strokeWidth="1.3"
              strokeLinecap="round"
              d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1M12.9 12.9l-1.1-1.1M4.2 4.2 3.1 3.1"
            />
          </svg>
        )}
      </button>
      <button
        type="button"
        className="apx-tbtn"
        aria-label="ショートカット一覧"
        onClick={onShowShortcuts}
      >
        ?
      </button>
      <span className="apx-toolbar-sep" />
      <OpenIrButton dirty={state.dirty} importIr={chrome.importIr} />
      <button
        type="button"
        className="apx-btn apx-btn-secondary"
        onClick={chrome.requestSave}
      >
        保存
      </button>
      <button
        type="button"
        className="apx-btn apx-btn-secondary"
        onClick={onManageStyles}
      >
        スタイル
      </button>
      <button
        type="button"
        className="apx-btn apx-btn-secondary"
        onClick={onPreview}
      >
        プレビュー
      </button>
      <span className="apx-field">
        <select
          aria-label="書き出しターゲット"
          value={state.selectedExportTarget}
          onChange={(e) =>
            store.setSelectedExportTarget(
              e.currentTarget.value as CompatTargetId,
            )
          }
        >
          {EXPORT_TARGET_IDS.map((id) => (
            <option key={id} value={id}>
              {COMPAT_MATRICES[id].displayName}
            </option>
          ))}
        </select>
      </span>
      <button
        type="button"
        className="apx-btn apx-btn-primary"
        onClick={onExport}
      >
        書き出し
      </button>
      <button
        type="button"
        className="apx-tbtn"
        aria-label="右パネルを開閉"
        aria-expanded={propsOpen}
        title="プロパティ"
        onClick={onToggleProps}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <rect x="1.5" y="2.5" width="13" height="11" strokeWidth="1.3" />
          <path strokeWidth="1.3" d="M10 2.5v11" />
        </svg>
      </button>
    </header>
  );
}
