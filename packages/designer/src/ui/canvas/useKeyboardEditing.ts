import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback } from "react";
import {
  copySelection,
  cutSelection,
  deleteSelection,
  duplicateSelection,
  groupSelection,
  pasteClipboard,
  ungroupSelection,
} from "../../state/commands.js";
import { GRID_STEP_MM } from "../../state/constants.js";
import { moveElements, setTableContinuationY } from "../../state/elements.js";
import { layoutDocument } from "../../state/geometry.js";
import { gridArrowTarget } from "../../state/snapping.js";
import type { EditorStore } from "../../state/store.js";
import type { EditorState } from "../../state/types.js";
import type { InteractionState } from "./interaction.js";
import { zoomStepIn, zoomStepOut } from "./zoom.js";

export interface EditingKeyEvent {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly target: EventTarget | null;
}

/** Operations outside the store, invoked from key processing. Assembled by DesignerRoot */
export interface EditingKeyCommands {
  /** Ctrl/Cmd+S. Passes DesignerChrome.requestSave */
  readonly requestSave: () => void;
  /** "?" / F1. Opens the shortcut list dialog */
  readonly openShortcutHelp: () => void;
}

const ARROW_DIRECTIONS: Record<
  string,
  { readonly x: number; readonly y: number }
> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

export function isFormTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.matches("input, textarea, select") || target.isContentEditable)
  );
}

function topLevelIds(
  state: EditorState,
  ids: readonly string[],
): readonly string[] {
  const topLevel = new Set(state.document.elements.map((el) => el.id));
  return ids.filter((id) => topLevel.has(id));
}

/** In the rest/last context, vertical movement of a table is handled by continuationY (same semantics as dragging) */
function applyArrowMove(
  state: EditorState,
  ids: readonly string[],
  dx: number,
  dy: number,
) {
  let doc = state.document;
  if (state.view.pageContext === "first") {
    return moveElements(doc, ids, dx, dy);
  }
  const tables = doc.elements.filter(
    (el) => el.type === "table" && ids.includes(el.id),
  );
  const tableIds = new Set(tables.map((el) => el.id));
  doc = moveElements(
    doc,
    ids.filter((id) => !tableIds.has(id)),
    dx,
    dy,
  );
  for (const table of tables) {
    doc = moveElements(doc, [table.id], dx, 0);
    if (table.type === "table") {
      doc = setTableContinuationY(doc, table.id, table.continuationY + dy);
    }
  }
  return doc;
}

function arrowDelta(
  state: EditorState,
  ids: readonly string[],
  direction: { readonly x: number; readonly y: number },
  shiftKey: boolean,
): { readonly dx: number; readonly dy: number } {
  if (shiftKey) {
    return { dx: direction.x * 0.1, dy: direction.y * 0.1 };
  }
  if (!state.view.snapEnabled) {
    return { dx: direction.x, dy: direction.y };
  }
  // Quantize the top-left of the selection's bounding box to the next 5mm grid line and advance by one step
  const idSet = new Set(ids);
  const boxes = layoutDocument(state.document, state.view.pageContext)
    .filter((view) => idSet.has(view.id))
    .map((view) => view.box);
  if (boxes.length === 0) {
    return { dx: direction.x * GRID_STEP_MM, dy: direction.y * GRID_STEP_MM };
  }
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  if (direction.x !== 0) {
    const sign = direction.x > 0 ? 1 : -1;
    return { dx: gridArrowTarget(minX, sign) - minX, dy: 0 };
  }
  const sign = direction.y > 0 ? 1 : -1;
  return { dx: 0, dy: gridArrowTarget(minY, sign) - minY };
}

/**
 * The core of keyboard editing. Returns true when handled (the caller then calls preventDefault).
 * Escape while interactionActive is deferred to the drag side's cancel.
 */
export function applyEditingKey(
  store: EditorStore,
  interactionActive: boolean,
  commands: EditingKeyCommands,
  event: EditingKeyEvent,
): boolean {
  if (isFormTarget(event.target)) {
    return false;
  }
  const primary = event.ctrlKey || event.metaKey;
  const key = event.key;

  if (primary && key.toLowerCase() === "z") {
    if (event.shiftKey) {
      store.redo();
    } else {
      store.undo();
    }
    return true;
  }
  if (primary && key.toLowerCase() === "y") {
    store.redo();
    return true;
  }

  const state = store.getState();
  if (primary && key.toLowerCase() === "c") {
    return copySelection(store);
  }
  if (primary && key.toLowerCase() === "x") {
    return cutSelection(store);
  }
  if (primary && key.toLowerCase() === "v") {
    return pasteClipboard(store);
  }
  if (primary && key.toLowerCase() === "a") {
    const ids = state.document.elements.map((el) => el.id);
    if (ids.length === 0) {
      return false;
    }
    store.setSelection(ids);
    return true;
  }
  if (primary && key.toLowerCase() === "d") {
    return duplicateSelection(store);
  }
  if (primary && key.toLowerCase() === "g") {
    return event.shiftKey ? ungroupSelection(store) : groupSelection(store);
  }
  if (primary && key.toLowerCase() === "s") {
    commands.requestSave();
    return true;
  }
  if (primary && (key === "+" || key === "=")) {
    const zoom = zoomStepIn(state.view.zoom);
    if (zoom === null) {
      return false;
    }
    store.setView({ zoom });
    return true;
  }
  if (primary && key === "-") {
    const zoom = zoomStepOut(state.view.zoom);
    if (zoom === null) {
      return false;
    }
    store.setView({ zoom });
    return true;
  }
  if (!primary && (key === "?" || key === "F1")) {
    commands.openShortcutHelp();
    return true;
  }
  if (!primary && !event.shiftKey && key.toLowerCase() === "v") {
    if (interactionActive) {
      return false;
    }
    store.setView({ canvasMode: "select" });
    return true;
  }
  if (!primary && !event.shiftKey && key.toLowerCase() === "h") {
    if (interactionActive) {
      return false;
    }
    store.setView({ canvasMode: "pan" });
    return true;
  }
  if (key === "Escape") {
    if (!interactionActive && state.selection.length > 0) {
      store.setSelection([]);
      return true;
    }
    return false;
  }
  if (state.selection.length === 0) {
    return false;
  }
  if (key === "Delete" || key === "Backspace") {
    return deleteSelection(store);
  }
  const direction = ARROW_DIRECTIONS[key];
  if (direction !== undefined) {
    const ids = topLevelIds(state, state.selection);
    if (ids.length === 0) {
      return false;
    }
    const { dx, dy } = arrowDelta(state, ids, direction, event.shiftKey);
    store.commit(applyArrowMove(state, ids, dx, dy), state.selection);
    return true;
  }
  return false;
}

export function useKeyboardEditing(
  store: EditorStore,
  interaction: InteractionState,
  commands: EditingKeyCommands,
): (e: ReactKeyboardEvent<HTMLElement>) => void {
  const active = interaction.kind !== "idle";
  return useCallback(
    (e: ReactKeyboardEvent<HTMLElement>): void => {
      if (applyEditingKey(store, active, commands, e)) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [store, active, commands],
  );
}
