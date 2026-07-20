import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  RefObject,
} from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMessages } from "../../i18n/context.js";
import { MM_TO_PX } from "../../state/constants.js";
import { envelopePresetById } from "../../state/envelope-presets.js";
import type { PlacedElementView } from "../../state/geometry.js";
import { layoutDocument } from "../../state/geometry.js";
import { guidesInPage } from "../../state/guides.js";
import {
  setTableCellOverride,
  updateTableColumn,
} from "../../state/properties.js";
import { activeSampleJson } from "../../state/sample-scenarios.js";
import type { EditorStore } from "../../state/store.js";
import type { TableCellSource } from "../../state/table-cells.js";
import { cellView, tableCellSources } from "../../state/table-cells.js";
import { ContextMenu } from "../context-menu/ContextMenu.js";
import { useCanvasContextMenu } from "../context-menu/useCanvasContextMenu.js";
import { useFontMetrics } from "../fonts/font-metrics.js";
import { commitReplace } from "../properties/ElementProperties.js";
import { useEditorState } from "../useEditorState.js";
import { GuidesLayer } from "./GuidesLayer.js";
import { InlineEditor } from "./InlineEditor.js";
import type { InlineEditTarget } from "./inline-edit.js";
import {
  resolveInlineEditTarget,
  tableCellBox,
  tableHeaderCellBox,
} from "./inline-edit.js";
import type { InteractionState } from "./interaction.js";
import { PaperElement } from "./PaperElement.js";
import { Ruler } from "./Ruler.js";
import { SelectionOverlay } from "./SelectionOverlay.js";
import type { CanvasInteraction } from "./useCanvasInteraction.js";
import { useCellSelection } from "./useCellSelection.js";
import type { GuideDragApi } from "./useGuideDrag.js";
import { useGuideDrag } from "./useGuideDrag.js";
import { usePanning } from "./usePanning.js";
import { anchoredScroll, fitPageZoom, nextWheelZoom } from "./zoom.js";

const NOOP_GUIDE_DRAG: GuideDragApi = {
  startFromRuler: () => {},
  startFromGuide: () => {},
  draggingId: null,
};

const PT_PER_MM = 0.352778;

// A single-line input strips line breaks at the point defaultValue is assigned, so comparisons
// against a value containing line breaks must go through this normalization first
function stripLineBreaks(value: string): string {
  return value.replace(/\r\n|\r|\n/g, "");
}

function draggingIds(interaction: InteractionState): ReadonlySet<string> {
  switch (interaction.kind) {
    case "moving":
      return new Set(interaction.ids);
    case "resizing":
    case "rotating":
      return new Set([interaction.id]);
    case "reordering":
      return new Set([interaction.childId]);
    default:
      return new Set();
  }
}

