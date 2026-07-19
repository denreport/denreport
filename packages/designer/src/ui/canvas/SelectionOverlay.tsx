import type { IrFlexElement } from "@denreport/core";
import type { CSSProperties, ReactNode } from "react";
import { ELEMENT_TYPE_LABEL } from "../../state/element-labels";
import { errorElementIds } from "../../state/error-index";
import type { MmBox, PlacedElementView } from "../../state/geometry";
import { visibleInContext } from "../../state/geometry";
import type { EditorState } from "../../state/types";
import type { HandleId, InteractionState } from "./interaction";
import { isRotatable } from "./interaction";

function boxVars(box: MmBox): CSSProperties {
  return {
    "--x": box.x,
    "--y": box.y,
    "--w": box.w,
    "--h": box.h,
  } as CSSProperties;
}

function fmt(value: number): string {
  return value.toFixed(1);
}

const BOX_HANDLES: readonly {
  readonly id: HandleId;
  readonly fx: number;
  readonly fy: number;
}[] = [
  { id: "nw", fx: 0, fy: 0 },
  { id: "n", fx: 0.5, fy: 0 },
  { id: "ne", fx: 1, fy: 0 },
  { id: "e", fx: 1, fy: 0.5 },
  { id: "se", fx: 1, fy: 1 },
  { id: "s", fx: 0.5, fy: 1 },
  { id: "sw", fx: 0, fy: 1 },
  { id: "w", fx: 0, fy: 0.5 },
];

// flex 子は x/y を持たず、n/w 側は「反対側を固定して原点を動かす」操作になり
// justify/align start の確定位置とゴーストがずれるため、e/s/se のみを出す
const FLEX_CHILD_HANDLES = BOX_HANDLES.filter(
  (h) => h.id === "e" || h.id === "s" || h.id === "se",
);

function toHandles(
  handles: readonly {
    readonly id: HandleId;
    readonly fx: number;
    readonly fy: number;
  }[],
  box: MmBox,
): readonly {
  readonly id: HandleId;
  readonly x: number;
  readonly y: number;
}[] {
  return handles.map((h) => ({
    id: h.id,
    x: box.x + box.w * h.fx,
    y: box.y + box.h * h.fy,
  }));
}

function handlesFor(view: PlacedElementView): readonly {
  readonly id: HandleId;
  readonly x: number;
  readonly y: number;
}[] {
  const type = view.element.type;
  const box = view.box;
  if (view.parentFlexId !== null) {
    if (type === "flex" || type === "table") {
      return [];
    }
    if (type === "line") {
      return [{ id: "line-end", x: box.x + box.w, y: box.y + box.h }];
    }
    return toHandles(FLEX_CHILD_HANDLES, box);
  }
  if (type === "line") {
    return [
      { id: "line-start", x: box.x, y: box.y },
      { id: "line-end", x: box.x + box.w, y: box.y + box.h },
    ];
  }
  if (type === "table" || type === "flex") {
    return [];
  }
  return toHandles(BOX_HANDLES, box);
}

