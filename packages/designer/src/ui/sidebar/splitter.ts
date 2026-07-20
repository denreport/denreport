/** Height below which the palette area cannot shrink (roughly enough to show a heading + 1 item) (px) */
export const MIN_PALETTE_HEIGHT = 60;
/** Height always left for the layers panel (px) */
export const MIN_LAYERS_HEIGHT = 96;
/** Amount to change per keyboard keystroke (px) */
export const SPLITTER_KEY_STEP = 16;

/** Value that must match the height of .apx-sidebar-splitter in app.css */
const SPLITTER_HEIGHT = 5;

/**
 * Clamps the desired height against the sidebar's actual height.
 * If sidebarHeight is too small to satisfy both minimums, returns MIN_PALETTE_HEIGHT.
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
