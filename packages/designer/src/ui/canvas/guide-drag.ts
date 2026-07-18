import type { IrPage } from "@denreport/core";
import { roundMm } from "../../state/geometry";

export interface PaperGeometry {
  /** client 座標系での紙左上 */
  readonly paperLeftPx: number;
  readonly paperTopPx: number;
  /** MM_TO_PX * view.zoom */
  readonly mmPx: number;
}

/** 0.1mm 丸め済みの紙面 mm 位置 */
export function pointerToGuidePositionMm(
  axis: "x" | "y",
  clientX: number,
  clientY: number,
  geo: PaperGeometry,
): number {
  const originPx = axis === "x" ? geo.paperLeftPx : geo.paperTopPx;
  const clientPx = axis === "x" ? clientX : clientY;
  return roundMm((clientPx - originPx) / geo.mmPx);
}

export function isOnPage(
  axis: "x" | "y",
  positionMm: number,
  page: IrPage,
): boolean {
  const size = axis === "x" ? page.width : page.height;
  return positionMm >= 0 && positionMm <= size;
}
