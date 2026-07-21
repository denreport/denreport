import type { IrDocument, IrError, IrFlexElement } from "@denreport/core";
import { describe, expect, it } from "vitest";
import {
  errorElementIds,
  errorMessageFor,
  errorsByElement,
} from "./error-index";

const FLEX: IrFlexElement = {
  type: "flex",
  id: "f1",
  x: 10,
  y: 10,
  pages: "first",
  direction: "column",
  gap: 0,
  justifyContent: "start",
  alignItems: "start",
  children: [
    {
      type: "flex",
      id: "f2",
      direction: "row",
      gap: 0,
      justifyContent: "start",
      alignItems: "start",
      children: [
        {
          type: "rect",
          id: "r1",
          w: 5,
          h: 5,
          borderWidth: 0.3,
        },
      ],
    },
  ],
};

const DOC: IrDocument = {
  version: "1.0",
  page: { width: 210, height: 297 },
  font: { regular: "NotoSansJP" },
  elements: [
    {
      type: "text",
      id: "t1",
      x: 0,
      y: 0,
      pages: "first",
      w: 10,
      h: 5,
      text: "a",
      fontSize: 10,
      align: "left",
      lineHeight: 1.25,
    },
    FLEX,
  ],
};

function err(path: string): IrError {
  return { rule: "M02", path, message: "テスト用" };
}

describe("errorElementIds", () => {
  it("resolves elements[i] and attribute-qualified paths to a top-level element's id", () => {
    expect(errorElementIds(DOC, [err("elements[0]")])).toEqual(new Set(["t1"]));
    expect(errorElementIds(DOC, [err("elements[0].fontSize")])).toEqual(
      new Set(["t1"]),
    );
  });

  it("resolves nested children paths to a child element's id", () => {
    expect(errorElementIds(DOC, [err("elements[1].children[0]")])).toEqual(
      new Set(["f2"]),
    );
    expect(
      errorElementIds(DOC, [err("elements[1].children[0].children[0].w")]),
    ).toEqual(new Set(["r1"]));
  });

  it("ignores paths that don't correspond to an element (root, page, out of range)", () => {
    const errors = [
      err(""),
      err("page.width"),
      err("version"),
      err("elements[9]"),
      err("elements[0].children[0]"),
    ];
    expect(errorElementIds(DOC, errors)).toEqual(new Set());
  });

  it("collects multiple errors into a set of ids", () => {
    const ids = errorElementIds(DOC, [
      err("elements[0].w"),
      err("elements[0].h"),
      err("elements[1]"),
    ]);
    expect(ids).toEqual(new Set(["t1", "f1"]));
  });
});

describe("errorsByElement", () => {
  it("groups by element id and excludes paths that don't correspond to an element", () => {
    const errors = [
      err("elements[0].w"),
      err("elements[0].h"),
      err("elements[1].children[0].children[0].w"),
      err("page.width"),
    ];
    const map = errorsByElement(DOC, errors);
    expect(map.size).toBe(2);
    expect(map.get("t1")).toEqual([errors[0], errors[1]]);
    expect(map.get("r1")).toEqual([errors[2]]);
  });
});

describe("errorMessageFor", () => {
  const errors: readonly IrError[] = [
    { rule: "M04", path: "elements[0].fontSize", message: "fontSize が範囲外" },
    { rule: "M06", path: "elements[2].columns[1].key", message: "key が重複" },
  ];

  it("returns the first message on a path suffix match", () => {
    expect(errorMessageFor(errors, "fontSize")).toBe("fontSize が範囲外");
    expect(errorMessageFor(errors, "columns[1].key")).toBe("key が重複");
  });

  it("returns undefined for an attrPath that doesn't match", () => {
    expect(errorMessageFor(errors, "w")).toBeUndefined();
    expect(errorMessageFor(errors, "Size")).toBeUndefined();
  });
});
