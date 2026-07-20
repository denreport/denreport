import type {
  IrDocument,
  IrElement,
  IrElementType,
  IrFlexChild,
} from "@denreport/core";
import { PASTE_OFFSET_MM } from "./constants.js";
import { addElement } from "./elements.js";
import { roundMm } from "./geometry.js";
import type { ElementGroup } from "./groups.js";
import { livingGroups } from "./groups.js";

/** The value held by the in-app clipboard. elements are the elements as of the time they were
    stored (in document order).
    pasteCount is how many times this content has been pasted (used for accumulating the offset) */
export interface ClipboardState {
  readonly elements: readonly IrElement[];
  readonly pasteCount: number;
  /** A list of index sets into elements. Each set is a group of elements that were in the same group when stored */
  readonly groupIndexes: readonly (readonly number[])[];
}

export interface PasteResult {
  readonly document: IrDocument;
  /** Top-level ids of the pasted new elements (to become the new selection) */
  readonly pastedIds: readonly string[];
  /** The next clipboard value, with pasteCount incremented by 1 */
  readonly clipboard: ClipboardState;
}

/** Extracts only the top-level elements from selection, in document order, to build the
    stored value. Returns null if there are 0 matches (copy/cut doesn't go through) */
export function clipboardFromSelection(
  document: IrDocument,
  selection: readonly string[],
  groups: readonly ElementGroup[],
): ClipboardState | null {
  const idSet = new Set(selection);
  const elements = document.elements.filter((el) => idSet.has(el.id));
  if (elements.length === 0) {
    return null;
  }
  const indexById = new Map(elements.map((el, index) => [el.id, index]));
  const groupIndexes: number[][] = [];
  for (const group of livingGroups(groups, document)) {
    const indexes = group.memberIds
      .map((id) => indexById.get(id))
      .filter((index): index is number => index !== undefined);
    if (indexes.length >= 2) {
      groupIndexes.push(indexes);
    }
  }
  return { elements, pasteCount: 0, groupIndexes };
}

function collectUsedIds(document: IrDocument): Set<string> {
  const ids = new Set<string>();
  function visit(el: IrElement | IrFlexChild): void {
    ids.add(el.id);
    if (el.type === "flex") {
      for (const child of el.children) {
        visit(child);
      }
    }
  }
  for (const el of document.elements) {
    visit(el);
  }
  return ids;
}

/** Takes the smallest free "<type><n>" number as seen from used, adds it to used, and returns it */
function claimId(used: Set<string>, type: IrElementType): string {
  let n = 1;
  while (used.has(`${type}${n}`)) {
    n += 1;
  }
  const id = `${type}${n}`;
  used.add(id);
  return id;
}

function cloneFlexChild(child: IrFlexChild, used: Set<string>): IrFlexChild {
  const id = claimId(used, child.type);
  if (child.type === "flex") {
    return {
      ...child,
      id,
      children: child.children.map((c) => cloneFlexChild(c, used)),
    };
  }
  return { ...child, id };
}

function cloneTopElement(
  el: IrElement,
  used: Set<string>,
  dx: number,
  dy: number,
): IrElement {
  const id = claimId(used, el.type);
  switch (el.type) {
    case "table":
      return {
        ...el,
        id,
        x: roundMm(el.x + dx),
        y: roundMm(el.y + dy),
        continuationY: roundMm(el.continuationY + dy),
      };
    case "flex":
      return {
        ...el,
        id,
        x: roundMm(el.x + dx),
        y: roundMm(el.y + dy),
        children: el.children.map((child) => cloneFlexChild(child, used)),
      };
    default:
      return { ...el, id, x: roundMm(el.x + dx), y: roundMm(el.y + dy) };
  }
}

/** Renumbers ids and applies the offset to clipboard.elements, then appends them to the end
    of document.
    The offset is (pasteCount + 1) x PASTE_OFFSET_MM, applied in both the x and y directions */
export function pasteFromClipboard(
  document: IrDocument,
  clipboard: ClipboardState,
): PasteResult {
  const offset = (clipboard.pasteCount + 1) * PASTE_OFFSET_MM;
  const used = collectUsedIds(document);
  let nextDocument = document;
  const pastedIds: string[] = [];
  for (const el of clipboard.elements) {
    const cloned = cloneTopElement(el, used, offset, offset);
    nextDocument = addElement(nextDocument, cloned);
    pastedIds.push(cloned.id);
  }
  return {
    document: nextDocument,
    pastedIds,
    clipboard: { ...clipboard, pasteCount: clipboard.pasteCount + 1 },
  };
}
