import { describe, expect, it } from "vitest";
import type { SampleScenarioSet } from "./sample-scenarios";
import {
  activeSampleJson,
  addScenario,
  defaultScenarioSet,
  duplicateActiveScenario,
  parseSampleDataStorage,
  removeScenario,
  renameScenario,
  selectScenario,
  serializeSampleDataStorage,
  updateActiveJson,
} from "./sample-scenarios";

function setOf(
  items: readonly { id: string; name: string; json: string }[],
  activeId: string,
): SampleScenarioSet {
  return { items, activeId };
}

describe("defaultScenarioSet", () => {
  it("既定は「シナリオ 1」1件で、指定した json を引き継ぐ", () => {
    expect(defaultScenarioSet()).toEqual({
      items: [{ id: "s1", name: "シナリオ 1", json: "" }],
      activeId: "s1",
    });
    expect(defaultScenarioSet('{"a": 1}')).toEqual({
      items: [{ id: "s1", name: "シナリオ 1", json: '{"a": 1}' }],
      activeId: "s1",
    });
  });
});

describe("activeSampleJson", () => {
  it("activeId の json を返す", () => {
    const set = setOf(
      [
        { id: "s1", name: "シナリオ 1", json: "a" },
        { id: "s2", name: "シナリオ 2", json: "b" },
      ],
      "s2",
    );
    expect(activeSampleJson(set)).toBe("b");
  });
});

describe("selectScenario", () => {
  const set = setOf(
    [
      { id: "s1", name: "シナリオ 1", json: "a" },
      { id: "s2", name: "シナリオ 2", json: "b" },
    ],
    "s1",
  );

  it("存在する id へ切り替える", () => {
    expect(selectScenario(set, "s2")).toEqual({ ...set, activeId: "s2" });
  });

  it("同一 id・存在しない id は同一参照を返す（no-op）", () => {
    expect(selectScenario(set, "s1")).toBe(set);
    expect(selectScenario(set, "s9")).toBe(set);
  });
});

describe("addScenario", () => {
  it("空 json の新規シナリオを作りアクティブにする", () => {
    const set = defaultScenarioSet('{"a": 1}');
    const next = addScenario(set);
    expect(next.items).toHaveLength(2);
    expect(next.activeId).toBe(next.items[1]?.id);
    expect(next.items[1]).toEqual({ id: "s2", name: "シナリオ 2", json: "" });
    // 既存シナリオは変わらない
    expect(next.items[0]).toEqual(set.items[0]);
  });

  it("既存名と衝突しない最小の正整数で「シナリオ N」を採番する", () => {
    const set = setOf(
      [
        { id: "s1", name: "シナリオ 3", json: "" },
        { id: "s2", name: "シナリオ 1", json: "" },
      ],
      "s1",
    );
    const next = addScenario(set);
    expect(next.items[2]?.name).toBe("シナリオ 2");
  });

  it("id は未使用の最小の正整数から採番する（欠番を埋める）", () => {
    const set = setOf(
      [
        { id: "s1", name: "A", json: "" },
        { id: "s3", name: "B", json: "" },
      ],
      "s1",
    );
    const next = addScenario(set);
    expect(next.items[2]?.id).toBe("s2");
  });
});

describe("duplicateActiveScenario", () => {
  it("アクティブシナリオの json を引き継ぎ「〜 のコピー」名でアクティブにする", () => {
    const set = setOf(
      [
        { id: "s1", name: "シナリオ 1", json: "a" },
        { id: "s2", name: "行数多", json: "b" },
      ],
      "s2",
    );
    const next = duplicateActiveScenario(set);
    expect(next.items).toHaveLength(3);
    expect(next.activeId).toBe(next.items[2]?.id);
    expect(next.items[2]).toEqual({
      id: "s3",
      name: "行数多 のコピー",
      json: "b",
    });
  });
});

