import type { IrDocument, IrTableElement } from "@denreport/core";
import type { MmBox, PlacedElementView } from "./geometry.js";
import { roundMm } from "./geometry.js";
import type { PageContext } from "./types.js";

export type AlignKind =
  | "left"
  | "hcenter"
  | "right"
  | "top"
  | "vcenter"
  | "bottom";

export type DistributeAxis = "horizontal" | "vertical";

/** Element id -> move amount (mm). Elements that don't move have no entry */
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

/** views are the boxes of the selected top-level elements (two or more). The reference is the boxes' union boundary */
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

/** views are the boxes of the selected top-level elements (three or more). Both ends stay fixed and gaps are equalized */
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

/** For a table, the first context moves y (with an undetached continuationY following along);
    rest/last move only continuationY.
    The same rule as moveElements / setTableContinuationY */
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

/** Applies deltas to document. For a table's vertical move, y or continuationY is written
    depending on context. Coordinates are rounded with roundMm */
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
