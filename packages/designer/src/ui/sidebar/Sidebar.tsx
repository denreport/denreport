import type { IrElementType } from "@denreport/core";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useRef, useState } from "react";
import { useMessages } from "../../i18n/context";
import type { EditorStore } from "../../state/store";
import type { CanvasInteraction } from "../canvas/useCanvasInteraction";
import { LayersPanel } from "../layers/LayersPanel";
import { Palette } from "../palette/Palette";
import {
  clampPaletteHeight,
  MIN_PALETTE_HEIGHT,
  SPLITTER_KEY_STEP,
} from "./splitter";

interface DragState {
  readonly startY: number;
  readonly startHeight: number;
  readonly sidebarHeight: number;
}

export function Sidebar(props: {
  readonly store: EditorStore;
  readonly beginPlacement: CanvasInteraction["beginPlacement"];
  readonly onQuickAdd: (type: IrElementType) => void;
  readonly onReveal: (id: string) => void;
}): ReactNode {
  const { store, beginPlacement, onQuickAdd, onReveal } = props;
  const m = useMessages();
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [paletteHeight, setPaletteHeight] = useState<number | null>(null);

  const measuredPaletteHeight = useCallback((): number => {
    const rect = sidebarRef.current
      ?.querySelector(".apx-palette")
      ?.getBoundingClientRect();
    return rect?.height ?? MIN_PALETTE_HEIGHT;
  }, []);

  const onSplitterPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>): void => {
      const sidebarHeight = sidebarRef.current?.getBoundingClientRect().height;
      if (sidebarHeight === undefined) {
        return;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        startY: e.clientY,
        startHeight: paletteHeight ?? measuredPaletteHeight(),
        sidebarHeight,
      };
    },
    [paletteHeight, measuredPaletteHeight],
  );

  const onSplitterPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>): void => {
      const drag = dragRef.current;
      if (drag === null) {
        return;
      }
      const dy = e.clientY - drag.startY;
      setPaletteHeight(
        clampPaletteHeight(drag.startHeight + dy, drag.sidebarHeight),
      );
    },
    [],
  );

  const onSplitterPointerEnd = useCallback((): void => {
    dragRef.current = null;
  }, []);

  const onSplitterKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>): void => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
        return;
      }
      e.preventDefault();
      const sidebarHeight = sidebarRef.current?.getBoundingClientRect().height;
      if (sidebarHeight === undefined) {
        return;
      }
      const current = paletteHeight ?? measuredPaletteHeight();
      const delta =
        e.key === "ArrowUp" ? -SPLITTER_KEY_STEP : SPLITTER_KEY_STEP;
      setPaletteHeight(clampPaletteHeight(current + delta, sidebarHeight));
    },
    [paletteHeight, measuredPaletteHeight],
  );

  return (
    <div
      className={`apx-sidebar${paletteHeight !== null ? " has-split" : ""}`}
      ref={sidebarRef}
      style={
        paletteHeight !== null
          ? ({ "--apx-palette-h": `${paletteHeight}px` } as CSSProperties)
          : undefined
      }
    >
      <Palette beginPlacement={beginPlacement} onQuickAdd={onQuickAdd} />
      {/* biome-ignore lint/a11y/useSemanticElements: <hr> cannot be made focusable/interactive, so it can't support drag/keyboard operation */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={m.sidebar.splitterAriaLabel}
        aria-valuenow={paletteHeight ?? undefined}
        tabIndex={0}
        className="apx-sidebar-splitter"
        onPointerDown={onSplitterPointerDown}
        onPointerMove={onSplitterPointerMove}
        onPointerUp={onSplitterPointerEnd}
        onPointerCancel={onSplitterPointerEnd}
        onKeyDown={onSplitterKeyDown}
      />
      <LayersPanel store={store} onReveal={onReveal} />
    </div>
  );
}
