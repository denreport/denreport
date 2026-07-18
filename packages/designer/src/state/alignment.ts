import type { IrDocument, IrTableElement } from "@denreport/core";
import type { MmBox, PlacedElementView } from "./geometry";
import { roundMm } from "./geometry";
import type { PageContext } from "./types";

export type AlignKind =
  | "left"
  | "hcenter"
  | "right"
  | "top"
  | "vcenter"
  | "bottom";

export type DistributeAxis = "horizontal" | "vertical";

/** 要素 id → 移動量（mm）。動かない要素はエントリを持たない */
export type MoveDeltas = ReadonlyMap<
  string,
  { readonly dx: number; readonly dy: number }
>;

function unionBox(views: readonly PlacedElementView[]): MmBox {
  const left = Math.min(...views.map((v) => v.box.x));
  const top = Math.min(...views.map((v) => v.box.y));
  const right = Math.max(...views.map((v) => v.box.x + v.box.w));
  const bottom = Math.max(...views.map((v) => v.box.y + v.box.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

function alignDelta(
  box: MmBox,
  union: MmBox,
  kind: AlignKind,
): { readonly dx: number; readonly dy: number } {
  switch (kind) {
    case "left":
      return { dx: union.x - box.x, dy: 0 };
    case "hcenter":
      return { dx: union.x + union.w / 2 - (box.x + box.w / 2), dy: 0 };
    case "right":
      return { dx: union.x + union.w - (box.x + box.w), dy: 0 };
    case "top":
      return { dx: 0, dy: union.y - box.y };
    case "vcenter":
      return { dx: 0, dy: union.y + union.h / 2 - (box.y + box.h / 2) };
    case "bottom":
      return { dx: 0, dy: union.y + union.h - (box.y + box.h) };
  }
}

/** views は選択中のトップレベル要素の箱（2つ以上）。基準は箱の合併境界 */
export function alignmentDeltas(
  views: readonly PlacedElementView[],
  kind: AlignKind,
): MoveDeltas {
  const union = unionBox(views);
  const deltas = new Map<string, { dx: number; dy: number }>();
  for (const view of views) {
    const delta = alignDelta(view.box, union, kind);
    if (delta.dx !== 0 || delta.dy !== 0) {
      deltas.set(view.id, delta);
    }
  }
  return deltas;
}

function startOf(box: MmBox, axis: DistributeAxis): number {
  return axis === "horizontal" ? box.x : box.y;
}

function sizeOf(box: MmBox, axis: DistributeAxis): number {
  return axis === "horizontal" ? box.w : box.h;
}

/** views は選択中のトップレベル要素の箱（3つ以上）。両端固定・gap 均等 */
export function distributionDeltas(
  views: readonly PlacedElementView[],
  axis: DistributeAxis,
): MoveDeltas {
  const deltas = new Map<string, { dx: number; dy: number }>();
  const sorted = [...views].sort(
    (a, b) => startOf(a.box, axis) - startOf(b.box, axis),
  );
  const count = sorted.length;
  const first = sorted[0];
  const last = sorted[count - 1];
  if (first === undefined || last === undefined || count < 2) {
    return deltas;
  }

  const span =
    startOf(last.box, axis) + sizeOf(last.box, axis) - startOf(first.box, axis);
  const sumSizes = sorted.reduce((total, v) => total + sizeOf(v.box, axis), 0);
  const gap = (span - sumSizes) / (count - 1);

  let cursor = startOf(first.box, axis) + sizeOf(first.box, axis) + gap;
  for (let i = 1; i < count - 1; i += 1) {
    const view = sorted[i];
    if (view !== undefined) {
      const delta = cursor - startOf(view.box, axis);
      if (delta !== 0) {
        deltas.set(
          view.id,
          axis === "horizontal" ? { dx: delta, dy: 0 } : { dx: 0, dy: delta },
        );
      }
      cursor += sizeOf(view.box, axis) + gap;
    }
  }
  return deltas;
}

/** table の first 文脈は y（未分離の continuationY を追従）、rest/last は continuationY のみを動かす。
    moveElements / setTableContinuationY と同じ規則 */
function applyTableDelta(
  el: IrTableElement,
  context: PageContext,
  dx: number,
  dy: number,
): IrTableElement {
  const x = roundMm(el.x + dx);
  if (context === "first") {
    const y = roundMm(el.y + dy);
    const continuationY = el.continuationY === el.y ? y : el.continuationY;
    return { ...el, x, y, continuationY };
  }
  return { ...el, x, continuationY: roundMm(el.continuationY + dy) };
}

/** deltas を document に適用する。table の縦移動は context に応じて y / continuationY を
    書き分ける。座標は roundMm で丸める */
export function applyMoveDeltas(
  document: IrDocument,
  context: PageContext,
  deltas: MoveDeltas,
): IrDocument {
  return {
    ...document,
    elements: document.elements.map((el) => {
      const delta = deltas.get(el.id);
      if (delta === undefined) {
        return el;
      }
      if (el.type === "table") {
        return applyTableDelta(el, context, delta.dx, delta.dy);
      }
      return {
        ...el,
        x: roundMm(el.x + delta.dx),
        y: roundMm(el.y + delta.dy),
      };
    }),
  };
}
