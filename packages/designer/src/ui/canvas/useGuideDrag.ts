import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MM_TO_PX } from "../../state/constants.js";
import { addGuide, moveGuide, removeGuide } from "../../state/guides.js";
import type { EditorStore } from "../../state/store.js";
import type { PaperGeometry } from "./guide-drag.js";
import { isOnPage, pointerToGuidePositionMm } from "./guide-drag.js";

export interface GuideDragApi {
  /** ruler axis "h" (top ruler) → horizontal guide (axis "y"), "v" (left ruler) → vertical guide (axis "x") */
  startFromRuler(rulerAxis: "h" | "v", e: ReactPointerEvent): void;
  startFromGuide(id: string, axis: "x" | "y", e: ReactPointerEvent): void;
  readonly draggingId: string | null;
}

export function useGuideDrag(
  store: EditorStore,
  viewportRef: RefObject<HTMLDivElement | null>,
): GuideDragApi {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const geometry = useCallback((): PaperGeometry | null => {
    const paper = viewportRef.current?.querySelector(".dr-paper");
    if (!(paper instanceof HTMLElement)) {
      return null;
    }
    const rect = paper.getBoundingClientRect();
    return {
      paperLeftPx: rect.left,
      paperTopPx: rect.top,
      mmPx: MM_TO_PX * store.getState().view.zoom,
    };
  }, [store, viewportRef]);

  const begin = useCallback(
    (axis: "x" | "y", initialId: string | null, e: ReactPointerEvent): void => {
      e.preventDefault();
      cleanupRef.current?.();
      let guideId = initialId;
      setDraggingId(guideId);

      const onMove = (ev: PointerEvent): void => {
        const geo = geometry();
        if (geo === null) {
          return;
        }
        const positionMm = pointerToGuidePositionMm(
          axis,
          ev.clientX,
          ev.clientY,
          geo,
        );
        const guides = store.getState().customGuides;
        if (guideId === null) {
          if (!isOnPage(axis, positionMm, store.getState().document.page)) {
            return;
          }
          const result = addGuide(guides, axis, positionMm);
          guideId = result.id;
          setDraggingId(guideId);
          store.setCustomGuides(result.guides);
          return;
        }
        store.setCustomGuides(moveGuide(guides, guideId, positionMm));
      };

      const onUp = (ev: PointerEvent): void => {
        cleanup();
        if (guideId === null) {
          return;
        }
        const geo = geometry();
        const page = store.getState().document.page;
        const positionMm =
          geo === null
            ? Number.NaN
            : pointerToGuidePositionMm(axis, ev.clientX, ev.clientY, geo);
        if (geo === null || !isOnPage(axis, positionMm, page)) {
          store.setCustomGuides(
            removeGuide(store.getState().customGuides, guideId),
          );
        }
      };

      function cleanup(): void {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        cleanupRef.current = null;
        setDraggingId(null);
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      cleanupRef.current = cleanup;
    },
    [geometry, store],
  );

  const startFromRuler = useCallback(
    (rulerAxis: "h" | "v", e: ReactPointerEvent): void => {
      begin(rulerAxis === "h" ? "y" : "x", null, e);
    },
    [begin],
  );

  const startFromGuide = useCallback(
    (id: string, axis: "x" | "y", e: ReactPointerEvent): void => {
      begin(axis, id, e);
    },
    [begin],
  );

  return { startFromRuler, startFromGuide, draggingId };
}
