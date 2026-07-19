import type { CompatFinding } from "@denreport/core";
import { describe, expect, it } from "vitest";
import { groupCompatFindings } from "./export-warnings";

function finding(overrides: Partial<CompatFinding>): CompatFinding {
  return {
    target: "pdfme",
    level: "approximated",
    elementId: "el",
    elementType: "text",
    path: "elements[0]",
    note: "近似の理由",
    userMessage: "近似の平易文",
    ...overrides,
  };
}

describe("groupCompatFindings", () => {
  it("空入力で空配列を返す", () => {
    expect(groupCompatFindings([])).toEqual([]);
  });

  it("(level, userMessage) ごとに集約する", () => {
    const groups = groupCompatFindings([
      finding({ elementId: "a", userMessage: "理由X" }),
      finding({ elementId: "b", userMessage: "理由Y" }),
      finding({ elementId: "c", userMessage: "理由X" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.userMessage).toBe("理由X");
    expect(groups[0]?.elementIds).toEqual(["a", "c"]);
    expect(groups[1]?.userMessage).toBe("理由Y");
    expect(groups[1]?.elementIds).toEqual(["b"]);
  });

  it("同じ userMessage でも level が違えば別グループになる", () => {
    const groups = groupCompatFindings([
      finding({ elementId: "a", level: "approximated", userMessage: "同文" }),
      finding({ elementId: "b", level: "unsupported", userMessage: "同文" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.level)).toEqual(["unsupported", "approximated"]);
  });

  it("elementIds は出現順を保ち重複を除く", () => {
    const groups = groupCompatFindings([
      finding({ elementId: "b", path: "elements[0]" }),
      finding({ elementId: "a", path: "elements[1]" }),
      finding({ elementId: "b", path: "elements[2]", attribute: "thickness" }),
    ]);
    expect(groups[0]?.elementIds).toEqual(["b", "a"]);
  });

  it("findingCount は属性判定を含む延べ数になる", () => {
    const groups = groupCompatFindings([
      finding({ elementId: "a" }),
      finding({ elementId: "a", attribute: "thickness" }),
      finding({ elementId: "b" }),
    ]);
    expect(groups[0]?.findingCount).toBe(3);
    expect(groups[0]?.elementIds).toEqual(["a", "b"]);
  });

  it("unsupported のグループが先頭に来て、同レベル内は初出順を保つ", () => {
    const groups = groupCompatFindings([
      finding({ elementId: "a", level: "approximated", userMessage: "近似1" }),
      finding({ elementId: "b", level: "unsupported", userMessage: "非対応1" }),
      finding({ elementId: "c", level: "approximated", userMessage: "近似2" }),
      finding({ elementId: "d", level: "unsupported", userMessage: "非対応2" }),
    ]);
    expect(groups.map((g) => `${g.level}:${g.userMessage}`)).toEqual([
      "unsupported:非対応1",
      "unsupported:非対応2",
      "approximated:近似1",
      "approximated:近似2",
    ]);
  });
});
