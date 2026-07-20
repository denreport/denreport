import type { IrElementType } from "@denreport/core";
import type { PointerEvent as ReactPointerEvent, RefCallback } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MM_TO_PX, SNAP_TOLERANCE_PX } from "../../state/constants";
import type { PlacedElementView } from "../../state/geometry";
import { layoutDocument } from "../../state/geometry";
import type { EditorStore } from "../../state/store";
import type { EditorState } from "../../state/types";
import type {
  HandleId,
  InteractionContext,
  InteractionEvent,
  InteractionState,
  MmPoint,
} from "./interaction";
import { reduceInteraction } from "./interaction";

export interface PaperProps {
  readonly ref: RefCallback<HTMLDivElement>;
  readonly onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerLeave: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

export interface CanvasInteraction {
  readonly interaction: InteractionState;
  readonly cursorMm: MmPoint | null;
  readonly beginPlacement: (type: IrElementType, e: PointerEvent) => void;
  readonly paperProps: PaperProps;
}

const IDLE: InteractionState = { kind: "idle" };

export function useCanvasInteraction(store: EditorStore): CanvasInteraction {
  const [interaction, setInteraction] = useState<InteractionState>(IDLE);
  const [cursorMm, setCursorMm] = useState<MmPoint | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<InteractionState>(IDLE);
  const layoutCache = useRef<{
    state: EditorState | null;
    layout: readonly PlacedElementView[];
  }>({ state: null, layout: [] });
  const placementCleanup = useRef<(() => void) | null>(null);

  const toMm = useCallback(
    (e: {
      readonly clientX: number;
      readonly clientY: number;
    }): MmPoint | null => {
      const paper = paperRef.current;
      if (paper === null) {
        return null;
      }
      const rect = paper.getBoundingClientRect();
      const scale = MM_TO_PX * store.getState().view.zoom;
      return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
      };
    },
    [store],
  );

  const dispatch = useCallback(
    (event: InteractionEvent): void => {
      const editorState = store.getState();
      const cache = layoutCache.current;
      if (cache.state !== editorState) {
        layoutCache.current = {
          state: editorState,
          layout: layoutDocument(
            editorState.document,
            editorState.view.pageContext,
          ),
        };
      }
      const ctx: InteractionContext = {
        state: editorState,
        layout: layoutCache.current.layout,
        toleranceMm: SNAP_TOLERANCE_PX / (MM_TO_PX * editorState.view.zoom),
      };
      const result = reduceInteraction(interactionRef.current, event, ctx);
      interactionRef.current = result.state;
      setInteraction(result.state);
      if (result.effect !== null) {
        if (result.effect.document !== undefined) {
          store.commit(result.effect.document, result.effect.selection);
        } else if (result.effect.selection !== undefined) {
          store.setSelection(result.effect.selection);
        }
      }
    },
    [store],
  );

  // Esc cancels during a drag (effective regardless of focus position while pointer capture is active)
  useEffect(() => {
    if (interaction.kind === "idle") {
      return;
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.stopPropagation();
        placementCleanup.current?.();
        placementCleanup.current = null;
        dispatch({ kind: "cancel" });
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [interaction.kind, dispatch]);

  useEffect(() => {
    return () => {
      placementCleanup.current?.();
    };
  }, []);

  const beginPlacement = useCallback(
    (type: IrElementType, e: PointerEvent): void => {
      e.preventDefault();
      placementCleanup.current?.();
      dispatch({ kind: "paletteDown", elementType: type, at: toMm(e) });

      const onMove = (ev: PointerEvent): void => {
        const at = toMm(ev);
        if (at !== null) {
          setCursorMm(at);
          dispatch({ kind: "pointerMove", at, shiftKey: ev.shiftKey });
        }
      };
      const onUp = (ev: PointerEvent): void => {
        cleanup();
        const at = toMm(ev);
        if (at === null) {
          dispatch({ kind: "cancel" });
        } else {
          dispatch({ kind: "pointerUp", at });
        }
      };
      const onCancel = (): void => {
        cleanup();
        dispatch({ kind: "cancel" });
      };
      function cleanup(): void {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        placementCleanup.current = null;
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      placementCleanup.current = cleanup;
    },
    [dispatch, toMm],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>): void => {
      if (e.button !== 0) {
        return;
      }
      // Canceling pointerdown also suppresses the compatibility mousedown, stopping every start of text selection
      e.preventDefault();
      e.currentTarget.focus({ preventScroll: true });
      const at = toMm(e);
      if (at === null) {
        return;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      const target = e.target instanceof Element ? e.target : null;
      const handleEl = target?.closest("[data-apx-handle]") ?? null;
      const idEl = target?.closest("[data-apx-id]") ?? null;
      dispatch({
        kind: "pointerDown",
        at,
        targetId: idEl?.getAttribute("data-apx-id") ?? null,
        handle:
          (handleEl?.getAttribute("data-apx-handle") as HandleId | null) ??
          null,
        shiftKey: e.shiftKey,
      });
    },
    [dispatch, toMm],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>): void => {
      const at = toMm(e);
      if (at === null) {
        return;
      }
      setCursorMm(at);
      if (interactionRef.current.kind !== "idle") {
        dispatch({ kind: "pointerMove", at, shiftKey: e.shiftKey });
      }
    },
    [dispatch, toMm],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>): void => {
      const at = toMm(e);
      if (at === null || interactionRef.current.kind === "idle") {
        return;
      }
      dispatch({ kind: "pointerUp", at });
    },
    [dispatch, toMm],
  );

  const onPointerCancel = useCallback((): void => {
    if (interactionRef.current.kind !== "idle") {
      dispatch({ kind: "cancel" });
    }
  }, [dispatch]);

  const onPointerLeave = useCallback((): void => {
    setCursorMm(null);
  }, []);

  const setPaperRef = useCallback((el: HTMLDivElement | null): void => {
    paperRef.current = el;
  }, []);

  return {
    interaction,
    cursorMm,
    beginPlacement,
    paperProps: {
      ref: setPaperRef,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onPointerLeave,
    },
  };
}
