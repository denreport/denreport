import type { IrDocument } from "@denreport/core";

export interface ElementGroup {
  /** "group1" format. Unique within the session */
  readonly id: string;
  /** Top-level element ids only. May contain ids that don't actually exist in the document (lazily resolved) */
  readonly memberIds: readonly string[];
}

function topLevelIds(document: IrDocument): ReadonlySet<string> {
  return new Set(document.elements.map((el) => el.id));
}

/** Returns only the groups that are alive in the current document.
    Narrows members to top-level elements that actually exist, and excludes groups with fewer than 2 living members */
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

/** Writes living groups into document for serialization. If there are no living groups, the
    key is removed entirely (never leaves groups: []) */
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

/** The living group id belongs to (null if none) */
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

/** The id set with ids expanded to their group members (deduplicated, original order preserved, additions appended after) */
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

/** Creates a new group from memberIds. Members belonging to an existing group are removed
    from that old group.
    id is the smallest free "group<n>" number (based on the existing list) */
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

/** Removes groups that intersect with ids */
export function dissolveGroupsOf(
  groups: readonly ElementGroup[],
  ids: readonly string[],
): readonly ElementGroup[] {
  const idSet = new Set(ids);
  return groups.filter((g) => !g.memberIds.some((id) => idSet.has(id)));
}
