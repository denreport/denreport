/** Screen px per 1mm (100% zoom, 96dpi) */
export const MM_TO_PX = 3.78;

/** Grid spacing / arrow-key move amount when snap is enabled (mm) */
export const GRID_STEP_MM = 5;

/** Paste offset (mm). Always applied regardless of grid settings or snap enabled/disabled */
export const PASTE_OFFSET_MM = 5;

/** Snap tolerance distance. Kept in screen px (converted to mm via zoom) so the snapping feel is zoom-independent */
export const SNAP_TOLERANCE_PX = 6;

/** Pointer movement below this is treated as a click (in screen px) */
export const DRAG_THRESHOLD_PX = 3;

/** The lower bound for w / h / length when resizing (mm) */
export const MIN_SIZE_MM = 1;

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;
export const ZOOM_STEPS: readonly number[] = [
  0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4,
];

/** Margin around the paper on the workbench (px). Used to compute the initial fit-to-view zoom */
export const CANVAS_PADDING_PX = 24;

/** A 1x1 transparent PNG. Used as the initial value until an actual image is specified, since image requires src */
export const IMAGE_PLACEHOLDER_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/** The initial color set into stripeColor when the table's stripe toggle is turned ON */
export const STRIPE_DEFAULT_COLOR = "#f0f0f0";
