import type { IrDocument, IrTableElement } from "@denreport/core";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MM_TO_PX } from "../../state/constants";
import type { MmBox, PlacedElementView } from "../../state/geometry";
import {
  appendTableCellSpan,
  removeTableCellSpansAt,
} from "../../state/properties";
import type { EditorStore } from "../../state/store";
import type { TableCellRect } from "../../state/table-cells";
import {
  canMergeCellRect,
  cellSpanForRect,
  spanIndicesIntersecting,
} from "../../state/table-cells";
import { useEditorState } from "../useEditorState";
import type { CellAddress } from "./cell-selection";
import { cellAtPoint, cellRectBox, cellRectFrom } from "./cell-selection";
import type { MmPoint } from "./interaction";
import { isFormTarget } from "./useKeyboardEditing";

export interface CellSelectionState {
  readonly tableId: string;
  readonly rect: TableCellRect;
}

export interface CellSelectionApi {
  readonly selection: CellSelectionState | null;
  readonly selectionBox: MmBox | null;
  readonly canMerge: boolean;
  readonly canUnmerge: boolean;
  readonly merge: () => void;
  readonly unmerge: () => void;
  /** true = the event was consumed (the caller does not pass it on to element interaction) */
  readonly onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => boolean;
  readonly onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerUp: () => void;
  readonly onPointerCancel: () => void;
}

function toMm(
  store: EditorStore,
  e: {
    readonly currentTarget: HTMLElement;
    readonly clientX: number;
    readonly clientY: number;
  },
): MmPoint {
  const rect = e.currentTarget.getBoundingClientRect();
  const scale = MM_TO_PX * store.getState().view.zoom;
  return {
    x: (e.clientX - rect.left) / scale,
    y: (e.clientY - rect.top) / scale,
  };
}

function anchorOf(rect: TableCellRect): CellAddress {
  return rect.header
    ? { row: "header", col: rect.colStart }
    : { row: rect.rowStart, col: rect.colStart };
}

function findTable(document: IrDocument, id: string): IrTableElement | null {
  const el = document.elements.find((element) => element.id === id);
  return el !== undefined && el.type === "table" ? el : null;
}

/** Per-table cell rectangle selection. Canvas-local state, independent of EditorStore's selection (which is per-element) */
export function useCellSelection(
  store: EditorStore,
  layout: readonly PlacedElementView[],
): CellSelectionApi {
  const state = useEditorState(store);
  const [selection, setSelection] = useState<CellSelectionState | null>(null);
  const dragRef = useRef<{ tableId: string; anchor: CellAddress } | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: not referenced inside the effect, but a change in doc/pageContext itself is the discard condition
  useEffect(() => {
    setSelection(null);
    dragRef.current = null;
  }, [state.document, state.view.pageContext]);

  useEffect(() => {
    if (
      selection !== null &&
      (state.selection.length !== 1 || state.selection[0] !== selection.tableId)
    ) {
      setSelection(null);
    }
  }, [state.selection, selection]);

  useEffect(() => {
    if (selection === null) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !isFormTarget(e.target)) {
        e.stopPropagation();
        e.preventDefault();
        setSelection(null);
        dragRef.current = null;
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [selection]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>): boolean => {
      if (e.button !== 0) {
        return false;
      }
      const s = store.getState();
      if (s.view.pageContext !== "first") {
        return false;
      }
      const target = e.target instanceof Element ? e.target : null;
      if (target !== null && target.closest("[data-dr-handle]") !== null) {
        return false;
      }
      const id =
        target?.closest("[data-dr-id]")?.getAttribute("data-dr-id") ?? null;
      if (id === null || s.selection.length !== 1 || s.selection[0] !== id) {
        return false;
      }
      const view = layout.find((v) => v.id === id);
      if (view === undefined || view.element.type !== "table") {
        return false;
      }
      const cell = cellAtPoint(view.element, view.box, toMm(store, e));
      if (cell === null) {
        return false;
      }
      e.preventDefault();
      e.currentTarget.focus({ preventScroll: true });
      e.currentTarget.setPointerCapture(e.pointerId);
      const anchor =
        e.shiftKey && selection !== null && selection.tableId === id
          ? anchorOf(selection.rect)
          : cell;
      dragRef.current = { tableId: id, anchor };
      setSelection({ tableId: id, rect: cellRectFrom(anchor, cell) });
      return true;
    },
    [layout, selection, store],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>): void => {
      const drag = dragRef.current;
      if (drag === null) {
        return;
      }
      const view = layout.find((v) => v.id === drag.tableId);
      if (view === undefined || view.element.type !== "table") {
        return;
      }
      const at = toMm(store, e);
      const clamped: MmPoint = {
        x: Math.min(Math.max(at.x, view.box.x), view.box.x + view.box.w),
        y: Math.min(Math.max(at.y, view.box.y), view.box.y + view.box.h),
      };
      const focus = cellAtPoint(view.element, view.box, clamped);
      if (focus === null) {
        return;
      }
      setSelection({
        tableId: drag.tableId,
        rect: cellRectFrom(drag.anchor, focus),
      });
    },
    [layout, store],
  );

  const onPointerUp = useCallback((): void => {
    dragRef.current = null;
  }, []);

  const onPointerCancel = useCallback((): void => {
    dragRef.current = null;
  }, []);

  const selectionBox = useMemo((): MmBox | null => {
    if (selection === null) {
      return null;
    }
    const view = layout.find((v) => v.id === selection.tableId);
    if (view === undefined || view.element.type !== "table") {
      return null;
    }
    return cellRectBox(view.element, view.box, selection.rect);
  }, [selection, layout]);

  const canMerge = useMemo((): boolean => {
    if (selection === null) {
      return false;
    }
    const table = findTable(state.document, selection.tableId);
    return table !== null && canMergeCellRect(table, selection.rect);
  }, [selection, state.document]);

  const canUnmerge = useMemo((): boolean => {
    if (selection === null) {
      return false;
    }
    const table = findTable(state.document, selection.tableId);
    return (
      table !== null &&
      spanIndicesIntersecting(table, selection.rect).length > 0
    );
  }, [selection, state.document]);

  const merge = useCallback((): void => {
    if (selection === null) {
      return;
    }
    const document = store.getState().document;
    const table = findTable(document, selection.tableId);
    if (table === null || !canMergeCellRect(table, selection.rect)) {
      return;
    }
    const span = cellSpanForRect(table, selection.rect);
    if (span === null) {
      return;
    }
    store.commit(appendTableCellSpan(document, selection.tableId, span));
  }, [selection, store]);

  const unmerge = useCallback((): void => {
    if (selection === null) {
      return;
    }
    const document = store.getState().document;
    const table = findTable(document, selection.tableId);
    if (table === null) {
      return;
    }
    const indices = spanIndicesIntersecting(table, selection.rect);
    if (indices.length === 0) {
      return;
    }
    store.commit(removeTableCellSpansAt(document, selection.tableId, indices));
  }, [selection, store]);

  return {
    selection,
    selectionBox,
    canMerge,
    canUnmerge,
    merge,
    unmerge,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
