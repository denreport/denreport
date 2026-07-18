/** パレット部が下回れない高さ（見出し+1項目が見える程度）(px) */
export const MIN_PALETTE_HEIGHT = 60;
/** レイヤーパネルに常に残す高さ (px) */
export const MIN_LAYERS_HEIGHT = 96;
/** キーボード操作 1 打鍵あたりの増減量 (px) */
export const SPLITTER_KEY_STEP = 16;

/** app.css の .apx-sidebar-splitter の height と一致させる値 */
const SPLITTER_HEIGHT = 5;

/**
 * 希望高さをサイドバー実高さに対してクランプする。
 * sidebarHeight が小さすぎて両最小値を満たせない場合は MIN_PALETTE_HEIGHT を返す。
 */
export function clampPaletteHeight(
  desired: number,
  sidebarHeight: number,
): number {
  const max = sidebarHeight - SPLITTER_HEIGHT - MIN_LAYERS_HEIGHT;
  if (max < MIN_PALETTE_HEIGHT) {
    return MIN_PALETTE_HEIGHT;
  }
  return Math.min(Math.max(desired, MIN_PALETTE_HEIGHT), max);
}
