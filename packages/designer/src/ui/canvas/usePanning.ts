import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasMode } from "../../state/types";
import { isPanKeySource, panScrollTarget } from "./panning";

export interface PanningState {
  /** 実効モードが pan（canvasMode === "pan" または Space 押下中） */
  readonly panMode: boolean;
  /** パンドラッグ中 */
  readonly panning: boolean;
  readonly onViewportPointerDown: (
    e: ReactPointerEvent<HTMLDivElement>,
  ) => void;
}

export function usePanning(
  viewportRef: RefObject<HTMLDivElement | null>,
  mode: CanvasMode,
  interactionActive: boolean,
): PanningState {
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const interactionActiveRef = useRef(interactionActive);
  interactionActiveRef.current = interactionActive;
  const dragCleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== " " || e.repeat) {
        return;
      }
      if (interactionActiveRef.current || !isPanKeySource(e.target)) {
        return;
      }
      e.preventDefault();
      setSpaceDown(true);
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.key === " ") {
        setSpaceDown(false);
      }
    };
    const onBlur = (): void => {
      setSpaceDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    return () => {
      dragCleanup.current?.();
    };
  }, []);

  const panMode = spaceDown || mode === "pan";

  const onViewportPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>): void => {
      if (!panMode || e.button !== 0) {
        return;
      }
      const viewport = viewportRef.current;
      if (viewport === null) {
        return;
      }
      const origin = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        scrollLeft: viewport.scrollLeft,
        scrollTop: viewport.scrollTop,
      };
      setPanning(true);
      const onMove = (ev: PointerEvent): void => {
        const target = panScrollTarget(origin, ev.clientX, ev.clientY);
        viewport.scrollLeft = target.left;
        viewport.scrollTop = target.top;
      };
      const onUp = (): void => {
        cleanup();
      };
      function cleanup(): void {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        dragCleanup.current = null;
        setPanning(false);
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      dragCleanup.current = cleanup;
    },
    [panMode, viewportRef],
  );

  return { panMode, panning, onViewportPointerDown };
}
