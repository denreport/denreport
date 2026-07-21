import { describe, expect, it } from "vitest";
import { ja } from "../i18n/messages/ja";
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

function scenarioSet(json = ""): SampleScenarioSet {
  return defaultScenarioSet(json, ja.scenarioNames);
}

function add(set: SampleScenarioSet): SampleScenarioSet {
  return addScenario(set, ja.scenarioNames);
}

function duplicate(set: SampleScenarioSet): SampleScenarioSet {
  return duplicateActiveScenario(set, ja.scenarioNames);
}

function parseStorage(raw: string): SampleScenarioSet {
  return parseSampleDataStorage(raw, ja.scenarioNames);
}

describe("defaultScenarioSet", () => {
  it("defaults to a single 「シナリオ 1」 item, carrying over the given json", () => {
    expect(scenarioSet()).toEqual({
      items: [{ id: "s1", name: "シナリオ 1", json: "" }],
      activeId: "s1",
    });
    expect(scenarioSet('{"a": 1}')).toEqual({
      items: [{ id: "s1", name: "シナリオ 1", json: '{"a": 1}' }],
      activeId: "s1",
    });
  });
});

describe("activeSampleJson", () => {
  it("returns the json for activeId", () => {
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

  it("switches to an existing id", () => {
    expect(selectScenario(set, "s2")).toEqual({ ...set, activeId: "s2" });
  });

  it("returns the same reference for the same id or a nonexistent id (no-op)", () => {
    expect(selectScenario(set, "s1")).toBe(set);
    expect(selectScenario(set, "s9")).toBe(set);
  });
});

describe("addScenario", () => {
  it("creates and activates a new scenario with empty json", () => {
    const set = scenarioSet('{"a": 1}');
    const next = add(set);
    expect(next.items).toHaveLength(2);
    expect(next.activeId).toBe(next.items[1]?.id);
    expect(next.items[1]).toEqual({ id: "s2", name: "シナリオ 2", json: "" });
    // Existing scenarios are unchanged
    expect(next.items[0]).toEqual(set.items[0]);
  });

  it("numbers new scenarios 「シナリオ N」 using the smallest positive integer that avoids a name collision", () => {
    const set = setOf(
      [
        { id: "s1", name: "シナリオ 3", json: "" },
        { id: "s2", name: "シナリオ 1", json: "" },
      ],
      "s1",
    );
    const next = add(set);
    expect(next.items[2]?.name).toBe("シナリオ 2");
  });

  it("numbers ids from the smallest unused positive integer (filling gaps)", () => {
    const set = setOf(
      [
        { id: "s1", name: "A", json: "" },
        { id: "s3", name: "B", json: "" },
      ],
      "s1",
    );
    const next = add(set);
    expect(next.items[2]?.id).toBe("s2");
  });
});

describe("duplicateActiveScenario", () => {
  it("carries over the active scenario's json and activates it with a 「〜 のコピー」name", () => {
    const set = setOf(
      [
        { id: "s1", name: "シナリオ 1", json: "a" },
        { id: "s2", name: "行数多", json: "b" },
      ],
      "s2",
    );
    const next = duplicate(set);
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
  it("no-ops (returns the same reference) for the last remaining item", () => {
    const set = scenarioSet();
    expect(removeScenario(set, "s1")).toBe(set);
  });

  it("no-ops (returns the same reference) for a nonexistent id", () => {
    const set = setOf(
      [
        { id: "s1", name: "A", json: "" },
        { id: "s2", name: "B", json: "" },
      ],
      "s1",
    );
    expect(removeScenario(set, "s9")).toBe(set);
  });

  it("keeps activeId unchanged when removing a non-active item", () => {
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

  it("activates the following item when removing the active item, if it isn't last", () => {
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

  it("activates the preceding item when removing the active item, if it's last", () => {
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

  it("rewrites the target scenario's name", () => {
    expect(renameScenario(set, "s1", "行数多")).toEqual({
      items: [{ id: "s1", name: "行数多", json: "" }],
      activeId: "s1",
    });
  });

  it("returns the same reference for the same name or a nonexistent id (no-op)", () => {
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

  it("rewrites only the active scenario's json", () => {
    const next = updateActiveJson(set, "b2");
    expect(next.items[0]).toEqual(set.items[0]);
    expect(next.items[1]).toEqual({ id: "s2", name: "B", json: "b2" });
  });

  it("returns the same reference for the same json (no-op)", () => {
    expect(updateActiveJson(set, "b")).toBe(set);
  });
});

describe("parseSampleDataStorage / serializeSampleDataStorage", () => {
  it("round-trips to an equal value", () => {
    const set = setOf(
      [
        { id: "s1", name: "シナリオ 1", json: '{"a": 1}' },
        { id: "s2", name: "行数多", json: "" },
      ],
      "s2",
    );
    expect(parseStorage(serializeSampleDataStorage(set))).toEqual(set);
  });

  it("migrates legacy raw JSON into a single scenario", () => {
    const raw = '{"customerName": "甲"}';
    expect(parseStorage(raw)).toEqual(scenarioSet(raw));
  });

  it("migrates invalid JSON or an empty string into a single scenario too", () => {
    expect(parseStorage("{oops")).toEqual(scenarioSet("{oops"));
    expect(parseStorage("")).toEqual(scenarioSet(""));
  });

  it("treats JSON with mismatched format/version as legacy and migrates it", () => {
    const raw = JSON.stringify({
      format: "denreport-sample-scenarios",
      version: 2,
    });
    expect(parseStorage(raw)).toEqual(scenarioSet(raw));
  });

  it("falls back to the default set for a malformed envelope (e.g. empty scenarios, missing activeId)", () => {
    const emptyScenarios = JSON.stringify({
      format: "denreport-sample-scenarios",
      version: 1,
      activeId: "s1",
      scenarios: [],
    });
    expect(parseStorage(emptyScenarios)).toEqual(scenarioSet());

    const danglingActiveId = JSON.stringify({
      format: "denreport-sample-scenarios",
      version: 1,
      activeId: "s9",
      scenarios: [{ id: "s1", name: "シナリオ 1", json: "" }],
    });
    expect(parseStorage(danglingActiveId)).toEqual(scenarioSet());

    const malformedItem = JSON.stringify({
      format: "denreport-sample-scenarios",
      version: 1,
      activeId: "s1",
      scenarios: [{ id: "s1", name: "シナリオ 1" }],
    });
    expect(parseStorage(malformedItem)).toEqual(scenarioSet());
  });
});