function InlineEditingLayer(props: {
  readonly editing: InlineEditTarget;
  readonly layout: readonly PlacedElementView[];
  readonly store: EditorStore;
  readonly cellSources: ReadonlyMap<string, TableCellSource>;
  readonly onClose: () => void;
}): ReactNode {
  const { editing, layout, store, cellSources, onClose } = props;
  const targetView = layout.find((view) => view.id === editing.id);
  if (targetView === undefined) {
    return null;
  }
  const el = targetView.element;
  if (editing.kind === "text") {
    if (el.type !== "text") {
      return null;
    }
    return (
      <InlineEditor
        box={targetView.box}
        value={el.text ?? ""}
        multiline
        fontSizePt={el.fontSize}
        lineHeight={el.lineHeight}
        align={el.align}
        onCommit={(raw) => {
          commitReplace(store, el.id, { ...el, text: raw });
          onClose();
        }}
        onCancel={onClose}
      />
    );
  }
  if (el.type !== "table") {
    return null;
  }
  const column = el.columns[editing.columnIndex];
  if (column === undefined) {
    return null;
  }
  if (editing.kind === "tableHeader") {
    return (
      <InlineEditor
        box={tableHeaderCellBox(el, targetView.box, editing.columnIndex)}
        value={column.label}
        multiline={false}
        fontSizePt={el.fontSize}
        onCommit={(raw) => {
          const document = store.getState().document;
          const updated = updateTableColumn(
            document,
            el.id,
            editing.columnIndex,
            { label: raw },
          );
          if (updated !== document) {
            store.commit(updated);
          }
          onClose();
        }}
        onCancel={onClose}
      />
    );
  }
  const source = cellSources.get(el.id);
  const current =
    source === undefined
      ? { text: "", overridden: false }
      : cellView(source, editing.rowIndex, column.key);
  return (
    <InlineEditor
      box={tableCellBox(
        el,
        targetView.box,
        editing.columnIndex,
        editing.rowIndex,
      )}
      value={current.text}
      multiline={false}
      fontSizePt={el.fontSize}
      align={column.align}
      onCommit={(raw) => {
        const document = store.getState().document;
        // Avoid the accident of a bind-derived display value being frozen as a fixed value just from peeking in and pressing Enter
        if (
          raw !== "" &&
          !current.overridden &&
          raw === stripLineBreaks(current.text)
        ) {
          onClose();
          return;
        }
        const updated = setTableCellOverride(
          document,
          el.id,
          editing.rowIndex,
          column.key,
          raw,
        );
        if (updated !== document) {
          store.commit(updated);
        }
        onClose();
      }}
      onCancel={onClose}
    />
  );
}

