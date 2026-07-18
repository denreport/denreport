/** 1mm の画面 px（倍率 100%・96dpi） */
export const MM_TO_PX = 3.78;

/** グリッド間隔・スナップ有効時の矢印移動量（mm） */
export const GRID_STEP_MM = 5;

/** ペースト時のオフセット（mm）。グリッド設定・スナップ有効/無効と無関係に常に適用する */
export const PASTE_OFFSET_MM = 5;

/** スナップ許容距離。画面 px 基準（mm へはズームで換算）にして吸着の手応えを倍率非依存にする */
export const SNAP_TOLERANCE_PX = 6;

/** これ未満のポインタ移動はクリック扱い（画面 px 基準） */
export const DRAG_THRESHOLD_PX = 3;

/** リサイズ時の w / h / length の下限（mm） */
export const MIN_SIZE_MM = 1;

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;
export const ZOOM_STEPS: readonly number[] = [
  0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4,
];

/** 作業台上の紙の周囲余白（px）。初期ズームの全体フィット算出に使う */
export const CANVAS_PADDING_PX = 24;

/** 1×1 透明 PNG。image は src が必須のため、実画像を指定するまでの初期値に使う */
export const IMAGE_PLACEHOLDER_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/** 表の網掛けトグルを ON にした際に stripeColor へ設定する初期色 */
export const STRIPE_DEFAULT_COLOR = "#f0f0f0";
