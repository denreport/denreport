import { describe, expect, it } from "vitest";
import { checkCompat } from "../src/compat/check";
import type { TargetCompatMatrix } from "../src/compat/types";
import type {
  IrDocument,
  IrFlexChild,
  IrFlexElement,
  IrLineElement,
  IrRectElement,
  IrTableElement,
  IrTextElement,
} from "../src/ir/types";

function doc(...elements: IrDocument["elements"]): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements,
  };
}

function textWithText(id: string): IrTextElement {
  return {
    type: "text",
    id,
    x: 0,
    y: 0,
    pages: "first",
    w: 10,
    h: 10,
    text: "hello",
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  };
}

function textChild(id: string): IrFlexChild {
  return {
    type: "text",
    id,
    w: 10,
    h: 10,
    text: "hello",
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  };
}

function tableEl(
  id: string,
  overrides: Partial<IrTableElement> = {},
): IrTableElement {
  return {
    type: "table",
    id,
    x: 0,
    y: 0,
    bind: "items",
    columns: [{ key: "name", label: "Name", width: 10, align: "left" }],
    rowHeight: 10,
    headerHeight: 10,
    fontSize: 10,
    maxY: 297,
    continuationY: 0,
    minRows: 0,
    ...overrides,
  };
}

function lineEl(id: string): IrLineElement {
  return {
    type: "line",
    id,
    x: 0,
    y: 0,
    pages: "first",
    orientation: "horizontal",
    length: 10,
    thickness: 0.3,
  };
}

function rectEl(id: string): IrRectElement {
  return {
    type: "rect",
    id,
    x: 0,
    y: 0,
    pages: "first",
    w: 10,
    h: 10,
    borderWidth: 0.3,
  };
}

function flexWithChildren(
  id: string,
  children: readonly IrFlexChild[],
  overrides: Partial<Pick<IrFlexElement, "w">> = {},
): IrFlexElement {
  return {
    type: "flex",
    id,
    x: 0,
    y: 0,
    pages: "first",
    direction: "row",
    gap: 0,
    justifyContent: "start",
    alignItems: "start",
    children,
    ...overrides,
  };
}

const matrix: TargetCompatMatrix = {
  target: "pdfme",
  displayName: "pdfme",
  elements: {
    text: {
      element: {
        level: "approximated",
        note: "text-approx",
        userMessage: () => "text-approx-message",
      },
      attributes: {
        lineHeight: {
          level: "approximated",
          note: "text-lineHeight-approx",
          userMessage: () => "text-lineHeight-approx-message",
        },
        pages: {
          level: "approximated",
          note: "text-pages-approx",
          userMessage: () => "text-pages-approx-message",
        },
      },
    },
    line: {
      element: {
        level: "unsupported",
        note: "line-unsupported",
        userMessage: () => "line-unsupported-message",
      },
      attributes: {
        thickness: {
          level: "approximated",
          note: "should-not-fire",
          userMessage: () => "should-not-fire-message",
        },
      },
    },
    rect: { element: { level: "supported" } },
    ellipse: { element: { level: "supported" } },
    table: {
      element: { level: "supported" },
      attributes: {
        cellOverrides: {
          level: "approximated",
          note: "table-cellOverrides-approx",
          userMessage: () => "table-cellOverrides-approx-message",
        },
      },
    },
    image: { element: { level: "supported" } },
    flex: {
      element: { level: "supported" },
      attributes: {
        w: {
          level: "approximated",
          note: "flex-w-approx",
          userMessage: () => "flex-w-approx-message",
        },
      },
    },
    pageNumber: { element: { level: "supported" } },
    barcode: { element: { level: "supported" } },
  },
};

const allSupportedMatrix: TargetCompatMatrix = {
  target: "pdfme",
  displayName: "pdfme",
  elements: {
    text: { element: { level: "supported" } },
    line: { element: { level: "supported" } },
    rect: { element: { level: "supported" } },
    ellipse: { element: { level: "supported" } },
    table: { element: { level: "supported" } },
    image: { element: { level: "supported" } },
    flex: { element: { level: "supported" } },
    pageNumber: { element: { level: "supported" } },
    barcode: { element: { level: "supported" } },
  },
};

const matrixWithUnsupportedFlex: TargetCompatMatrix = {
  ...matrix,
  elements: {
    ...matrix.elements,
    flex: {
      element: {
        level: "unsupported",
        note: "flex-unsupported",
        userMessage: () => "flex-unsupported-message",
      },
    },
  },
};

