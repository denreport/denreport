import type { CompatTargetId } from "@denreport/core";
import { COMPAT_MATRICES } from "@denreport/core";
import type { ReactNode } from "react";
import type { DesignerChrome } from "../../api/designer";
import { useMessages } from "../../i18n/context";
import { EXPORT_TARGET_IDS } from "../../state/export-warnings";
import type { EditorStore } from "../../state/store";
import { useEditorState } from "../useEditorState";
import { BrandLogo } from "./BrandLogo";
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
  const m = useMessages();
  const isDark = chrome.resolvedTheme === "dark";
  return (
    <header className="apx-toolbar">
      <button
        type="button"
        className="apx-tbtn"
        aria-label={m.toolbar.togglePanelLeft}
        aria-expanded={sidebarOpen}
        title={m.toolbar.elementsPanel}
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
          <BrandLogo />
        </span>
        <span className="apx-brand-name">{m.toolbar.brandName}</span>
      </div>
      <span className="apx-toolbar-sep" />
      <span
        className={`apx-doc-dirty${state.dirty ? " is-on" : ""}`}
        title={state.dirty ? m.toolbar.unsavedChanges : undefined}
      />
      <span className="apx-toolbar-sep" />
      <button
        type="button"
        className="apx-tbtn"
        aria-label={m.toolbar.undo}
        disabled={!store.canUndo()}
        onClick={() => store.undo()}
      >
        ↶
      </button>
      <button
        type="button"
        className="apx-tbtn"
        aria-label={m.toolbar.redo}
        disabled={!store.canRedo()}
        onClick={() => store.redo()}
      >
        ↷
      </button>
      <span className="apx-toolbar-sep" />
      <fieldset className="apx-seg" aria-label={m.toolbar.canvasMode}>
        <button
          type="button"
          className={
            state.view.canvasMode === "select" ? "is-active" : undefined
          }
          title={m.toolbar.selectTitle}
          onClick={() => store.setView({ canvasMode: "select" })}
        >
          {m.toolbar.select}
        </button>
        <button
          type="button"
          className={state.view.canvasMode === "pan" ? "is-active" : undefined}
          title={m.toolbar.panTitle}
          onClick={() => store.setView({ canvasMode: "pan" })}
        >
          {m.toolbar.pan}
        </button>
      </fieldset>
      <span className="apx-toolbar-spacer" />
      <button
        type="button"
        className={`apx-tbtn${isDark ? " is-on" : ""}`}
        aria-pressed={isDark}
        aria-label={m.toolbar.theme}
        title={m.toolbar.themeTitle(isDark)}
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
        aria-label={m.toolbar.locale}
        title={m.toolbar.localeTitle}
        onClick={chrome.toggleLocale}
      >
        {chrome.locale === "ja" ? "JA" : "EN"}
      </button>
      <button
        type="button"
        className="apx-tbtn"
        aria-label={m.toolbar.shortcuts}
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
        {m.toolbar.save}
      </button>
      <button
        type="button"
        className="apx-btn apx-btn-secondary"
        onClick={onManageStyles}
      >
        {m.toolbar.manageStyles}
      </button>
      <button
        type="button"
        className="apx-btn apx-btn-secondary"
        onClick={onPreview}
      >
        {m.toolbar.preview}
      </button>
      <span className="apx-field">
        <select
          aria-label={m.toolbar.exportTarget}
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
        {m.toolbar.export}
      </button>
      <button
        type="button"
        className="apx-tbtn"
        aria-label={m.toolbar.togglePanelRight}
        aria-expanded={propsOpen}
        title={m.toolbar.propertiesPanel}
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
