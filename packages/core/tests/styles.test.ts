import { describe, expect, it } from "vitest";
import { applicableStyleAttrs, STYLEABLE_ATTRS } from "../src/ir/styles";
import type { IrElementType } from "../src/ir/types";

const ALL_TYPES: readonly IrElementType[] = [
  "text",
  "line",
  "rect",
  "table",
  "image",
  "flex",
  "pageNumber",
];

describe("STYLEABLE_ATTRS", () => {
  it("has an entry for every element type", () => {
    for (const type of ALL_TYPES) {
      expect(STYLEABLE_ATTRS[type]).toBeDefined();
    }
  });

  it("image and flex have no styleable attributes", () => {
    expect(STYLEABLE_ATTRS.image).toEqual([]);
    expect(STYLEABLE_ATTRS.flex).toEqual([]);
  });

  it.each([
    [
      "text",
      [
        "fontSize",
        "align",
        "lineHeight",
        "fontWeight",
        "fontStyle",
        "underline",
      ],
    ],
    ["pageNumber", ["fontSize", "align", "lineHeight"]],
    ["table", ["fontSize"]],
    ["rect", ["borderWidth"]],
    ["line", ["thickness"]],
  ] as const)("%s maps to %j", (type, attrs) => {
    expect(applicableStyleAttrs(type)).toEqual(attrs);
  });
});
