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

/** The smallest step on ZOOM_STEPS that is greater than current. null if already at the top */
export function zoomStepIn(current: number): number | null {
  return ZOOM_STEPS.find((z) => z > current + 1e-9) ?? null;
}

/** The largest step on ZOOM_STEPS that is less than current. null if already at the bottom */
export function zoomStepOut(current: number): number | null {
  return [...ZOOM_STEPS].reverse().find((z) => z < current - 1e-9) ?? null;
}

/** The zoom ratio at which the entire page fits in the viewport. null if uncomputable (available area is 0 or less) */
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

// In Firefox's line mode, deltaY arrives in units of "number of lines", so approximate it as the px equivalent
const LINE_HEIGHT_PX = 16;
const WHEEL_SENSITIVITY = 0.002;

/** Zoom ratio after one wheel event. Zooms out when deltaY > 0. Clamped to ZOOM_MIN..ZOOM_MAX */
export function nextWheelZoom(
  current: number,
  deltaY: number,
  deltaMode: number,
): number {
  const delta = deltaMode === 1 ? deltaY * LINE_HEIGHT_PX : deltaY;
  return clampZoom(current * Math.exp(-delta * WHEEL_SENSITIVITY));
}

/** Scroll position that keeps the paper mm directly under the anchor point (px in viewport-visible coordinates) fixed */
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
