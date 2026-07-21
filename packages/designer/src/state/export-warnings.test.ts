import type { CompatFinding } from "@denreport/core";
import { COMPAT_MATRICES } from "@denreport/core";
import { describe, expect, it } from "vitest";
import { EXPORT_TARGET_IDS, groupCompatFindings } from "./export-warnings";

describe("EXPORT_TARGET_IDS", () => {
  it("contains exactly all keys of COMPAT_MATRICES", () => {
    expect([...EXPORT_TARGET_IDS].sort()).toEqual(
      Object.keys(COMPAT_MATRICES).sort(),
    );
  });
});

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
  it("returns an empty array for empty input", () => {
    expect(groupCompatFindings([])).toEqual([]);
  });

  it("aggregates by (level, userMessage)", () => {
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

  it("forms separate groups when level differs even with the same userMessage", () => {
    const groups = groupCompatFindings([
      finding({ elementId: "a", level: "approximated", userMessage: "同文" }),
      finding({ elementId: "b", level: "unsupported", userMessage: "同文" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.level)).toEqual(["unsupported", "approximated"]);
  });

  it("elementIds preserves order of appearance and removes duplicates", () => {
    const groups = groupCompatFindings([
      finding({ elementId: "b", path: "elements[0]" }),
      finding({ elementId: "a", path: "elements[1]" }),
      finding({ elementId: "b", path: "elements[2]", attribute: "thickness" }),
    ]);
    expect(groups[0]?.elementIds).toEqual(["b", "a"]);
  });

  it("findingCount is a total count that includes attribute-level findings", () => {
    const groups = groupCompatFindings([
      finding({ elementId: "a" }),
      finding({ elementId: "a", attribute: "thickness" }),
      finding({ elementId: "b" }),
    ]);
    expect(groups[0]?.findingCount).toBe(3);
    expect(groups[0]?.elementIds).toEqual(["a", "b"]);
  });

  it("unsupported groups come first, and order of first appearance is preserved within the same level", () => {
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
