import type {
  IrDocument,
  IrElement,
  IrFlexElement,
  IrTableElement,
} from "@denreport/core";
import { describe, expect, it } from "vitest";
import { ja } from "../../i18n/messages/ja";
import { layoutDocument } from "../../state/geometry";
import { defaultScenarioSet } from "../../state/sample-scenarios";
import type { EditorState, PageContext } from "../../state/types";
import {
  resolveInlineEditTarget,
  tableCellBox,
  tableHeaderCellBox,
} from "./inline-edit";
import type { InteractionContext, InteractionState } from "./interaction";
import { reduceInteraction } from "./interaction";

const FLEX: IrFlexElement = {
  type: "flex",
  id: "flex1",
  x: 20,
  y: 100,
  pages: "first",
  direction: "row",
  gap: 2,
  justifyContent: "start",
  alignItems: "start",
  children: [
    {
      type: "text",
      id: "childText",
      w: 40,
      h: 8,
      text: "child",
      fontSize: 10,
      align: "left",
      lineHeight: 1.25,
    },
  ],
};

const TABLE: IrTableElement = {
  type: "table",
  id: "tbl1",
  x: 10,
  y: 150,
  bind: "items",
  columns: [
    { key: "a", label: "A", width: 30, align: "left" },
    { key: "b", label: "B", width: 40, align: "left" },
  ],
  rowHeight: 6,
  headerHeight: 8,
  fontSize: 10,
  maxY: 280,
  continuationY: 20,
  minRows: 3,
};

const ELEMENTS: readonly IrElement[] = [
  {
    type: "text",
    id: "staticText",
    x: 10,
    y: 10,
    pages: "first",
    w: 40,
    h: 8,
    text: "hello",
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  },
  {
    type: "text",
    id: "tokenText",
    x: 10,
    y: 30,
    pages: "first",
    w: 40,
    h: 8,
    text: "{name}",
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  },
  {
    type: "text",
    id: "ghostText",
    x: 10,
    y: 50,
    pages: "last",
    w: 40,
    h: 8,
    text: "ghost",
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  },
  {
    type: "pageNumber",
    id: "pn1",
    x: 10,
    y: 70,
    pages: "all",
    w: 20,
    h: 6,
    format: "{page}",
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  },
  {
    type: "rect",
    id: "rect1",
    x: 60,
    y: 10,
    pages: "first",
    w: 20,
    h: 20,
    borderWidth: 0.3,
  },
  {
    type: "image",
    id: "img1",
    x: 90,
    y: 10,
    pages: "first",
    w: 20,
    h: 20,
    src: "x",
  },
  {
    type: "line",
    id: "line1",
    x: 10,
    y: 90,
    pages: "first",
    orientation: "horizontal",
    length: 20,
    thickness: 0.3,
  },
  FLEX,
  TABLE,
];

function makeLayout(pageContext: PageContext = "first") {
  const document: IrDocument = {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements: ELEMENTS,
  };
  return layoutDocument(document, pageContext);
}

