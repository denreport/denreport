import type { AlignKind, DistributeAxis } from "./alignment";
import {
  alignmentDeltas,
  applyMoveDeltas,
  distributionDeltas,
} from "./alignment";
import { clipboardFromSelection, pasteFromClipboard } from "./clipboard";
import { deleteElements } from "./elements";
import { layoutDocument } from "./geometry";
import type { ElementGroup } from "./groups";
import { createGroupFrom, dissolveGroupsOf, livingGroups } from "./groups";
import type { EditorStore } from "./store";
import type { EditorState } from "./types";

/** Stores the top-level elements of the selection into the clipboard */
export function copySelection(store: EditorStore): boolean {
  const state = store.getState();
  const clipboard = clipboardFromSelection(
    state.document,
    state.selection,
    state.groups,
  );
  if (clipboard === null) {
    return false;
  }
  store.setClipboard(clipboard);
  return true;
}

/** Performs copySelection + deletion of the stored elements in a single commit */
export function cutSelection(store: EditorStore): boolean {
  const state = store.getState();
  const clipboard = clipboardFromSelection(
    state.document,
    state.selection,
    state.groups,
  );
  if (clipboard === null) {
    return false;
  }
  store.setClipboard(clipboard);
  const ids = clipboard.elements.map((el) => el.id);
  store.commit(deleteElements(state.document, ids), []);
  return true;
}

/** Maps the clipboard's groupIndexes onto pastedIds and forms them as new groups */
function regroupPasted(
  groups: readonly ElementGroup[],
  groupIndexes: readonly (readonly number[])[],
  pastedIds: readonly string[],
): readonly ElementGroup[] {
  let next = groups;
  for (const indexes of groupIndexes) {
    const memberIds = indexes
      .map((index) => pastedIds[index])
      .filter((id): id is string => id !== undefined);
    if (memberIds.length >= 2) {
      next = createGroupFrom(next, memberIds);
    }
  }
  return next;
}

/** Pastes the clipboard contents and selects the pasted elements. Advances pasteCount */
export function pasteClipboard(store: EditorStore): boolean {
  const clipboard = store.getClipboard();
  if (clipboard === null) {
    return false;
  }
  const state = store.getState();
  const result = pasteFromClipboard(state.document, clipboard);
  store.commit(result.document, result.pastedIds);
  store.setClipboard(result.clipboard);
  const groups = regroupPasted(
    state.groups,
    clipboard.groupIndexes,
    result.pastedIds,
  );
  if (groups !== state.groups) {
    store.setGroups(groups);
  }
  return true;
}

/** Duplicates the selection in place (a composite of copy + immediate paste). Doesn't change the saved clipboard */
export function duplicateSelection(store: EditorStore): boolean {
  const state = store.getState();
  const clipboard = clipboardFromSelection(
    state.document,
    state.selection,
    state.groups,
  );
  if (clipboard === null) {
    return false;
  }
  const result = pasteFromClipboard(state.document, clipboard);
  store.commit(result.document, result.pastedIds);
  const groups = regroupPasted(
    state.groups,
    clipboard.groupIndexes,
    result.pastedIds,
  );
  if (groups !== state.groups) {
    store.setGroups(groups);
  }
  return true;
}

/** Deletes the selection (including flex children) and clears the selection */
export function deleteSelection(store: EditorStore): boolean {
  const state = store.getState();
  if (state.selection.length === 0) {
    return false;
  }
  store.commit(deleteElements(state.document, state.selection), []);
  return true;
}

/** Returns the boxes of the top-level elements in the selection, in document order (flex children are excluded) */
function selectedTopLevelViews(store: EditorStore) {
  const state = store.getState();
  const idSet = new Set(state.selection);
  const topLevelIds = new Set(
    state.document.elements.filter((el) => idSet.has(el.id)).map((el) => el.id),
  );
  return layoutDocument(state.document, state.view.pageContext).filter((view) =>
    topLevelIds.has(view.id),
  );
}

/** Returns false (and doesn't commit) if fewer than 2 top-level elements are selected */
export function alignSelection(store: EditorStore, kind: AlignKind): boolean {
  const views = selectedTopLevelViews(store);
  if (views.length < 2) {
    return false;
  }
  const state = store.getState();
  store.commit(
    applyMoveDeltas(
      state.document,
      state.view.pageContext,
      alignmentDeltas(views, kind),
    ),
  );
  return true;
}

/** Returns false (and doesn't commit) if fewer than 3 top-level elements are selected */
export function distributeSelection(
  store: EditorStore,
  axis: DistributeAxis,
): boolean {
  const views = selectedTopLevelViews(store);
  if (views.length < 3) {
    return false;
  }
  const state = store.getState();
  store.commit(
    applyMoveDeltas(
      state.document,
      state.view.pageContext,
      distributionDeltas(views, axis),
    ),
  );
  return true;
}

/** Succeeds when 2 or more selected top-level ids exist, creating a new group */
export function groupSelection(store: EditorStore): boolean {
  const state = store.getState();
  const topLevel = new Set(state.document.elements.map((el) => el.id));
  const memberIds = state.selection.filter((id) => topLevel.has(id));
  if (memberIds.length < 2) {
    return false;
  }
  store.setGroups(createGroupFrom(state.groups, memberIds));
  return true;
}

/** Succeeds when there's a living group that intersects the selection, dissolving it */
export function ungroupSelection(store: EditorStore): boolean {
  const state = store.getState();
  if (!canUngroupSelection(state)) {
    return false;
  }
  store.setGroups(dissolveGroupsOf(state.groups, state.selection));
  return true;
}

export function canGroupSelection(state: EditorState): boolean {
  const topLevel = new Set(state.document.elements.map((el) => el.id));
  return state.selection.filter((id) => topLevel.has(id)).length >= 2;
}

export function canUngroupSelection(state: EditorState): boolean {
  return livingGroups(state.groups, state.document).some((group) =>
    group.memberIds.some((id) => state.selection.includes(id)),
  );
}
