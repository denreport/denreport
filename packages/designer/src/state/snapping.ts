import type { IrPage } from "@denreport/core";
import { GRID_STEP_MM } from "./constants";
import type { MmBox } from "./geometry";

export interface SnapContext {
  readonly page: IrPage;
  /** 編集中要素を除いたトップレベル要素の箱 */
  readonly otherBoxes: readonly MmBox[];
  readonly toleranceMm: number;
  readonly gridEnabled: boolean;
  /** カスタムガイド（CustomGuide[] をそのまま渡せる） */
  readonly guideLines: readonly SnapGuide[];
}

export interface SnapGuide {
  readonly axis: "x" | "y";
  readonly positionMm: number;
}

export interface SnapAdjustment {
  readonly box: MmBox;
  readonly guides: readonly SnapGuide[];
}

type CandidateKind = "guide" | "element" | "paper";

interface Candidate {
  readonly position: number;
  readonly kind: CandidateKind;
}

// 同距離のときの優先: カスタムガイド（ユーザーが明示的に置いた線）> 要素端 > 紙端 > グリッド
const KIND_RANK: Record<CandidateKind, number> = {
  guide: 0,
  element: 1,
  paper: 2,
};
const GRID_RANK = 3;
const EPSILON = 1e-9;

interface SnapResult {
  readonly delta: number;
  /** null はグリッド吸着（ガイドを出さない） */
  readonly guide: number | null;
}

function axisCandidates(axis: "x" | "y", ctx: SnapContext): Candidate[] {
  const candidates: Candidate[] = [];
  for (const guide of ctx.guideLines) {
    if (guide.axis === axis) {
      candidates.push({ position: guide.positionMm, kind: "guide" });
    }
  }
  for (const box of ctx.otherBoxes) {
    const start = axis === "x" ? box.x : box.y;
    const size = axis === "x" ? box.w : box.h;
    candidates.push(
      { position: start, kind: "element" },
      { position: start + size / 2, kind: "element" },
      { position: start + size, kind: "element" },
    );
  }
  const pageSize = axis === "x" ? ctx.page.width : ctx.page.height;
  candidates.push(
    { position: 0, kind: "paper" },
    { position: pageSize / 2, kind: "paper" },
    { position: pageSize, kind: "paper" },
  );
  return candidates;
}

function bestSnap(
  anchors: readonly number[],
  candidates: readonly Candidate[],
  ctx: SnapContext,
): SnapResult | null {
  let best: {
    delta: number;
    distance: number;
    rank: number;
    guide: number | null;
  } | null = null;

  function consider(delta: number, rank: number, guide: number | null): void {
    const distance = Math.abs(delta);
    if (distance > ctx.toleranceMm + EPSILON) {
      return;
    }
    if (
      best === null ||
      distance < best.distance - EPSILON ||
      (Math.abs(distance - best.distance) <= EPSILON && rank < best.rank)
    ) {
      best = { delta, distance, rank, guide };
    }
  }

  for (const anchor of anchors) {
    for (const candidate of candidates) {
      consider(
        candidate.position - anchor,
        KIND_RANK[candidate.kind],
        candidate.position,
      );
    }
    if (ctx.gridEnabled) {
      const nearest = Math.round(anchor / GRID_STEP_MM) * GRID_STEP_MM;
      consider(nearest - anchor, GRID_RANK, null);
    }
  }
  if (best === null) {
    return null;
  }
  const found: { delta: number; guide: number | null } = best;
  return { delta: found.delta, guide: found.guide };
}

/** 箱全体の平行移動に対するスナップ（左右上下端＋中心が候補に吸着） */
export function snapForMove(box: MmBox, ctx: SnapContext): SnapAdjustment {
  const xResult = bestSnap(
    [box.x, box.x + box.w / 2, box.x + box.w],
    axisCandidates("x", ctx),
    ctx,
  );
  const yResult = bestSnap(
    [box.y, box.y + box.h / 2, box.y + box.h],
    axisCandidates("y", ctx),
    ctx,
  );
  const guides: SnapGuide[] = [];
  if (xResult?.guide != null) {
    guides.push({ axis: "x", positionMm: xResult.guide });
  }
  if (yResult?.guide != null) {
    guides.push({ axis: "y", positionMm: yResult.guide });
  }
  return {
    box: {
      x: box.x + (xResult?.delta ?? 0),
      y: box.y + (yResult?.delta ?? 0),
      w: box.w,
      h: box.h,
    },
    guides,
  };
}

export interface MovingEdges {
  readonly left?: boolean;
  readonly right?: boolean;
  readonly top?: boolean;
  readonly bottom?: boolean;
}

/** リサイズで動いている辺だけに対するスナップ */
export function snapForResize(
  box: MmBox,
  edges: MovingEdges,
  ctx: SnapContext,
): SnapAdjustment {
  let { x, y, w, h } = box;
  const guides: SnapGuide[] = [];

  if (edges.left === true || edges.right === true) {
    const anchor = edges.left === true ? box.x : box.x + box.w;
    const result = bestSnap([anchor], axisCandidates("x", ctx), ctx);
    if (result !== null) {
      if (edges.left === true) {
        x += result.delta;
        w -= result.delta;
      } else {
        w += result.delta;
      }
      if (result.guide != null) {
        guides.push({ axis: "x", positionMm: result.guide });
      }
    }
  }
  if (edges.top === true || edges.bottom === true) {
    const anchor = edges.top === true ? box.y : box.y + box.h;
    const result = bestSnap([anchor], axisCandidates("y", ctx), ctx);
    if (result !== null) {
      if (edges.top === true) {
        y += result.delta;
        h -= result.delta;
      } else {
        h += result.delta;
      }
      if (result.guide != null) {
        guides.push({ axis: "y", positionMm: result.guide });
      }
    }
  }
  return { box: { x, y, w, h }, guides };
}

/** スナップ有効時の矢印キー移動先: 移動方向の次の 5mm グリッド線の座標 */
export function gridArrowTarget(value: number, direction: 1 | -1): number {
  return direction === 1
    ? (Math.floor(value / GRID_STEP_MM + EPSILON) + 1) * GRID_STEP_MM
    : (Math.ceil(value / GRID_STEP_MM - EPSILON) - 1) * GRID_STEP_MM;
}
