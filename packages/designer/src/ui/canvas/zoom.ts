import {
  CANVAS_PADDING_PX,
  MM_TO_PX,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEPS,
} from "../../state/constants";

function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

/** ZOOM_STEPS 上で current より大きい最小の段。上端なら null */
export function zoomStepIn(current: number): number | null {
  return ZOOM_STEPS.find((z) => z > current + 1e-9) ?? null;
}

/** ZOOM_STEPS 上で current より小さい最大の段。下端なら null */
export function zoomStepOut(current: number): number | null {
  return [...ZOOM_STEPS].reverse().find((z) => z < current - 1e-9) ?? null;
}

/** ページ全体がビューポートに収まる倍率。計算不能（可用領域が 0 以下）なら null */
export function fitPageZoom(input: {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly rulerWidth: number;
  readonly rulerHeight: number;
  readonly pageWidthMm: number;
  readonly pageHeightMm: number;
}): number | null {
  const availW = input.viewportWidth - input.rulerWidth - 2 * CANVAS_PADDING_PX;
  const availH =
    input.viewportHeight - input.rulerHeight - 2 * CANVAS_PADDING_PX;
  if (availW <= 0 || availH <= 0) {
    return null;
  }
  return clampZoom(
    Math.min(
      availW / (input.pageWidthMm * MM_TO_PX),
      availH / (input.pageHeightMm * MM_TO_PX),
    ),
  );
}

// Firefox の line モードは deltaY が「行数」単位で来るため px 相当に近似する
const LINE_HEIGHT_PX = 16;
const WHEEL_SENSITIVITY = 0.002;

/** ホイール 1 イベント後の倍率。deltaY > 0 で縮小。ZOOM_MIN..ZOOM_MAX にクランプ */
export function nextWheelZoom(
  current: number,
  deltaY: number,
  deltaMode: number,
): number {
  const delta = deltaMode === 1 ? deltaY * LINE_HEIGHT_PX : deltaY;
  return clampZoom(current * Math.exp(-delta * WHEEL_SENSITIVITY));
}

/** アンカー点（ビューポート可視座標の px）直下の紙上 mm を維持するスクロール位置 */
export function anchoredScroll(input: {
  readonly prevZoom: number;
  readonly nextZoom: number;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly paperLeft: number;
  readonly paperTop: number;
  readonly scrollLeft: number;
  readonly scrollTop: number;
}): { readonly left: number; readonly top: number } {
  const anchorMmX =
    (input.scrollLeft + input.anchorX - input.paperLeft) /
    (MM_TO_PX * input.prevZoom);
  const anchorMmY =
    (input.scrollTop + input.anchorY - input.paperTop) /
    (MM_TO_PX * input.prevZoom);
  return {
    left:
      anchorMmX * MM_TO_PX * input.nextZoom + input.paperLeft - input.anchorX,
    top: anchorMmY * MM_TO_PX * input.nextZoom + input.paperTop - input.anchorY,
  };
}
