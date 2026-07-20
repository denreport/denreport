import type { MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useState } from "react";
import { useMessages } from "../../i18n/context";
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
import type { CellSelectionApi } from "../canvas/useCellSelection";
import type { CanvasMenuAction, CanvasMenuItem } from "./menu-items";
import { buildCanvasMenuItems, resolveContextTarget } from "./menu-items";

export interface ContextMenuState {
  readonly x: number;
  readonly y: number;
  /** Items fixed at the moment the menu opened (a snapshot at open time, since clipboard changes are not notified) */
  readonly items: readonly CanvasMenuItem[];
}

export function useCanvasContextMenu(
  store: EditorStore,
  /** Does not open while an operation such as dragging is in progress */
  interactionActive: boolean,
  /** The caller passes the focus-restore target (the paper) to return to after closing */
  restoreFocus: () => void,
  cell: CellSelectionApi,
): {
  readonly menu: ContextMenuState | null;
  readonly onContextMenu: (e: ReactMouseEvent<HTMLDivElement>) => void;
  readonly onAction: (action: CanvasMenuAction) => void;
  readonly onClose: () => void;
} {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const m = useMessages();

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
      const cellCtx =
        cell.selection !== null && targetId === cell.selection.tableId
          ? { canMerge: cell.canMerge, canUnmerge: cell.canUnmerge }
          : null;
      const items = buildCanvasMenuItems(m.contextMenu, {
        onElement: target.onElement,
        canCopy,
        hasSelection: selection.length > 0,
        hasClipboard: store.getClipboard() !== null,
        canGroup: canGroupSelection(selectedState),
        canUngroup: canUngroupSelection(selectedState),
        cell: cellCtx,
      });
      setMenu({ x: e.clientX, y: e.clientY, items });
    },
    [store, interactionActive, cell, m],
  );

  const onAction = useCallback(
    (action: CanvasMenuAction): void => {
      switch (action) {
        case "mergeCells":
          cell.merge();
          break;
        case "unmergeCells":
          cell.unmerge();
          break;
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
    [store, restoreFocus, cell],
  );

  const onClose = useCallback((): void => {
    setMenu(null);
    restoreFocus();
  }, [restoreFocus]);

  return { menu, onContextMenu, onAction, onClose };
}
