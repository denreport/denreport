export interface MenuPlacementInput {
  /** Right-click position (viewport coordinates, px) */
  readonly x: number;
  readonly y: number;
  readonly menuWidth: number;
  readonly menuHeight: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

/** Opens toward the bottom-right, and translates (clamps) any overflow at the screen edge. Never flips */
export function clampMenuPosition(input: MenuPlacementInput): {
  readonly x: number;
  readonly y: number;
} {
  const { x, y, menuWidth, menuHeight, viewportWidth, viewportHeight } = input;
  return {
    x: Math.max(4, Math.min(x, viewportWidth - menuWidth - 4)),
    y: Math.max(4, Math.min(y, viewportHeight - menuHeight - 4)),
  };
}
