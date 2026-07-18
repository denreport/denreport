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

/** 選択のトップレベル要素をクリップボードへ格納する */
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

/** copySelection + 格納した要素の削除を1 commit で行う */
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

/** クリップボードの groupIndexes を pastedIds へ写像し、新グループとして形成する */
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

/** クリップボード内容を貼り付け、貼った要素を選択にする。pasteCount を進める */
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

/** 選択をその場で複製（コピー+即ペーストの合成）。保存済みクリップボードは変更しない */
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

/** 選択（flex 子を含む）を削除し、選択を空にする */
export function deleteSelection(store: EditorStore): boolean {
  const state = store.getState();
  if (state.selection.length === 0) {
    return false;
  }
  store.commit(deleteElements(state.document, state.selection), []);
  return true;
}

/** 選択のうちトップレベル要素の箱を文書順で返す（flex 子は対象外） */
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

/** 選択中のトップレベル要素が2未満なら false（commit しない） */
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

/** 選択中のトップレベル要素が3未満なら false（commit しない） */
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

/** 選択中のトップレベル id が2以上のとき成立し、グループを新設する */
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

/** 選択と交差する生存グループがあるとき成立し、それらを解除する */
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
