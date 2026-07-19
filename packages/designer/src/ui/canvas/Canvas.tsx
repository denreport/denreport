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
import { MM_TO_PX } from "../../state/constants";
import { envelopePresetById } from "../../state/envelope-presets";
import type { PlacedElementView } from "../../state/geometry";
import { layoutDocument } from "../../state/geometry";
import { guidesInPage } from "../../state/guides";
import {
  setTableCellOverride,
  updateTableColumn,
} from "../../state/properties";
import { activeSampleJson } from "../../state/sample-scenarios";
import type { EditorStore } from "../../state/store";
import type { TableCellSource } from "../../state/table-cells";
import { cellView, tableCellSources } from "../../state/table-cells";
import { ContextMenu } from "../context-menu/ContextMenu";
import { useCanvasContextMenu } from "../context-menu/useCanvasContextMenu";
import { commitReplace } from "../properties/ElementProperties";
import { useEditorState } from "../useEditorState";
import { GuidesLayer } from "./GuidesLayer";
import { InlineEditor } from "./InlineEditor";
import type { InlineEditTarget } from "./inline-edit";
import {
  resolveInlineEditTarget,
  tableCellBox,
  tableHeaderCellBox,
} from "./inline-edit";
import type { InteractionState } from "./interaction";
import { PaperElement } from "./PaperElement";
import { Ruler } from "./Ruler";
import { SelectionOverlay } from "./SelectionOverlay";
import type { CanvasInteraction } from "./useCanvasInteraction";
import type { GuideDragApi } from "./useGuideDrag";
import { useGuideDrag } from "./useGuideDrag";
import { usePanning } from "./usePanning";
import { anchoredScroll, fitPageZoom, nextWheelZoom } from "./zoom";

const NOOP_GUIDE_DRAG: GuideDragApi = {
  startFromRuler: () => {},
  startFromGuide: () => {},
  draggingId: null,
};

const PT_PER_MM = 0.352778;

// 単一行 input は defaultValue 代入時点で改行を除去するため、改行入り value との
// 比較はこの正規化を通してから行う
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
        // 覗いて Enter しただけで bind 由来の表示値が固定値として凍結される事故を避ける
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
  /** 検証ドロワーの行クリックが要素へスクロールするための経路（マウント時に関数を詰める） */
  readonly revealRef: RefObject<((id: string) => void) | null>;
}): ReactNode {
  const { store, interaction, revealRef } = props;
  const state = useEditorState(store);
  const { document: doc, view } = state;
  const activeJson = activeSampleJson(state.sampleScenarios);
  const layout = useMemo(
    () => layoutDocument(doc, view.pageContext),
    [doc, view.pageContext],
  );
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
  // パンモード中はガイドの作成・移動を無効にする
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

  // undo・IR 読込・ページ文脈切替など外部要因で文書が変わったら、古い座標の編集枠を残さない
  // biome-ignore lint/correctness/useExhaustiveDependencies: 効果内では参照しないが、doc/pageContext の変化そのものが破棄条件
  useEffect(() => {
    setEditing(null);
  }, [doc, view.pageContext]);

  const restoreFocus = useCallback((): void => {
    viewportRef.current?.querySelector<HTMLElement>(".apx-paper")?.focus();
  }, []);
  const menu = useCanvasContextMenu(
    store,
    interaction.interaction.kind !== "idle",
    restoreFocus,
  );

  // 初期ズームはページ全体フィット。マウント時1回だけで、ウィンドウリサイズには追従しない
  useLayoutEffect(() => {
    if (fittedRef.current) {
      return;
    }
    fittedRef.current = true;
    const viewport = viewportRef.current;
    if (viewport === null) {
      return;
    }
    const corner = viewport.querySelector(".apx-ruler-corner");
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

  // ズーム変更時はアンカー（wheel ならカーソル位置、それ以外はビューポート中心）直下の mm を維持する
  useLayoutEffect(() => {
    const previous = prevZoomRef.current;
    prevZoomRef.current = view.zoom;
    const viewport = viewportRef.current;
    if (viewport === null || previous === view.zoom) {
      return;
    }
    const paper = viewport.querySelector(".apx-paper");
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
      // React の onWheel は passive 登録のため preventDefault が効かず、ネイティブリスナーが必要
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
        ?.querySelector(`[data-apx-id="${CSS.escape(id)}"]`)
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
    // paperProps.onPointerDown が押下のたびに paper へ setPointerCapture するため、
    // e.target はドラッグ中の座標追従用に paper 自身へ固定される。実際にカーソル直下に
    // ある要素は hit-test で取り直す必要がある
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const handleEl = target?.closest("[data-apx-handle]") ?? null;
    if (handleEl !== null) {
      return;
    }
    const idEl = target?.closest("[data-apx-id]") ?? null;
    const colEl = target?.closest("[data-apx-col]") ?? null;
    const colAttr = colEl?.getAttribute("data-apx-col") ?? null;
    const rowEl = target?.closest("[data-apx-row]") ?? null;
    const rowAttr = rowEl?.getAttribute("data-apx-row") ?? null;
    setEditing(
      resolveInlineEditTarget({
        layout,
        selection: state.selection,
        pageContext: view.pageContext,
        elementId: idEl?.getAttribute("data-apx-id") ?? null,
        columnIndex: colAttr === null ? null : Number(colAttr),
        rowIndex: rowAttr === null ? null : Number(rowAttr),
      }),
    );
  };

  const viewportClass = `apx-viewport${pan.panMode ? " is-pan" : ""}${
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
      <div className="apx-ruler-corner">mm</div>
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
      <div className="apx-canvas-content">
        <div
          className={`apx-paper${view.gridVisible ? " apx-show-grid" : ""}`}
          style={
            {
              "--pw": doc.page.width,
              "--ph": doc.page.height,
            } as CSSProperties
          }
          role="application"
          aria-label="キャンバス"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: 矢印キー編集のため紙にフォーカスを持たせる
          tabIndex={0}
          {...interaction.paperProps}
          onPointerDown={
            pan.panMode ? undefined : interaction.paperProps.onPointerDown
          }
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
            />
          ))}
          {doc.elements.length === 0 &&
            interaction.interaction.kind !== "placing" && (
              <div className="apx-paper-empty-hint">
                パレットから要素をドラッグして配置
              </div>
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
