import type { IrDocument } from "@denreport/core";

export interface ElementGroup {
  /** "group1" 形式。セッション内一意 */
  readonly id: string;
  /** トップレベル要素 id のみ。文書に実在しない id を含みうる（遅延解決） */
  readonly memberIds: readonly string[];
}

function topLevelIds(document: IrDocument): ReadonlySet<string> {
  return new Set(document.elements.map((el) => el.id));
}

/** 現在の document で生きているグループだけを返す。
    メンバーをトップレベル実在要素に絞り、生存メンバー 2 未満のグループを除く */
export function livingGroups(
  groups: readonly ElementGroup[],
  document: IrDocument,
): readonly ElementGroup[] {
  const topLevel = topLevelIds(document);
  const living: ElementGroup[] = [];
  for (const group of groups) {
    const memberIds = group.memberIds.filter((id) => topLevel.has(id));
    if (memberIds.length >= 2) {
      living.push({ id: group.id, memberIds });
    }
  }
  return living;
}

/** 直列化用に document へ生存グループを書き込む。生存グループが無ければキーごと外す
    （groups: [] を残さない） */
export function embedGroups(
  document: IrDocument,
  groups: readonly ElementGroup[],
): IrDocument {
  const living = livingGroups(groups, document);
  if (living.length === 0) {
    if (document.groups === undefined) {
      return document;
    }
    const { groups: _groups, ...rest } = document;
    return rest;
  }
  return { ...document, groups: living };
}

/** id が属する生存グループ（なければ null） */
export function groupContaining(
  groups: readonly ElementGroup[],
  document: IrDocument,
  id: string,
): ElementGroup | null {
  for (const group of livingGroups(groups, document)) {
    if (group.memberIds.includes(id)) {
      return group;
    }
  }
  return null;
}

/** ids をグループ単位に展開した id 集合（重複除去、元の順序を優先し追加分は後置） */
export function expandIdsToGroups(
  groups: readonly ElementGroup[],
  document: IrDocument,
  ids: readonly string[],
): readonly string[] {
  const living = livingGroups(groups, document);
  const result: string[] = [];
  const seen = new Set<string>();
  const add = (id: string): void => {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  };
  for (const id of ids) {
    add(id);
  }
  for (const id of ids) {
    const group = living.find((g) => g.memberIds.includes(id));
    if (group === undefined) {
      continue;
    }
    for (const memberId of group.memberIds) {
      add(memberId);
    }
  }
  return result;
}

function claimGroupId(groups: readonly ElementGroup[]): string {
  const used = new Set(groups.map((g) => g.id));
  let n = 1;
  while (used.has(`group${n}`)) {
    n += 1;
  }
  return `group${n}`;
}

/** memberIds で新グループを作る。既存グループに属すメンバーは旧グループから抜く。
    id は "group<n>" の最小空き番号（既存リスト基準） */
export function createGroupFrom(
  groups: readonly ElementGroup[],
  memberIds: readonly string[],
): readonly ElementGroup[] {
  const movingIds = new Set(memberIds);
  const trimmed = groups.map((g) => {
    const remaining = g.memberIds.filter((id) => !movingIds.has(id));
    return remaining.length === g.memberIds.length
      ? g
      : { ...g, memberIds: remaining };
  });
  const id = claimGroupId(trimmed);
  return [...trimmed, { id, memberIds }];
}

/** ids と交差するグループを取り除く */
export function dissolveGroupsOf(
  groups: readonly ElementGroup[],
  ids: readonly string[],
): readonly ElementGroup[] {
  const idSet = new Set(ids);
  return groups.filter((g) => !g.memberIds.some((id) => idSet.has(id)));
}
