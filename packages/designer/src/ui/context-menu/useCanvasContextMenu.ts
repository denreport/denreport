import type { MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useState } from "react";
import { clipboardFromSelection } from "../../state/clipboard";
import {
  canGroupSelection,
  canUngroupSelection,
  copySelection,
  cutSelection,
  deleteSelection,
  duplicateSelection,
  groupSelection,
  pasteClipboard,
  ungroupSelection,
} from "../../state/commands";
import { expandIdsToGroups } from "../../state/groups";
import type { EditorStore } from "../../state/store";
import type { CanvasMenuAction, CanvasMenuItem } from "./menu-items";
import { buildCanvasMenuItems, resolveContextTarget } from "./menu-items";

export interface ContextMenuState {
  readonly x: number;
  readonly y: number;
  /** 開いた時点で確定した項目（クリップボードは通知されないため開時スナップショット） */
  readonly items: readonly CanvasMenuItem[];
}

export function useCanvasContextMenu(
  store: EditorStore,
  /** ドラッグ等の操作中は開かない */
  interactionActive: boolean,
  /** 閉じた後のフォーカス戻し先（紙面）を呼び出し元が渡す */
  restoreFocus: () => void,
): {
  readonly menu: ContextMenuState | null;
  readonly onContextMenu: (e: ReactMouseEvent<HTMLDivElement>) => void;
  readonly onAction: (action: CanvasMenuAction) => void;
  readonly onClose: () => void;
} {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  const onContextMenu = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>): void => {
      e.preventDefault();
      if (interactionActive) {
        return;
      }
      const state = store.getState();
      const el = e.target instanceof Element ? e.target : null;
      const targetId =
        el?.closest("[data-apx-id]")?.getAttribute("data-apx-id") ?? null;
      const target = resolveContextTarget(state.selection, targetId);
      const selection = expandIdsToGroups(
        state.groups,
        state.document,
        target.selection,
      );
      if (selection !== state.selection) {
        store.setSelection(selection);
      }
      const canCopy =
        clipboardFromSelection(state.document, selection, state.groups) !==
        null;
      const selectedState = { ...state, selection };
      const items = buildCanvasMenuItems({
        onElement: target.onElement,
        canCopy,
        hasSelection: selection.length > 0,
        hasClipboard: store.getClipboard() !== null,
        canGroup: canGroupSelection(selectedState),
        canUngroup: canUngroupSelection(selectedState),
      });
      setMenu({ x: e.clientX, y: e.clientY, items });
    },
    [store, interactionActive],
  );

  const onAction = useCallback(
    (action: CanvasMenuAction): void => {
      switch (action) {
        case "copy":
          copySelection(store);
          break;
        case "cut":
          cutSelection(store);
          break;
        case "paste":
          pasteClipboard(store);
          break;
        case "duplicate":
          duplicateSelection(store);
          break;
        case "group":
          groupSelection(store);
          break;
        case "ungroup":
          ungroupSelection(store);
          break;
        case "delete":
          deleteSelection(store);
          break;
      }
      setMenu(null);
      restoreFocus();
    },
    [store, restoreFocus],
  );

  const onClose = useCallback((): void => {
    setMenu(null);
    restoreFocus();
  }, [restoreFocus]);

  return { menu, onContextMenu, onAction, onClose };
}