describe("resolveInlineEditTarget", () => {
  it("a top-level static text becomes an edit target", () => {
    const layout = makeLayout();
    expect(
      resolveInlineEditTarget({
        layout,
        selection: [],
        pageContext: "first",
        elementId: "staticText",
        columnIndex: null,
        rowIndex: null,
      }),
    ).toEqual({ kind: "text", id: "staticText" });
  });

  it("text containing a {key} token also becomes an edit target", () => {
    const layout = makeLayout();
    expect(
      resolveInlineEditTarget({
        layout,
        selection: [],
        pageContext: "first",
        elementId: "tokenText",
        columnIndex: null,
        rowIndex: null,
      }),
    ).toEqual({ kind: "text", id: "tokenText" });
  });

  it.each(["pn1", "rect1", "img1", "line1", "flex1"])(
    "%s does not become a target",
    (id) => {
      const layout = makeLayout();
      expect(
        resolveInlineEditTarget({
          layout,
          selection: [],
          pageContext: "first",
          elementId: id,
          columnIndex: null,
          rowIndex: null,
        }),
      ).toBeNull();
    },
  );

  it("a flex child text becomes a target only when it is the sole selection, and not when multiple or none are selected", () => {
    const layout = makeLayout();
    expect(
      resolveInlineEditTarget({
        layout,
        selection: ["childText"],
        pageContext: "first",
        elementId: "childText",
        columnIndex: null,
        rowIndex: null,
      }),
    ).toEqual({ kind: "text", id: "childText" });
    expect(
      resolveInlineEditTarget({
        layout,
        selection: [],
        pageContext: "first",
        elementId: "childText",
        columnIndex: null,
        rowIndex: null,
      }),
    ).toBeNull();
    expect(
      resolveInlineEditTarget({
        layout,
        selection: ["childText", "staticText"],
        pageContext: "first",
        elementId: "childText",
        columnIndex: null,
        rowIndex: null,
      }),
    ).toBeNull();
  });

  it("an element not visible in the current page context does not become a target", () => {
    const layout = makeLayout("first");
    expect(
      resolveInlineEditTarget({
        layout,
        selection: [],
        pageContext: "first",
        elementId: "ghostText",
        columnIndex: null,
        rowIndex: null,
      }),
    ).toBeNull();
  });

  it("a table becomes a column-header target when a valid columnIndex is given", () => {
    const layout = makeLayout();
    expect(
      resolveInlineEditTarget({
        layout,
        selection: [],
        pageContext: "first",
        elementId: "tbl1",
        columnIndex: 1,
        rowIndex: null,
      }),
    ).toEqual({ kind: "tableHeader", id: "tbl1", columnIndex: 1 });
  });

  it("a table does not become a target when columnIndex is null or out of range", () => {
    const layout = makeLayout();
    expect(
      resolveInlineEditTarget({
        layout,
        selection: [],
        pageContext: "first",
        elementId: "tbl1",
        columnIndex: null,
        rowIndex: null,
      }),
    ).toBeNull();
    expect(
      resolveInlineEditTarget({
        layout,
        selection: [],
        pageContext: "first",
        elementId: "tbl1",
        columnIndex: 5,
        rowIndex: null,
      }),
    ).toBeNull();
  });

  it("a table becomes a data-row cell target when both columnIndex and rowIndex are non-null and the context is first", () => {
    const layout = makeLayout("first");
    expect(
      resolveInlineEditTarget({
        layout,
        selection: [],
        pageContext: "first",
        elementId: "tbl1",
        columnIndex: 1,
        rowIndex: 2,
      }),
    ).toEqual({ kind: "tableCell", id: "tbl1", columnIndex: 1, rowIndex: 2 });
  });

  it("a data-row cell does not become a target in a continuation-page context", () => {
    const layout = makeLayout("rest");
    expect(
      resolveInlineEditTarget({
        layout,
        selection: [],
        pageContext: "rest",
        elementId: "tbl1",
        columnIndex: 1,
        rowIndex: 2,
      }),
    ).toBeNull();
  });

  it("does not become a target when rowIndex is negative", () => {
    const layout = makeLayout();
    expect(
      resolveInlineEditTarget({
        layout,
        selection: [],
        pageContext: "first",
        elementId: "tbl1",
        columnIndex: 1,
        rowIndex: -1,
      }),
    ).toBeNull();
  });

  it("an id not present in the layout does not become a target", () => {
    const layout = makeLayout();
    expect(
      resolveInlineEditTarget({
        layout,
        selection: [],
        pageContext: "first",
        elementId: "unknown",
        columnIndex: null,
        rowIndex: null,
      }),
    ).toBeNull();
  });

  it("does not become a target when elementId is null", () => {
    const layout = makeLayout();
    expect(
      resolveInlineEditTarget({
        layout,
        selection: [],
        pageContext: "first",
        elementId: null,
        columnIndex: null,
        rowIndex: null,
      }),
    ).toBeNull();
  });
});

describe("tableHeaderCellBox", () => {
  const tableBox = { x: 10, y: 150, w: 70, h: 26 };

  it("the first column keeps tableBox's x/y, with width as the column width and height as headerHeight", () => {
    expect(tableHeaderCellBox(TABLE, tableBox, 0)).toEqual({
      x: 10,
      y: 150,
      w: 30,
      h: 8,
    });
  });

  it("a middle column's x is offset by the sum of the widths of preceding columns", () => {
    expect(tableHeaderCellBox(TABLE, tableBox, 1)).toEqual({
      x: 40,
      y: 150,
      w: 40,
      h: 8,
    });
  });

  it("tableBox's offset is added", () => {
    expect(
      tableHeaderCellBox(TABLE, { x: 100, y: 200, w: 70, h: 26 }, 1),
    ).toEqual({ x: 130, y: 200, w: 40, h: 8 });
  });
});

