import { isFormTarget } from "./useKeyboardEditing";

export interface PanOrigin {
  readonly pointerX: number;
  readonly pointerY: number;
  readonly scrollLeft: number;
  readonly scrollTop: number;
}

/** ポインタ現在位置に対する目標スクロール位置。ポインタの移動方向と逆に scroll が増える */
export function panScrollTarget(
  origin: PanOrigin,
  pointerX: number,
  pointerY: number,
): { readonly left: number; readonly top: number } {
  return {
    left: origin.scrollLeft - (pointerX - origin.pointerX),
    top: origin.scrollTop - (pointerY - origin.pointerY),
  };
}

/** Space を一時パンとして扱ってよいキー発生源か（フォーム要素・ボタン・ダイアログ内は不可） */
export function isPanKeySource(target: EventTarget | null): boolean {
  if (isFormTarget(target)) {
    return false;
  }
  if (!(target instanceof Element)) {
    return true;
  }
  return target.closest("button, [role='dialog']") === null;
}