function unionBox(boxes: readonly MmBox[]): MmBox | null {
  if (boxes.length === 0) {
    return null;
  }
  let x1 = Number.POSITIVE_INFINITY;
  let y1 = Number.POSITIVE_INFINITY;
  let x2 = Number.NEGATIVE_INFINITY;
  let y2 = Number.NEGATIVE_INFINITY;
  for (const box of boxes) {
    x1 = Math.min(x1, box.x);
    y1 = Math.min(y1, box.y);
    x2 = Math.max(x2, box.x + box.w);
    y2 = Math.max(y2, box.y + box.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

interface InsertLine {
  readonly horizontal: boolean;
  readonly x: number;
  readonly y: number;
  readonly length: number;
}

function insertLineFor(
  flexView: PlacedElementView,
  children: readonly PlacedElementView[],
  index: number,
): InsertLine {
  const flex = flexView.element as IrFlexElement;
  const box = flexView.box;
  const column = flex.direction === "column";
  let position: number;
  if (children.length === 0) {
    position = column ? box.y : box.x;
  } else if (index <= 0) {
    const first = children[0]?.box;
    position = column ? (first?.y ?? box.y) : (first?.x ?? box.x);
  } else if (index >= children.length) {
    const last = children[children.length - 1]?.box;
    position = column
      ? last
        ? last.y + last.h
        : box.y + box.h
      : last
        ? last.x + last.w
        : box.x + box.w;
  } else {
    const prev = children[index - 1]?.box;
    const next = children[index]?.box;
    position = column
      ? ((prev ? prev.y + prev.h : box.y) + (next?.y ?? box.y)) / 2
      : ((prev ? prev.x + prev.w : box.x) + (next?.x ?? box.x)) / 2;
  }
  return column
    ? { horizontal: true, x: box.x, y: position, length: box.w }
    : { horizontal: false, x: position, y: box.y, length: box.h };
}

export function SelectionOverlay(props: {
  readonly state: EditorState;
  readonly layout: readonly PlacedElementView[];
  readonly interaction: InteractionState;
}): ReactNode {
  const { state, layout, interaction } = props;
  const context = state.view.pageContext;
  const byId = new Map(layout.map((view) => [view.id, view]));

  const selectedViews = state.selection
    .map((id) => byId.get(id))
    .filter((view): view is PlacedElementView => view !== undefined);
  const single = selectedViews.length === 1 ? selectedViews[0] : undefined;

  // エラー要素: path → id を1件ずつ解決して規則 ID チップに使う
  const errorRules = new Map<string, string>();
  for (const error of state.validationErrors) {
    for (const id of errorElementIds(state.document, [error])) {
      if (!errorRules.has(id)) {
        errorRules.set(id, error.rule);
      }
    }
  }

  const guides =
    interaction.kind === "moving" ||
    interaction.kind === "resizing" ||
    interaction.kind === "placing"
      ? interaction.guides
      : [];

  let dragGhosts: readonly { readonly key: string; readonly box: MmBox }[] = [];
  let rotatingGhost: {
    readonly box: MmBox;
    readonly rotate: number;
  } | null = null;
  let tip: { readonly box: MmBox; readonly text: string } | null = null;
  if (interaction.kind === "moving") {
    dragGhosts = interaction.ids.flatMap((id) => {
      const box = byId.get(id)?.box;
      if (box === undefined) {
        return [];
      }
      return [
        {
          key: id,
          box: {
            x: box.x + interaction.offset.x,
            y: box.y + interaction.offset.y,
            w: box.w,
            h: box.h,
          },
        },
      ];
    });
    if (interaction.flexId === null) {
      const bounds = unionBox(dragGhosts.map((ghost) => ghost.box));
      if (bounds !== null) {
        tip = { box: bounds, text: `x ${fmt(bounds.x)}  y ${fmt(bounds.y)}` };
      }
    }
  } else if (interaction.kind === "resizing") {
    dragGhosts = [{ key: interaction.id, box: interaction.box }];
    tip = {
      box: interaction.box,
      text: `${fmt(interaction.box.w)} × ${fmt(interaction.box.h)} mm`,
    };
  } else if (
    interaction.kind === "placing" &&
    interaction.box !== null &&
    interaction.flexId === null
  ) {
    dragGhosts = [{ key: "placing", box: interaction.box }];
    tip = {
      box: interaction.box,
      text: `x ${fmt(interaction.box.x)}  y ${fmt(interaction.box.y)}`,
    };
  } else if (interaction.kind === "rotating") {
    const box = byId.get(interaction.id)?.box;
    if (box !== undefined) {
      rotatingGhost = { box, rotate: interaction.rotate };
      tip = { box, text: `${fmt(interaction.rotate)}°` };
    }
  } else if (
    interaction.kind === "reordering" &&
    interaction.targetFlexId === null
  ) {
    const childBox = byId.get(interaction.childId)?.box;
    const box: MmBox = {
      x: interaction.at.x - interaction.grabOffset.x,
      y: interaction.at.y - interaction.grabOffset.y,
      w: childBox?.w ?? 0,
      h: childBox?.h ?? 0,
    };
    dragGhosts = [{ key: interaction.childId, box }];
    tip = { box, text: `x ${fmt(box.x)}  y ${fmt(box.y)}` };
  }

  let insertLine: InsertLine | null = null;
  let targetFlex: PlacedElementView | undefined;
  const flexTarget =
    interaction.kind === "placing" || interaction.kind === "moving"
      ? { flexId: interaction.flexId, insertIndex: interaction.insertIndex }
      : interaction.kind === "reordering"
        ? {
            flexId: interaction.targetFlexId,
            insertIndex: interaction.insertIndex,
          }
        : null;
  if (flexTarget !== null && flexTarget.flexId !== null) {
    targetFlex = byId.get(flexTarget.flexId);
    if (targetFlex !== undefined && flexTarget.insertIndex !== null) {
      insertLine = insertLineFor(
        targetFlex,
        layout.filter((view) => view.parentFlexId === flexTarget.flexId),
        flexTarget.insertIndex,
      );
    }
  }

  const marquee =
    interaction.kind === "marquee"
      ? {
          x: Math.min(interaction.start.x, interaction.current.x),
          y: Math.min(interaction.start.y, interaction.current.y),
          w: Math.abs(interaction.current.x - interaction.start.x),
          h: Math.abs(interaction.current.y - interaction.start.y),
        }
      : null;

  // 確定選択（state.selection）と重なる id は実線の apx-sel-box に任せ、二重描画しない
  const previewViews =
    interaction.kind === "marquee"
      ? interaction.previewIds
          .filter((id) => !state.selection.includes(id))
          .map((id) => byId.get(id))
          .filter((view): view is PlacedElementView => view !== undefined)
      : [];

  // maxY はどの表示にも現れない位置のため、table 単一選択中のみガイド線で可視化する
  const maxYGuide =
    single !== undefined && single.element.type === "table"
      ? single.element.maxY
      : null;

  return (
    <div className="apx-overlay">
      {[...errorRules.entries()].map(([id, rule]) => {
        const view = byId.get(id);
        if (view === undefined) {
          return null;
        }
        return (
          <div key={id} className="apx-err-box" style={boxVars(view.box)}>
            <span className="apx-el-chip apx-el-chip--error">
              {rule} · {id}
            </span>
          </div>
        );
      })}

      {maxYGuide !== null && (
        <>
          <span
            className="apx-maxy-line"
            style={{ "--gy": maxYGuide } as CSSProperties}
          />
          <span
            className="apx-maxy-chip"
            style={{ "--gy": maxYGuide } as CSSProperties}
          >
            maxY {maxYGuide}
          </span>
        </>
      )}

      {selectedViews.map((view) => (
        <div key={view.id} className="apx-sel-box" style={boxVars(view.box)}>
          {single !== undefined && (
            <span className="apx-el-chip">
              {ELEMENT_TYPE_LABEL[view.element.type]} · {view.id}
            </span>
          )}
        </div>
      ))}

      {single !== undefined &&
        visibleInContext(single.pages, context) &&
        handlesFor(single).map((handle) => (
          <span
            key={handle.id}
            className="apx-h"
            data-apx-handle={handle.id}
            data-apx-id={single.id}
            style={{ "--hx": handle.x, "--hy": handle.y } as CSSProperties}
          />
        ))}

      {single !== undefined &&
        visibleInContext(single.pages, context) &&
        isRotatable(single.element.type) && (
          <span
            className="apx-h apx-h--rotate"
            data-apx-handle="rotate"
            data-apx-id={single.id}
            style={
              {
                "--hx": single.box.x + single.box.w / 2,
                "--hy": single.box.y,
              } as CSSProperties
            }
          />
        )}

      {rotatingGhost !== null && (
        <div
          className="apx-drag-ghost apx-drag-ghost--rotated"
          style={
            {
              ...boxVars(rotatingGhost.box),
              "--rot": `${rotatingGhost.rotate}deg`,
            } as CSSProperties
          }
        />
      )}

      {dragGhosts.map((ghost) => (
        <div
          key={ghost.key}
          className="apx-drag-ghost"
          style={boxVars(ghost.box)}
        />
      ))}

      {targetFlex !== undefined && (
        <div className="apx-flex-target" style={boxVars(targetFlex.box)} />
      )}

      {insertLine !== null && (
        <span
          className={
            insertLine.horizontal ? "apx-insert-line-h" : "apx-insert-line-v"
          }
          style={
            {
              "--x": insertLine.x,
              "--y": insertLine.y,
              "--l": insertLine.length,
            } as CSSProperties
          }
        />
      )}

      {previewViews.map((view) => (
        <div
          key={view.id}
          className="apx-sel-box apx-sel-box--preview"
          style={boxVars(view.box)}
        />
      ))}

      {marquee !== null && (
        <div className="apx-marquee" style={boxVars(marquee)} />
      )}

      {guides.map((guide) =>
        guide.axis === "x" ? (
          <span
            key={`x${guide.positionMm}`}
            className="apx-guide-v"
            style={{ "--gx": guide.positionMm } as CSSProperties}
          />
        ) : (
          <span
            key={`y${guide.positionMm}`}
            className="apx-guide-h"
            style={{ "--gy": guide.positionMm } as CSSProperties}
          />
        ),
      )}

      {tip !== null && (
        <span
          className="apx-coord-tip"
          style={
            {
              "--x": tip.box.x,
              "--y": tip.box.y + tip.box.h,
            } as CSSProperties
          }
        >
          {tip.text}
        </span>
      )}
    </div>
  );
}
