export interface MenuPlacementInput {
  /** 右クリック位置（viewport 座標 px） */
  readonly x: number;
  readonly y: number;
  readonly menuWidth: number;
  readonly menuHeight: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

/** 右下方向に開き、画面端でははみ出し分を平行移動（クランプ）する。反転はしない */
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