describe("checkCompat", () => {
  it("returns no findings when every element and attribute is supported", () => {
    const document = doc(
      rectEl("r1"),
      flexWithChildren("f1", [textChild("t1")]),
    );
    expect(checkCompat(document, allSupportedMatrix)).toEqual([]);
  });

  it("reports an approximated element-level finding, with attribute findings appended", () => {
    const document = doc(textWithText("t1"));
    const findings = checkCompat(document, matrix);
    expect(findings).toEqual([
      {
        target: "pdfme",
        level: "approximated",
        elementId: "t1",
        elementType: "text",
        path: "elements[0]",
        note: "text-approx",
        userMessage: "text-approx-message",
      },
      {
        target: "pdfme",
        level: "approximated",
        elementId: "t1",
        elementType: "text",
        path: "elements[0].lineHeight",
        attribute: "lineHeight",
        note: "text-lineHeight-approx",
        userMessage: "text-lineHeight-approx-message",
      },
      {
        target: "pdfme",
        level: "approximated",
        elementId: "t1",
        elementType: "text",
        path: "elements[0].pages",
        attribute: "pages",
        note: "text-pages-approx",
        userMessage: "text-pages-approx-message",
      },
    ]);
  });

  it("reports an unsupported element-level finding and skips its attribute checks", () => {
    const document = doc(lineEl("l1"));
    const findings = checkCompat(document, matrix);
    expect(findings).toEqual([
      {
        target: "pdfme",
        level: "unsupported",
        elementId: "l1",
        elementType: "line",
        path: "elements[0]",
        note: "line-unsupported",
        userMessage: "line-unsupported-message",
      },
    ]);
  });

  it("skips the children of an unsupported flex container", () => {
    const document = doc(flexWithChildren("f1", [textChild("t1")]));
    const findings = checkCompat(document, matrixWithUnsupportedFlex);
    expect(findings).toEqual([
      {
        target: "pdfme",
        level: "unsupported",
        elementId: "f1",
        elementType: "flex",
        path: "elements[0]",
        note: "flex-unsupported",
        userMessage: "flex-unsupported-message",
      },
    ]);
  });

  it("fires an attribute finding only when the attribute is present (table.cellOverrides)", () => {
    const document = doc(
      tableEl("plain"),
      tableEl("withOverrides", {
        cellOverrides: [{ row: 0, key: "name", value: "x" }],
      }),
    );
    const findings = checkCompat(document, matrix);
    const overrideFindings = findings.filter(
      (f) => f.attribute === "cellOverrides",
    );
    expect(overrideFindings).toEqual([
      expect.objectContaining({
        elementId: "withOverrides",
        path: "elements[1].cellOverrides",
      }),
    ]);
  });

  it("fires the flex main-axis attribute finding only when the dimension is explicit", () => {
    const withW = flexWithChildren("explicit", [textChild("a")], {
      w: 20,
    });
    const withoutW = flexWithChildren("implicit", [textChild("b")]);
    const document = doc(withW, withoutW);
    const findings = checkCompat(document, matrix);
    const wFindings = findings.filter((f) => f.attribute === "w");
    expect(wFindings).toEqual([
      expect.objectContaining({ elementId: "explicit", path: "elements[0].w" }),
    ]);
  });

  it("does not fire a positional attribute finding on flex children (pages)", () => {
    const document = doc(flexWithChildren("f1", [textChild("t1")]));
    const findings = checkCompat(document, matrix);
    const pagesFindings = findings.filter((f) => f.attribute === "pages");
    expect(pagesFindings).toEqual([]);
  });

  it("uses a children[] path for nested flex descendants", () => {
    const inner = flexWithChildren("inner", [textChild("leaf")]);
    const outerChildren: readonly IrFlexChild[] = [inner];
    const outer: IrFlexElement = {
      type: "flex",
      id: "outer",
      x: 0,
      y: 0,
      pages: "first",
      direction: "column",
      gap: 0,
      justifyContent: "start",
      alignItems: "start",
      children: outerChildren,
    };
    const findings = checkCompat(doc(outer), matrix);
    const leafFinding = findings.find((f) => f.elementId === "leaf");
    expect(leafFinding).toMatchObject({
      path: "elements[0].children[0].children[0]",
    });
  });

  it("reports findings in document order, expanding a flex container in place", () => {
    const document = doc(
      textWithText("before"),
      flexWithChildren("f1", [textChild("child")]),
      textWithText("after"),
    );
    const findings = checkCompat(document, matrix);
    const order = [...new Set(findings.map((f) => f.elementId))];
    expect(order).toEqual(["before", "child", "after"]);
  });

  it("reports a separate finding for each instance of the same element type", () => {
    const document = doc(
      textWithText("a"),
      textWithText("b"),
      textWithText("c"),
    );
    const findings = checkCompat(document, matrix);
    const elementLevel = findings.filter((f) => f.attribute === undefined);
    expect(elementLevel.map((f) => f.elementId)).toEqual(["a", "b", "c"]);
  });
});
