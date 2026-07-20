import type { IrElementType } from "@denreport/core";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { DesignerChrome } from "../api/designer";
import { LocaleContext, MessagesContext } from "../i18n/context";
import type { Locale } from "../i18n/locale";
import { getMessages } from "../i18n/messages";
import { createCenteredElement } from "../state/defaults";
import { addElement } from "../state/elements";
import type { EditorStore } from "../state/store";
import { Canvas } from "./canvas/Canvas";
import { CanvasBar } from "./canvas/CanvasBar";
import { useCanvasInteraction } from "./canvas/useCanvasInteraction";
import type { EditingKeyCommands } from "./canvas/useKeyboardEditing";
import { useKeyboardEditing } from "./canvas/useKeyboardEditing";
import { ValidationDrawer } from "./drawer/ValidationDrawer";
import { ExportDialog } from "./export/ExportDialog";
import { ShortcutsDialog } from "./help/ShortcutsDialog";
import { PreviewDialog } from "./preview/PreviewDialog";
import { PropertiesPanel } from "./properties/PropertiesPanel";
import { Sidebar } from "./sidebar/Sidebar";
import { StatusBar } from "./statusbar/StatusBar";
import { StylesDialog } from "./styles/StylesDialog";
import { Toolbar } from "./toolbar/Toolbar";

export function DesignerRoot(props: {
  readonly store: EditorStore;
  readonly chrome: DesignerChrome;
  readonly locale: Locale;
}): ReactNode {
  const { store, chrome, locale } = props;
  const messages = getMessages(locale);
  const interaction = useCanvasInteraction(store);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  // So the shortcut list still receives shortcuts right after closing, return focus to layout on close
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const onCloseShortcuts = useCallback((): void => {
    setShortcutsOpen(false);
    layoutRef.current?.focus();
  }, []);
  const editingCommands = useMemo<EditingKeyCommands>(
    () => ({
      requestSave: chrome.requestSave,
      openShortcutHelp: () => setShortcutsOpen(true),
    }),
    [chrome.requestSave],
  );
  const onKeyDown = useKeyboardEditing(
    store,
    interaction.interaction,
    editingCommands,
  );
  // A reveal request is a transient UI command, so keep it out of the store and wire it to Canvas via a ref
  const revealRef = useRef<((id: string) => void) | null>(null);
  const onReveal = useCallback((id: string): void => {
    revealRef.current?.(id);
  }, []);
  // Preview open/close isn't editing state, so keep it out of the store
  const [previewOpen, setPreviewOpen] = useState(false);
  const onPreview = useCallback((): void => {
    setPreviewOpen(true);
  }, []);
  const onClosePreview = useCallback((): void => {
    setPreviewOpen(false);
  }, []);
  // Export open/close, like preview, isn't editing state either
  const [exportOpen, setExportOpen] = useState(false);
  const onExport = useCallback((): void => {
    setExportOpen(true);
  }, []);
  const onCloseExport = useCallback((): void => {
    setExportOpen(false);
  }, []);
  // Style management open/close isn't editing state either
  const [stylesOpen, setStylesOpen] = useState(false);
  const onManageStyles = useCallback((): void => {
    setStylesOpen(true);
  }, []);
  const onCloseStyles = useCallback((): void => {
    setStylesOpen(false);
  }, []);
  // Panel open/close isn't editing state either, so keep it out of the store
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [propsOpen, setPropsOpen] = useState(true);
  const onToggleSidebar = useCallback((): void => {
    setSidebarOpen((prev) => !prev);
  }, []);
  const onToggleProps = useCallback((): void => {
    setPropsOpen((prev) => !prev);
  }, []);
  const onQuickAdd = useCallback(
    (type: IrElementType): void => {
      const document = store.getState().document;
      const element = createCenteredElement(document, type);
      store.commit(addElement(document, element), [element.id]);
      // The button's pointerdown calls preventDefault, so a click never moves focus off
      // body — explicitly move it somewhere that can receive undo etc.
      layoutRef.current?.focus();
    },
    [store],
  );
  return (
    <MessagesContext.Provider value={messages}>
      <LocaleContext.Provider value={locale}>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: key handling is bundled at the root; form elements are ignored */}
        <div
          className={
            "dr-layout" +
            (sidebarOpen ? "" : " is-left-closed") +
            (propsOpen ? "" : " is-right-closed")
          }
          ref={layoutRef}
          tabIndex={-1}
          onKeyDown={onKeyDown}
        >
          <Toolbar
            store={store}
            chrome={chrome}
            onPreview={onPreview}
            onExport={onExport}
            onManageStyles={onManageStyles}
            onShowShortcuts={() => setShortcutsOpen(true)}
            sidebarOpen={sidebarOpen}
            propsOpen={propsOpen}
            onToggleSidebar={onToggleSidebar}
            onToggleProps={onToggleProps}
          />
          <Sidebar
            store={store}
            beginPlacement={interaction.beginPlacement}
            onQuickAdd={onQuickAdd}
            onReveal={onReveal}
          />
          <main className="dr-canvas-area">
            <CanvasBar store={store} />
            <Canvas
              store={store}
              interaction={interaction}
              revealRef={revealRef}
            />
            <ValidationDrawer store={store} onReveal={onReveal} />
            <StatusBar store={store} cursorMm={interaction.cursorMm} />
          </main>
          <PropertiesPanel
            store={store}
            interaction={interaction.interaction}
          />
          {previewOpen && (
            <PreviewDialog store={store} onClose={onClosePreview} />
          )}
          {exportOpen && (
            <ExportDialog
              store={store}
              onClose={onCloseExport}
              onReveal={onReveal}
            />
          )}
          {stylesOpen && <StylesDialog store={store} onClose={onCloseStyles} />}
          {shortcutsOpen && <ShortcutsDialog onClose={onCloseShortcuts} />}
        </div>
      </LocaleContext.Provider>
    </MessagesContext.Provider>
  );
}