export function Canvas(props: {
  readonly store: EditorStore;
  readonly interaction: CanvasInteraction;
  /** The path by which clicking a row in the validation drawer scrolls to the element (the function is filled in at mount time) */
  readonly revealRef: RefObject<((id: string) => void) | null>;
}): ReactNode {
  const { store, interaction, revealRef } = props;
  const state = useEditorState(store);
  const m = useMessages();
  const { document: doc, view } = state;
  const activeJson = activeSampleJson(state.sampleScenarios);
  const metrics = useFontMetrics(doc.font, state.fontRegistry);
  const layout = useMemo(
    () => layoutDocument(doc, view.pageContext),
    [doc, view.pageContext],
  );
  const cellSel = useCellSelection(store, layout);
  const cellSources = useMemo(
    () => tableCellSources(doc, activeJson),
    [doc, activeJson],
  );
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fittedRef = useRef(false);
  const prevZoomRef = useRef(view.zoom);
  const [editing, setEditing] = useState<InlineEditTarget | null>(null);
  const pendingAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const interactionKindRef = useRef(interaction.interaction.kind);
  interactionKindRef.current = interaction.interaction.kind;
  const pan = usePanning(
    viewportRef,
    view.canvasMode,
    interaction.interaction.kind !== "idle",
  );
  const panningRef = useRef(pan.panning);
  panningRef.current = pan.panning;
  const guideDragState = useGuideDrag(store, viewportRef);
  // Disable guide creation/movement while in pan mode
  const guideDrag = pan.panMode ? NOOP_GUIDE_DRAG : guideDragState;
  const guidesOnPage = useMemo(
    () => guidesInPage(state.customGuides, doc.page),
    [state.customGuides, doc.page],
  );
  const envelopePreset =
    view.pageContext === "first" &&
    state.envelopePresetId !== null &&
    doc.page.width === 210 &&
    doc.page.height === 297
      ? envelopePresetById(state.envelopePresetId)
      : null;

  // Don't leave a stale-coordinate edit box behind when the document changes due to an external cause such as undo, IR load, or page-context switch
  // biome-ignore lint/correctness/useExhaustiveDependencies: not referenced inside the effect, but a change in doc/pageContext itself is the discard condition
  useEffect(() => {
    setEditing(null);
  }, [doc, view.pageContext]);

  const restoreFocus = useCallback((): void => {
    viewportRef.current?.querySelector<HTMLElement>(".dr-paper")?.focus();
  }, []);
  const menu = useCanvasContextMenu(
    store,
    interaction.interaction.kind !== "idle",
    restoreFocus,
    cellSel,
  );

  // The initial zoom fits the whole page. Runs only once at mount, and does not track window resizes
  useLayoutEffect(() => {
    if (fittedRef.current) {
      return;
    }
    fittedRef.current = true;
    const viewport = viewportRef.current;
    if (viewport === null) {
      return;
    }
    const corner = viewport.querySelector(".dr-ruler-corner");
    const rulerWidth = corner instanceof HTMLElement ? corner.offsetWidth : 0;
    const rulerHeight = corner instanceof HTMLElement ? corner.offsetHeight : 0;
    const zoom = fitPageZoom({
      viewportWidth: viewport.clientWidth,
      viewportHeight: viewport.clientHeight,
      rulerWidth,
      rulerHeight,
      pageWidthMm: doc.page.width,
      pageHeightMm: doc.page.height,
    });
    if (zoom === null) {
      return;
    }
    prevZoomRef.current = zoom;
    store.setView({ zoom });
  }, [store, doc.page.width, doc.page.height]);

  // On zoom change, keep the mm directly under the anchor fixed (cursor position for wheel, viewport center otherwise)
  useLayoutEffect(() => {
    const previous = prevZoomRef.current;
    prevZoomRef.current = view.zoom;
    const viewport = viewportRef.current;
    if (viewport === null || previous === view.zoom) {
      return;
    }
    const paper = viewport.querySelector(".dr-paper");
    if (!(paper instanceof HTMLElement)) {
      return;
    }
    const viewportRect = viewport.getBoundingClientRect();
    const paperRect = paper.getBoundingClientRect();
    const paperLeft = paperRect.left - viewportRect.left + viewport.scrollLeft;
    const paperTop = paperRect.top - viewportRect.top + viewport.scrollTop;
    const anchor = pendingAnchorRef.current;
    pendingAnchorRef.current = null;
    const scroll = anchoredScroll({
      prevZoom: previous,
      nextZoom: view.zoom,
      anchorX: anchor?.x ?? viewport.clientWidth / 2,
      anchorY: anchor?.y ?? viewport.clientHeight / 2,
      paperLeft,
      paperTop,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    });
    viewport.scrollLeft = scroll.left;
    viewport.scrollTop = scroll.top;
  }, [view.zoom]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null) {
      return;
    }
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) {
        return;
      }
      // React's onWheel is registered as passive, so preventDefault has no effect — a native listener is needed
      e.preventDefault();
      if (interactionKindRef.current !== "idle" || panningRef.current) {
        return;
      }
      const current = store.getState().view.zoom;
      const zoom = nextWheelZoom(current, e.deltaY, e.deltaMode);
      if (zoom === current) {
        return;
      }
      const viewportRect = viewport.getBoundingClientRect();
      pendingAnchorRef.current = {
        x: e.clientX - viewportRect.left,
        y: e.clientY - viewportRect.top,
      };
      store.setView({ zoom });
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", onWheel);
    };
  }, [store]);

  useEffect(() => {
    revealRef.current = (id: string): void => {
      viewportRef.current
        ?.querySelector(`[data-dr-id="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    return () => {
      revealRef.current = null;
    };
  }, [revealRef]);

  const mmPx = MM_TO_PX * view.zoom;
  const dragging = draggingIds(interaction.interaction);

  const onPaperDoubleClick = (e: ReactMouseEvent<HTMLDivElement>): void => {
    if (interaction.interaction.kind !== "idle") {
      return;
    }
    // Because paperProps.onPointerDown calls setPointerCapture on paper every time it's pressed,
    // e.target is pinned to paper itself for coordinate tracking during the drag. The element
    // actually under the cursor must be re-obtained via hit-test
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const handleEl = target?.closest("[data-dr-handle]") ?? null;
    if (handleEl !== null) {
      return;
    }
    const idEl = target?.closest("[data-dr-id]") ?? null;
    const colEl = target?.closest("[data-dr-col]") ?? null;
    const colAttr = colEl?.getAttribute("data-dr-col") ?? null;
    const rowEl = target?.closest("[data-dr-row]") ?? null;
    const rowAttr = rowEl?.getAttribute("data-dr-row") ?? null;
    setEditing(
      resolveInlineEditTarget({
        layout,
        selection: state.selection,
        pageContext: view.pageContext,
        elementId: idEl?.getAttribute("data-dr-id") ?? null,
        columnIndex: colAttr === null ? null : Number(colAttr),
        rowIndex: rowAttr === null ? null : Number(rowAttr),
      }),
    );
  };

  const viewportClass = `dr-viewport${pan.panMode ? " is-pan" : ""}${
    pan.panning ? " is-panning" : ""
  }`;

  return (
    <div
      className={viewportClass}
      ref={viewportRef}
      onPointerDown={pan.onViewportPointerDown}
      style={
        {
          "--mm": `${mmPx}px`,
          "--pt": `${mmPx * PT_PER_MM}px`,
        } as CSSProperties
      }
    >
      <div className="dr-ruler-corner">mm</div>
      <Ruler
        axis="h"
        lengthMm={doc.page.width}
        onGuidePointerDown={(e) => guideDrag.startFromRuler("h", e)}
      />
      <Ruler
        axis="v"
        lengthMm={doc.page.height}
        onGuidePointerDown={(e) => guideDrag.startFromRuler("v", e)}
      />
      <div className="dr-canvas-content">
        <div
          className={`dr-paper${view.gridVisible ? " dr-show-grid" : ""}`}
          style={
            {
              "--pw": doc.page.width,
              "--ph": doc.page.height,
            } as CSSProperties
          }
          role="application"
          aria-label={m.canvas.ariaLabel}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: give the paper focus so arrow-key editing works
          tabIndex={0}
          {...interaction.paperProps}
          onPointerDown={
            pan.panMode
              ? undefined
              : (e) => {
                  if (
                    interaction.interaction.kind === "idle" &&
                    cellSel.onPointerDown(e)
                  ) {
                    return;
                  }
                  interaction.paperProps.onPointerDown(e);
                }
          }
          onPointerMove={(e) => {
            cellSel.onPointerMove(e);
            interaction.paperProps.onPointerMove(e);
          }}
          onPointerUp={(e) => {
            cellSel.onPointerUp();
            interaction.paperProps.onPointerUp(e);
          }}
          onPointerCancel={(e) => {
            cellSel.onPointerCancel();
            interaction.paperProps.onPointerCancel(e);
          }}
          onDoubleClick={pan.panMode ? undefined : onPaperDoubleClick}
          onContextMenu={
            pan.panMode ? (e) => e.preventDefault() : menu.onContextMenu
          }
        >
          {layout.map((view_) => (
            <PaperElement
              key={view_.id}
              view={view_}
              context={view.pageContext}
              dragging={dragging.has(view_.id)}
              tableCells={
                view.pageContext === "first" && view_.element.type === "table"
                  ? cellSources.get(view_.element.id)
                  : undefined
              }
              metrics={metrics}
            />
          ))}
          {cellSel.selectionBox !== null && (
            <div
              className="dr-cell-sel"
              style={
                {
                  "--x": cellSel.selectionBox.x,
                  "--y": cellSel.selectionBox.y,
                  "--w": cellSel.selectionBox.w,
                  "--h": cellSel.selectionBox.h,
                } as CSSProperties
              }
            />
          )}
          {doc.elements.length === 0 &&
            interaction.interaction.kind !== "placing" && (
              <div className="dr-paper-empty-hint">{m.canvas.emptyHint}</div>
            )}
          <GuidesLayer
            guides={guidesOnPage}
            envelopePreset={envelopePreset}
            drag={guideDrag}
          />
          <SelectionOverlay
            state={state}
            layout={layout}
            interaction={interaction.interaction}
          />
          {editing !== null && (
            <InlineEditingLayer
              editing={editing}
              layout={layout}
              store={store}
              cellSources={cellSources}
              onClose={() => setEditing(null)}
            />
          )}
        </div>
      </div>
      {menu.menu !== null && (
        <ContextMenu
          x={menu.menu.x}
          y={menu.menu.y}
          items={menu.menu.items}
          onAction={menu.onAction}
          onClose={menu.onClose}
        />
      )}
    </div>
  );
}
