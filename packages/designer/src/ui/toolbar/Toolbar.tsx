import type { CompatTargetId } from "@denreport/core";
import { COMPAT_MATRICES } from "@denreport/core";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import type { DesignerChrome } from "../../api/designer";
import { useMessages } from "../../i18n/context";
import { EXPORT_TARGET_IDS } from "../../state/export-warnings";
import type { EditorStore } from "../../state/store";
import { useEditorState } from "../useEditorState";
import { BrandLogo } from "./BrandLogo";
import { OpenIrButton } from "./OpenIrButton";
import type { ToolbarMenuItem } from "./ToolbarMenu";
import { ToolbarMenu } from "./ToolbarMenu";

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
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const [moreMenu, setMoreMenu] = useState<{
    readonly x: number;
    readonly y: number;
  } | null>(null);
  const closeMoreMenu = (): void => {
    setMoreMenu(null);
    moreButtonRef.current?.focus();
  };
  const moreMenuItems: readonly ToolbarMenuItem[] = [
    {
      id: "theme",
      label: m.toolbar.themeTitle(isDark),
      onSelect: chrome.toggleTheme,
    },
    {
      id: "locale",
      label: m.toolbar.localeTitle,
      onSelect: chrome.toggleLocale,
    },
    { id: "shortcuts", label: m.toolbar.shortcuts, onSelect: onShowShortcuts },
  ];
  return (
    <header className="dr-toolbar">
      <button
        type="button"
        className="dr-tbtn"
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
      <div className="dr-brand">
        <span className="dr-brand-mark" aria-hidden="true">
          <BrandLogo />
        </span>
        <span className="dr-brand-name">{m.toolbar.brandName}</span>
      </div>
      <span className="dr-toolbar-sep" />
      <span
        className={`dr-doc-dirty${state.dirty ? " is-on" : ""}`}
        title={state.dirty ? m.toolbar.unsavedChanges : undefined}
      />
      <span className="dr-toolbar-sep" />
      <button
        type="button"
        className="dr-tbtn"
        aria-label={m.toolbar.undo}
        disabled={!store.canUndo()}
        onClick={() => store.undo()}
      >
        ↶
      </button>
      <button
        type="button"
        className="dr-tbtn"
        aria-label={m.toolbar.redo}
        disabled={!store.canRedo()}
        onClick={() => store.redo()}
      >
        ↷
      </button>
      <span className="dr-toolbar-sep" />
      <fieldset className="dr-seg" aria-label={m.toolbar.canvasMode}>
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
      <span className="dr-toolbar-spacer" />
      <button
        ref={moreButtonRef}
        type="button"
        className="dr-tbtn"
        aria-label={m.toolbar.moreOptions}
        aria-haspopup="menu"
        aria-expanded={moreMenu !== null}
        onClick={() => {
          if (moreMenu !== null) {
            closeMoreMenu();
            return;
          }
          const rect = moreButtonRef.current?.getBoundingClientRect();
          if (rect === undefined) {
            return;
          }
          setMoreMenu({ x: rect.left, y: rect.bottom + 4 });
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="3.5" cy="8" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="12.5" cy="8" r="1.4" />
        </svg>
      </button>
      {moreMenu !== null && (
        <ToolbarMenu
          x={moreMenu.x}
          y={moreMenu.y}
          items={moreMenuItems}
          onClose={closeMoreMenu}
        />
      )}
      <span className="dr-toolbar-sep" />
      <OpenIrButton dirty={state.dirty} importIr={chrome.importIr} />
      <button
        type="button"
        className="dr-btn dr-btn-secondary"
        onClick={chrome.requestSave}
      >
        {m.toolbar.save}
      </button>
      <button
        type="button"
        className="dr-btn dr-btn-secondary"
        onClick={onManageStyles}
      >
        {m.toolbar.manageStyles}
      </button>
      <button
        type="button"
        className="dr-btn dr-btn-secondary"
        onClick={onPreview}
      >
        {m.toolbar.preview}
      </button>
      <span className="dr-field">
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
        className="dr-btn dr-btn-primary"
        onClick={onExport}
      >
        {m.toolbar.export}
      </button>
      <button
        type="button"
        className="dr-tbtn"
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
