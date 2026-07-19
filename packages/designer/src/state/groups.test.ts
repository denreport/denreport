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
    font: { name: "NotoSansJP" },
    elements: ids.map(textElement),
  };
}

describe("createGroupFrom", () => {
  it("group1 から採番し、既存グループの id を避ける", () => {
    const first = createGroupFrom([], ["a", "b"]);
    expect(first).toEqual([{ id: "group1", memberIds: ["a", "b"] }]);

    const second = createGroupFrom(first, ["c", "d"]);
    expect(second).toEqual([
      { id: "group1", memberIds: ["a", "b"] },
      { id: "group2", memberIds: ["c", "d"] },
    ]);
  });

  it("既存グループに属すメンバーは旧グループから抜ける", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b", "c"] },
    ];
    const next = createGroupFrom(groups, ["a", "d"]);
    expect(next).toEqual([
      { id: "group1", memberIds: ["b", "c"] },
      { id: "group2", memberIds: ["a", "d"] },
    ]);
  });

  it("引き抜きで旧グループの生存メンバーが2未満になると livingGroups から消える", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b"] },
    ];
    const next = createGroupFrom(groups, ["a", "c"]);
    const doc = makeDocument(["a", "b", "c"]);
    expect(livingGroups(next, doc).map((g) => g.id)).toEqual(["group2"]);
  });
});

describe("dissolveGroupsOf", () => {
  it("ids と交差するグループを取り除く", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b"] },
      { id: "group2", memberIds: ["c", "d"] },
    ];
    expect(dissolveGroupsOf(groups, ["b"])).toEqual([
      { id: "group2", memberIds: ["c", "d"] },
    ]);
  });

  it("交差しなければ変化しない", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b"] },
    ];
    expect(dissolveGroupsOf(groups, ["z"])).toEqual(groups);
  });
});

describe("livingGroups", () => {
  it("宙に浮いた id（文書に実在しない）を除外する", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b", "ghost"] },
    ];
    const doc = makeDocument(["a", "b"]);
    expect(livingGroups(groups, doc)).toEqual([
      { id: "group1", memberIds: ["a", "b"] },
    ]);
  });

  it("生存メンバーが2未満のグループを除く", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "ghost1", "ghost2"] },
    ];
    const doc = makeDocument(["a"]);
    expect(livingGroups(groups, doc)).toEqual([]);
  });

  it("引数の生リストは書き換えない", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "ghost"] },
    ];
    const doc = makeDocument(["a"]);
    livingGroups(groups, doc);
    expect(groups).toEqual([{ id: "group1", memberIds: ["a", "ghost"] }]);
  });
});

describe("embedGroups", () => {
  it("生存グループを document.groups へ書き込む", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b"] },
    ];
    const doc = makeDocument(["a", "b"]);
    expect(embedGroups(doc, groups).groups).toEqual([
      { id: "group1", memberIds: ["a", "b"] },
    ]);
  });

  it("生存メンバー2未満のグループは含めない", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "ghost"] },
    ];
    const doc = makeDocument(["a"]);
    expect(embedGroups(doc, groups)).not.toHaveProperty("groups");
  });

  it("生存グループが無ければ既存の document.groups キーごと外す", () => {
    const groups: readonly ElementGroup[] = [];
    const doc: IrDocument = {
      ...makeDocument(["a"]),
      groups: [{ id: "stale", memberIds: ["a", "b"] }],
    };
    expect(embedGroups(doc, groups)).not.toHaveProperty("groups");
  });

  it("groups キーが元々無く生存グループも無ければ同じ参照を返す", () => {
    const doc = makeDocument(["a"]);
    expect(embedGroups(doc, [])).toBe(doc);
  });
});

describe("groupContaining", () => {
  it("id が属する生存グループを返す", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b"] },
    ];
    const doc = makeDocument(["a", "b"]);
    expect(groupContaining(groups, doc, "b")).toEqual({
      id: "group1",
      memberIds: ["a", "b"],
    });
  });

  it("非所属 id には null を返す", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b"] },
    ];
    const doc = makeDocument(["a", "b", "c"]);
    expect(groupContaining(groups, doc, "c")).toBeNull();
  });

  it("生存メンバー2未満のグループには属さない扱いになる", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "ghost"] },
    ];
    const doc = makeDocument(["a"]);
    expect(groupContaining(groups, doc, "a")).toBeNull();
  });
});

describe("expandIdsToGroups", () => {
  it("非所属 id はそのまま素通しする", () => {
    const doc = makeDocument(["a", "b"]);
    expect(expandIdsToGroups([], doc, ["a"])).toEqual(["a"]);
  });

  it("グループ所属 id を全メンバーへ展開する", () => {
    const groups: readonly ElementGroup[] = [
      { id: "group1", memberIds: ["a", "b"] },
    ];
    const doc = makeDocument(["a", "b", "c"]);
    expect(expandIdsToGroups(groups, doc, ["a"])).toEqual(["a", "b"]);
  });

  it("重複を除去し、元の順序を優先して追加分は後置する", () => {
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
