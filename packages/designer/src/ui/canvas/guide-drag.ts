import type { IrPage } from "@denreport/core";
import { roundMm } from "../../state/geometry.js";

export interface PaperGeometry {
  /** Top-left of the paper in the client coordinate system */
  readonly paperLeftPx: number;
  readonly paperTopPx: number;
  /** MM_TO_PX * view.zoom */
  readonly mmPx: number;
}

/** Paper position in mm, rounded to 0.1mm */
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