describe("tableCellBox", () => {
  const tableBox = { x: 10, y: 150, w: 70, h: 26 };

  it("the first row has y = tableBox.y + headerHeight, with height as rowHeight", () => {
    expect(tableCellBox(TABLE, tableBox, 0, 0)).toEqual({
      x: 10,
      y: 158,
      w: 30,
      h: 6,
    });
  });

  it("a subsequent row's y is offset by rowIndex × rowHeight", () => {
    expect(tableCellBox(TABLE, tableBox, 0, 2)).toEqual({
      x: 10,
      y: 170,
      w: 30,
      h: 6,
    });
  });

  it("the column offset is added using the same formula as tableHeaderCellBox", () => {
    expect(tableCellBox(TABLE, tableBox, 1, 1)).toEqual({
      x: 40,
      y: 164,
      w: 40,
      h: 6,
    });
  });
});

describe("progressive selection (resolveClickTarget) consistency with double-click", () => {
  const IDLE: InteractionState = { kind: "idle" };
  const AT = { x: 22, y: 102 };

  function ctxFor(selection: readonly string[]): InteractionContext {
    const document = {
      version: "1.0" as const,
      page: { width: 210, height: 297 },
      font: { regular: "NotoSansJP" },
      elements: ELEMENTS,
    };
    const state: EditorState = {
      document,
      selection,
      view: {
        zoom: 1,
        pageContext: "first",
        snapEnabled: true,
        gridVisible: true,
        canvasMode: "select",
      },
      validationErrors: [],
      validationWarnings: [],
      dirty: false,
      sampleScenarios: defaultScenarioSet("", ja.scenarioNames),
      fontRegistry: new Map(),
      customGuides: [],
      envelopePresetId: null,
      selectedExportTarget: "pdfme",
      groups: [],
    };
    return {
      state,
      layout: layoutDocument(document, state.view.pageContext),
      toleranceMm: 2,
    };
  }

  // A double-click fires after two clicks, so reaching a flex child requires
  // resolveClickTarget's progressive selection to advance across two clicks (1st = flex, 2nd = child)
  it("a flex child text does not become a target on the first click, and becomes one on the second click once it reaches sole selection", () => {
    const layout = layoutDocument(ctxFor([]).state.document, "first");

    const firstDown = reduceInteraction(
      IDLE,
      {
        kind: "pointerDown",
        at: AT,
        targetId: "childText",
        handle: null,
        shiftKey: false,
      },
      ctxFor([]),
    );
    expect(firstDown.state.kind).toBe("pressing");
    expect(firstDown.effect?.selection).toEqual(["flex1"]);
    const firstUp = reduceInteraction(
      firstDown.state,
      { kind: "pointerUp", at: AT },
      ctxFor([]),
    );
    expect(firstUp.state).toEqual(IDLE);

    expect(
      resolveInlineEditTarget({
        layout,
        selection: firstDown.effect?.selection ?? [],
        pageContext: "first",
        elementId: "childText",
        columnIndex: null,
        rowIndex: null,
      }),
    ).toBeNull();

    const secondDown = reduceInteraction(
      IDLE,
      {
        kind: "pointerDown",
        at: AT,
        targetId: "childText",
        handle: null,
        shiftKey: false,
      },
      ctxFor(firstDown.effect?.selection ?? []),
    );
    expect(secondDown.state.kind).toBe("pressing");
    expect(secondDown.effect?.selection).toEqual(["childText"]);
    const secondUp = reduceInteraction(
      secondDown.state,
      { kind: "pointerUp", at: AT },
      ctxFor(firstDown.effect?.selection ?? []),
    );
    expect(secondUp.state).toEqual(IDLE);

    expect(
      resolveInlineEditTarget({
        layout,
        selection: secondDown.effect?.selection ?? [],
        pageContext: "first",
        elementId: "childText",
        columnIndex: null,
        rowIndex: null,
      }),
    ).toEqual({ kind: "text", id: "childText" });
  });
});