describe("removeScenario", () => {
  it("最後の1件は no-op（同一参照）", () => {
    const set = defaultScenarioSet();
    expect(removeScenario(set, "s1")).toBe(set);
  });

  it("存在しない id は no-op（同一参照）", () => {
    const set = setOf(
      [
        { id: "s1", name: "A", json: "" },
        { id: "s2", name: "B", json: "" },
      ],
      "s1",
    );
    expect(removeScenario(set, "s9")).toBe(set);
  });

  it("非アクティブの削除は activeId をそのまま維持する", () => {
    const set = setOf(
      [
        { id: "s1", name: "A", json: "" },
        { id: "s2", name: "B", json: "" },
      ],
      "s1",
    );
    const next = removeScenario(set, "s2");
    expect(next).toEqual({
      items: [{ id: "s1", name: "A", json: "" }],
      activeId: "s1",
    });
  });

  it("アクティブ削除時、末尾以外なら直後がアクティブになる", () => {
    const set = setOf(
      [
        { id: "s1", name: "A", json: "" },
        { id: "s2", name: "B", json: "" },
        { id: "s3", name: "C", json: "" },
      ],
      "s2",
    );
    const next = removeScenario(set, "s2");
    expect(next.items.map((i) => i.id)).toEqual(["s1", "s3"]);
    expect(next.activeId).toBe("s3");
  });

  it("アクティブ削除時、末尾なら直前がアクティブになる", () => {
    const set = setOf(
      [
        { id: "s1", name: "A", json: "" },
        { id: "s2", name: "B", json: "" },
        { id: "s3", name: "C", json: "" },
      ],
      "s3",
    );
    const next = removeScenario(set, "s3");
    expect(next.items.map((i) => i.id)).toEqual(["s1", "s2"]);
    expect(next.activeId).toBe("s2");
  });
});

describe("renameScenario", () => {
  const set = setOf([{ id: "s1", name: "シナリオ 1", json: "" }], "s1");

  it("対象シナリオの name を書き換える", () => {
    expect(renameScenario(set, "s1", "行数多")).toEqual({
      items: [{ id: "s1", name: "行数多", json: "" }],
      activeId: "s1",
    });
  });

  it("同じ名前・存在しない id は同一参照を返す（no-op）", () => {
    expect(renameScenario(set, "s1", "シナリオ 1")).toBe(set);
    expect(renameScenario(set, "s9", "行数多")).toBe(set);
  });
});

describe("updateActiveJson", () => {
  const set = setOf(
    [
      { id: "s1", name: "A", json: "a" },
      { id: "s2", name: "B", json: "b" },
    ],
    "s2",
  );

  it("アクティブシナリオの json のみを書き換える", () => {
    const next = updateActiveJson(set, "b2");
    expect(next.items[0]).toEqual(set.items[0]);
    expect(next.items[1]).toEqual({ id: "s2", name: "B", json: "b2" });
  });

  it("同一 json は同一参照を返す（no-op）", () => {
    expect(updateActiveJson(set, "b")).toBe(set);
  });
});

describe("parseSampleDataStorage / serializeSampleDataStorage", () => {
  it("往復で同値になる", () => {
    const set = setOf(
      [
        { id: "s1", name: "シナリオ 1", json: '{"a": 1}' },
        { id: "s2", name: "行数多", json: "" },
      ],
      "s2",
    );
    expect(parseSampleDataStorage(serializeSampleDataStorage(set))).toEqual(
      set,
    );
  });

  it("レガシー生 JSON をシナリオ1件へ移行する", () => {
    const raw = '{"customerName": "甲"}';
    expect(parseSampleDataStorage(raw)).toEqual(defaultScenarioSet(raw));
  });

  it("不正 JSON・空文字列もシナリオ1件へ移行する", () => {
    expect(parseSampleDataStorage("{oops")).toEqual(
      defaultScenarioSet("{oops"),
    );
    expect(parseSampleDataStorage("")).toEqual(defaultScenarioSet(""));
  });

  it("format・version が一致しない JSON はレガシー扱いで移行する", () => {
    const raw = JSON.stringify({
      format: "denreport-sample-scenarios",
      version: 2,
    });
    expect(parseSampleDataStorage(raw)).toEqual(defaultScenarioSet(raw));
  });

  it("形状不正な封筒（scenarios 空・activeId 不在等）は既定セットに落ちる", () => {
    const emptyScenarios = JSON.stringify({
      format: "denreport-sample-scenarios",
      version: 1,
      activeId: "s1",
      scenarios: [],
    });
    expect(parseSampleDataStorage(emptyScenarios)).toEqual(
      defaultScenarioSet(),
    );

    const danglingActiveId = JSON.stringify({
      format: "denreport-sample-scenarios",
      version: 1,
      activeId: "s9",
      scenarios: [{ id: "s1", name: "シナリオ 1", json: "" }],
    });
    expect(parseSampleDataStorage(danglingActiveId)).toEqual(
      defaultScenarioSet(),
    );

    const malformedItem = JSON.stringify({
      format: "denreport-sample-scenarios",
      version: 1,
      activeId: "s1",
      scenarios: [{ id: "s1", name: "シナリオ 1" }],
    });
    expect(parseSampleDataStorage(malformedItem)).toEqual(defaultScenarioSet());
  });
});
