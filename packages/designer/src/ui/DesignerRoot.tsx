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
  const interaction = useCanvasInteraction(store, messages.defaults);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  // 一覧を閉じた直後もショートカットを受けられるよう、閉じたら layout へフォーカスを戻す
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
  // スクロール要求は一過性の UI 命令なので store に入れず ref で Canvas と結ぶ
  const revealRef = useRef<((id: string) => void) | null>(null);
  const onReveal = useCallback((id: string): void => {
    revealRef.current?.(id);
  }, []);
  // プレビューの開閉は編集状態ではないため store に入れない
  const [previewOpen, setPreviewOpen] = useState(false);
  const onPreview = useCallback((): void => {
    setPreviewOpen(true);
  }, []);
  const onClosePreview = useCallback((): void => {
    setPreviewOpen(false);
  }, []);
  // 書き出しの開閉もプレビューと同じく編集状態ではない
  const [exportOpen, setExportOpen] = useState(false);
  const onExport = useCallback((): void => {
    setExportOpen(true);
  }, []);
  const onCloseExport = useCallback((): void => {
    setExportOpen(false);
  }, []);
  // スタイル管理の開閉も編集状態ではない
  const [stylesOpen, setStylesOpen] = useState(false);
  const onManageStyles = useCallback((): void => {
    setStylesOpen(true);
  }, []);
  const onCloseStyles = useCallback((): void => {
    setStylesOpen(false);
  }, []);
  // パネルの開閉も編集状態ではないため store に入れない
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
      const element = createCenteredElement(document, type, messages.defaults);
      store.commit(addElement(document, element), [element.id]);
      // ボタンの pointerdown が preventDefault されておりクリックでは
      // フォーカスが body から動かないため、undo 等を受けられる位置へ明示的に移す
      layoutRef.current?.focus();
    },
    [store, messages],
  );
  return (
    <MessagesContext.Provider value={messages}>
      <LocaleContext.Provider value={locale}>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: キー操作はルートで束ね、フォーム要素は無視する */}
        <div
          className={
            "apx-layout" +
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
          <main className="apx-canvas-area">
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
