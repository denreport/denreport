import { isFormTarget } from "./useKeyboardEditing";

export interface PanOrigin {
  readonly pointerX: number;
  readonly pointerY: number;
  readonly scrollLeft: number;
  readonly scrollTop: number;
}

/** Target scroll position relative to the pointer's current position. Scroll increases in the direction opposite to the pointer's movement */
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

/** Whether the key event source may treat Space as temporary panning (not allowed inside form elements, buttons, or dialogs) */
export function isPanKeySource(target: EventTarget | null): boolean {
  if (isFormTarget(target)) {
    return false;
  }
  if (!(target instanceof Element)) {
    return true;
  }
  return target.closest("button, [role='dialog']") === null;
}
