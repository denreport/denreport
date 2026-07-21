import type { IrDocument, IrTextElement } from "@denreport/core";
import { describe, expect, it } from "vitest";
import type { ElementGroup } from "./groups";
import {
  createGroupFrom,
  dissolveGroupsOf,
  embedGroups,
  expandIdsToGroups,
  groupContaining,
  livingGroups,
} from "./groups";

function textElement(id: string): IrTextElement {
  return {
    type: "text",
    id,
    x: 10,
    y: 10,
    pages: "first",
    w: 40,
    h: 8,
    text: id,
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  };
}

function makeDocument(ids: readonly string[]): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements: ids.map(textElement),
  };
}

describe("createGroupFrom", () => {
  it("numbers from group1, avoiding ids of existing groups", () => {
    const first = createGroupFrom([], ["a", "b"]);
    expect(first).toEqual([{ id: "group1", memberIds: ["a", "b"] }]);

    const second = createGroupFrom(first, ["c", "d"]);
    expect(second).toEqual([
      { id: "group1", memberIds: ["a", "b"] },
      { id: "group2", memberIds: ["c", "d"] },
    ]);
  });

  it("members that belong to an existing group are removed from the old group", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b", "c"] },
    ];
    const next = createGroupFrom(groups, ["a", "d"]);
    expect(next).toEqual([
      { id: "group1", memberIds: ["b", "c"] },
      { id: "group2", memberIds: ["a", "d"] },
    ]);
  });

  it("when pulling a member drops the old group's living members below 2, it disappears from livingGroups", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b"] },
    ];
    const next = createGroupFrom(groups, ["a", "c"]);
    const doc = makeDocument(["a", "b", "c"]);
    expect(livingGroups(next, doc).map((g) => g.id)).toEqual(["group2"]);
  });
});

describe("dissolveGroupsOf", () => {
  it("removes groups that intersect with ids", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b"] },
      { id: "group2", memberIds: ["c", "d"] },
    ];
    expect(dissolveGroupsOf(groups, ["b"])).toEqual([
      { id: "group2", memberIds: ["c", "d"] },
    ]);
  });

  it("leaves things unchanged when there's no intersection", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b"] },
    ];
    expect(dissolveGroupsOf(groups, ["z"])).toEqual(groups);
  });
});

describe("livingGroups", () => {
  it("excludes dangling ids (not present in the document)", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b", "ghost"] },
    ];
    const doc = makeDocument(["a", "b"]);
    expect(livingGroups(groups, doc)).toEqual([
      { id: "group1", memberIds: ["a", "b"] },
    ]);
  });

  it("excludes groups with fewer than 2 living members", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "ghost1", "ghost2"] },
    ];
    const doc = makeDocument(["a"]);
    expect(livingGroups(groups, doc)).toEqual([]);
  });

  it("does not mutate the raw argument list", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "ghost"] },
    ];
    const doc = makeDocument(["a"]);
    livingGroups(groups, doc);
    expect(groups).toEqual([{ id: "group1", memberIds: ["a", "ghost"] }]);
  });
});

describe("embedGroups", () => {
  it("writes living groups to document.groups", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b"] },
    ];
    const doc = makeDocument(["a", "b"]);
    expect(embedGroups(doc, groups).groups).toEqual([
      { id: "group1", memberIds: ["a", "b"] },
    ]);
  });

  it("does not embed groups with fewer than 2 living members", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "ghost"] },
    ];
    const doc = makeDocument(["a"]);
    expect(embedGroups(doc, groups)).not.toHaveProperty("groups");
  });

  it("removes the document.groups key entirely when there are no living groups", () => {
    const groups: readonly ElementGroup[] = [];
    const doc: IrDocument = {
      ...makeDocument(["a"]),
      groups: [{ id: "stale", memberIds: ["a", "b"] }],
    };
    expect(embedGroups(doc, groups)).not.toHaveProperty("groups");
  });

  it("returns the same reference when there's no groups key to begin with and no living groups", () => {
    const doc = makeDocument(["a"]);
    expect(embedGroups(doc, [])).toBe(doc);
  });
});

describe("groupContaining", () => {
  it("returns the living group that id belongs to", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b"] },
    ];
    const doc = makeDocument(["a", "b"]);
    expect(groupContaining(groups, doc, "b")).toEqual({
      id: "group1",
      memberIds: ["a", "b"],
    });
  });

  it("returns null for an id that doesn't belong to any group", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b"] },
    ];
    const doc = makeDocument(["a", "b", "c"]);
    expect(groupContaining(groups, doc, "c")).toBeNull();
  });

  it("treats a group with fewer than 2 living members as not containing the id", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "ghost"] },
    ];
    const doc = makeDocument(["a"]);
    expect(groupContaining(groups, doc, "a")).toBeNull();
  });
});

describe("expandIdsToGroups", () => {
  it("passes through an id that isn't in any group unchanged", () => {
    const doc = makeDocument(["a", "b"]);
    expect(expandIdsToGroups([], doc, ["a"])).toEqual(["a"]);
  });

  it("expands an id that belongs to a group into all its members", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b"] },
    ];
    const doc = makeDocument(["a", "b", "c"]);
    expect(expandIdsToGroups(groups, doc, ["a"])).toEqual(["a", "b"]);
  });

  it("dedupes and appends additions after the original order", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b"] },
    ];
    const doc = makeDocument(["a", "b", "c"]);
    expect(expandIdsToGroups(groups, doc, ["b", "a", "c"])).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(expandIdsToGroups(groups, doc, ["b", "c"])).toEqual(["b", "c", "a"]);
  });
});
