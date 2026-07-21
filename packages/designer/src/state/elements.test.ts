import type {
  IrDocument,
  IrElement,
  IrElementType,
  IrFlexChild,
  IrFlexElement,
  IrTableElement,
} from "@denreport/core";
import { describe, expect, it } from "vitest";
import { createDefaultElement } from "./defaults";
import {
  addElement,
  deleteElements,
  insertFlexChild,
  moveElements,
  reorderFlexChild,
  resizeElement,
  resizeFlexChild,
  rotateElement,
  setTableContinuationY,
  toFlexChild,
  toTopLevelElement,
} from "./elements";
import { EditorStore } from "./store";

function blankDocument(): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements: [],
  };
}

function textElement(id: string, x = 10, y = 10): IrElement {
  return {
    type: "text",
    id,
    x,
    y,
    pages: "first",
    w: 40,
    h: 8,
    text: "見本",
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  };
}

function flexElement(id: string, childIds: readonly string[]): IrFlexElement {
  return {
    type: "flex",
    id,
    x: 20,
    y: 20,
    pages: "first",
    direction: "column",
    gap: 2,
    justifyContent: "start",
    alignItems: "start",
    children: childIds.map((childId) => ({
      type: "text",
      id: childId,
      w: 40,
      h: 8,
      text: childId,
      fontSize: 10,
      align: "left",
      lineHeight: 1.25,
    })),
  };
}

describe("moveElements", () => {
  it("moves only the target, sharing references to unrelated elements with the old document (structural sharing)", () => {
    const a = textElement("a", 10, 10);
    const b = textElement("b", 50, 50);
    const doc: IrDocument = { ...blankDocument(), elements: [a, b] };

    const next = moveElements(doc, ["a"], 5, -2);

    expect(doc.elements[0]).toBe(a);
    expect(doc.elements[1]).toBe(b);
    expect(next.elements[0]).toMatchObject({ x: 15, y: 8 });
    expect(next.elements[1]).toBe(b);
  });

  it("rounds to 0.1mm on the way out", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [textElement("a", 10, 10)],
    };
    const next = moveElements(doc, ["a"], 0.12345, 0.06);
    expect(next.elements[0]).toMatchObject({ x: 10.1, y: 10.1 });
  });

  it("table: continuationY follows a vertical move when it equals y", () => {
    const table = createDefaultElement(blankDocument(), "table", 15, 90);
    const doc: IrDocument = { ...blankDocument(), elements: [table] };
    const next = moveElements(doc, [table.id], 0, 10);
    expect(next.elements[0]).toMatchObject({ y: 100, continuationY: 100 });
  });

  it("table: continuationY stays unchanged by a vertical move when it differs from y", () => {
    const table = {
      ...createDefaultElement(blankDocument(), "table", 15, 90),
      continuationY: 30,
    };
    const doc: IrDocument = { ...blankDocument(), elements: [table] };
    const next = moveElements(doc, [table.id], 0, 10);
    expect(next.elements[0]).toMatchObject({ y: 100, continuationY: 30 });
  });

  it("table: y and continuationY stay unchanged for a horizontal-only move even while linked", () => {
    const table = createDefaultElement(blankDocument(), "table", 15, 90);
    const doc: IrDocument = { ...blankDocument(), elements: [table] };
    const next = moveElements(doc, [table.id], 5, 0);
    expect(next.elements[0]).toMatchObject({
      x: 20,
      y: 90,
      continuationY: 90,
    });
  });
});

describe("resizeElement", () => {
  it("reflects the box into x/y/w/h, rounded to 0.1mm", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [textElement("a")],
    };
    const next = resizeElement(doc, "a", {
      x: 1.04,
      y: 2.06,
      w: 30.55,
      h: 7.99,
    });
    expect(next.elements[0]).toMatchObject({ x: 1, y: 2.1, w: 30.6, h: 8 });
  });

  it("line reflects the box's main-axis size into length", () => {
    const line: IrElement = {
      type: "line",
      id: "l",
      x: 10,
      y: 20,
      pages: "first",
      orientation: "horizontal",
      length: 50,
      thickness: 0.3,
    };
    const doc: IrDocument = { ...blankDocument(), elements: [line] };
    const next = resizeElement(doc, "l", { x: 8, y: 20, w: 62.34, h: 0 });
    expect(next.elements[0]).toMatchObject({ x: 8, length: 62.3 });
  });

  it("table reflects only x/y (width is derived from the sum of column widths)", () => {
    const table = createDefaultElement(blankDocument(), "table", 15, 90);
    const doc: IrDocument = { ...blankDocument(), elements: [table] };
    const next = resizeElement(doc, table.id, { x: 20, y: 95, w: 999, h: 999 });
    expect(next.elements[0]).toMatchObject({ x: 20, y: 95 });
    expect(next.elements[0]).not.toHaveProperty("w");
  });
});

describe("rotateElement", () => {
  function docWithText(): IrDocument {
    return { ...blankDocument(), elements: [textElement("t1")] };
  }

  it("rounds to 0.1° units when setting", () => {
    const next = rotateElement(docWithText(), "t1", 45.04);
    expect(next.elements[0]).toMatchObject({ rotate: 45 });
    const next2 = rotateElement(docWithText(), "t1", -30.55);
    expect(next2.elements[0]).toMatchObject({ rotate: -30.5 });
  });

  it("removes the attribute when the rounded value is 0", () => {
    const rotated = rotateElement(docWithText(), "t1", 45);
    const cleared = rotateElement(rotated, "t1", 0.04);
    expect(cleared.elements[0]).not.toHaveProperty("rotate");
  });

  it("setting 0 on an element without rotate still returns the document unchanged", () => {
    const doc = docWithText();
    expect(rotateElement(doc, "t1", 0)).toBe(doc);
  });

  it("returns the document unchanged when set to the same value", () => {
    const rotated = rotateElement(docWithText(), "t1", 45);
    expect(rotateElement(rotated, "t1", 45)).toBe(rotated);
  });

  it("returns the document unchanged for table / flex or an unknown id", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [
        createDefaultElement(blankDocument(), "table", 0, 0),
        flexElement("f", ["c1"]),
      ],
    };
    expect(rotateElement(doc, doc.elements[0]?.id ?? "", 45)).toBe(doc);
    expect(rotateElement(doc, "f", 45)).toBe(doc);
    expect(rotateElement(doc, "missing", 45)).toBe(doc);
  });

  it("also applies to flex children", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [flexElement("f", ["c1"])],
    };
    const next = rotateElement(doc, "c1", 90);
    const flex = next.elements[0];
    if (flex?.type === "flex") {
      expect(flex.children[0]).toMatchObject({ rotate: 90 });
    } else {
      expect.unreachable();
    }
  });
});

describe("setTableContinuationY", () => {
  it("updates only continuationY, rounded to 0.1mm", () => {
    const table = createDefaultElement(blankDocument(), "table", 15, 90);
    const doc: IrDocument = { ...blankDocument(), elements: [table] };
    const next = setTableContinuationY(doc, table.id, 30.06);
    expect(next.elements[0]).toMatchObject({ y: 90, continuationY: 30.1 });
  });
});

describe("deleteElements", () => {
  it("can delete both top-level elements and flex children (including nested)", () => {
    const base = flexElement("outer", ["c1"]);
    const outer: IrFlexElement = {
      ...base,
      children: [
        ...base.children,
        {
          type: "flex",
          id: "inner",
          direction: "column",
          gap: 0,
          justifyContent: "start",
          alignItems: "start",
          children: flexElement("x", ["c2"]).children,
        },
      ],
    };
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [textElement("a"), outer],
    };

    const next = deleteElements(doc, ["a", "c2"]);
    expect(next.elements).toHaveLength(1);
    const flex = next.elements[0];
    expect(flex?.id).toBe("outer");
    if (flex?.type === "flex") {
      const innerNext = flex.children[1];
      expect(innerNext?.type).toBe("flex");
      if (innerNext?.type === "flex") {
        expect(innerNext.children).toEqual([]);
      }
    }
  });

  it("deleting the last remaining child empties children (the container stays)", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [flexElement("f", ["c1"])],
    };
    const next = deleteElements(doc, ["c1"]);
    const flex = next.elements[0];
    expect(flex?.type).toBe("flex");
    if (flex?.type === "flex") {
      expect(flex.children).toEqual([]);
    }
  });

  it("keeps references to unrelated elements, returning the whole document unchanged when there's no target", () => {
    const a = textElement("a");
    const doc: IrDocument = { ...blankDocument(), elements: [a] };
    expect(deleteElements(doc, ["nothing"])).toBe(doc);
    const next = deleteElements(doc, ["a"]);
    expect(next.elements).toEqual([]);
    expect(doc.elements[0]).toBe(a);
  });
});

describe("insertFlexChild / reorderFlexChild", () => {
  it("can insert at a given position (reaches nested flex by id too)", () => {
    const outer: IrFlexElement = {
      ...flexElement("outer", ["c1"]),
      children: [
        ...flexElement("outer", ["c1"]).children,
        {
          type: "flex",
          id: "inner",
          direction: "row",
          gap: 0,
          justifyContent: "start",
          alignItems: "start",
          children: flexElement("x", ["c2"]).children,
        },
      ],
    };
    const doc: IrDocument = { ...blankDocument(), elements: [outer] };
    const child = {
      type: "rect" as const,
      id: "r1",
      w: 5,
      h: 5,
      borderWidth: 0.3,
    };
    const next = insertFlexChild(doc, "inner", child, 0);
    const flex = next.elements[0];
    if (flex?.type === "flex") {
      const inner = flex.children[1];
      if (inner?.type === "flex") {
        expect(inner.children.map((c) => c.id)).toEqual(["r1", "c2"]);
      }
    }
  });

  it("reorder: can move to the front or the back", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [flexElement("f", ["c1", "c2", "c3"])],
    };
    const toHead = reorderFlexChild(doc, "f", 2, 0);
    const toTail = reorderFlexChild(doc, "f", 0, 2);
    const idsOf = (d: IrDocument): readonly string[] => {
      const flex = d.elements[0];
      return flex?.type === "flex" ? flex.children.map((c) => c.id) : [];
    };
    expect(idsOf(toHead)).toEqual(["c3", "c1", "c2"]);
    expect(idsOf(toTail)).toEqual(["c2", "c3", "c1"]);
  });

  it("reorder: same position is a no-op, returning the same reference", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [flexElement("f", ["c1", "c2"])],
    };
    expect(reorderFlexChild(doc, "f", 1, 1)).toBe(doc);
  });
});

describe("toFlexChild / toTopLevelElement", () => {
  it("round-tripping restores the original except for x/y/pages", () => {
    const el = textElement("a", 12, 34) as Exclude<IrElement, IrTableElement>;
    const child = toFlexChild(el);
    expect(child).not.toHaveProperty("x");
    expect(child).not.toHaveProperty("y");
    expect(child).not.toHaveProperty("pages");
    const back = toTopLevelElement(child, 12, 34, "first");
    expect(back).toEqual(el);
  });

  it("toTopLevelElement adds x/y/pages, rounded to 0.1mm", () => {
    const child: IrFlexChild = {
      type: "rect",
      id: "r1",
      w: 10,
      h: 8,
      borderWidth: 0.3,
    };
    const el = toTopLevelElement(child, 1.04, 2.06, "all");
    expect(el).toMatchObject({ x: 1, y: 2.1, pages: "all", w: 10, h: 8 });
  });
});

describe("resizeFlexChild", () => {
  it("updates only the child's w/h, rounded to 0.1mm", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [flexElement("f", ["c1"])],
    };
    const next = resizeFlexChild(doc, "c1", {
      x: 999,
      y: 999,
      w: 30.55,
      h: 7.99,
    });
    const flex = next.elements[0];
    if (flex?.type === "flex") {
      expect(flex.children[0]).toMatchObject({ w: 30.6, h: 8 });
      expect(flex.children[0]).not.toHaveProperty("x");
    } else {
      expect.unreachable();
    }
  });

  it("a line child updates length", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [
        {
          ...flexElement("f", []),
          children: [
            {
              type: "line",
              id: "l1",
              orientation: "horizontal",
              length: 10,
              thickness: 0.3,
            },
          ],
        },
      ],
    };
    const next = resizeFlexChild(doc, "l1", { x: 0, y: 0, w: 62.34, h: 0 });
    const flex = next.elements[0];
    if (flex?.type === "flex") {
      expect(flex.children[0]).toMatchObject({ length: 62.3 });
    } else {
      expect.unreachable();
    }
  });

  it("also reaches descendants inside nested flex", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [
        {
          ...flexElement("outer", []),
          children: [
            {
              type: "flex",
              id: "inner",
              direction: "row",
              gap: 0,
              justifyContent: "start",
              alignItems: "start",
              children: flexElement("x", ["c1"]).children,
            },
          ],
        },
      ],
    };
    const next = resizeFlexChild(doc, "c1", { x: 0, y: 0, w: 20, h: 9 });
    const outer = next.elements[0];
    if (outer?.type === "flex") {
      const inner = outer.children[0];
      if (inner?.type === "flex") {
        expect(inner.children[0]).toMatchObject({ w: 20, h: 9 });
      } else {
        expect.unreachable();
      }
    } else {
      expect.unreachable();
    }
  });

  it("doesn't apply to table or nested flex", () => {
    const table = createDefaultElement(blankDocument(), "table", 10, 10);
    const doc: IrDocument = { ...blankDocument(), elements: [table] };
    expect(resizeFlexChild(doc, table.id, { x: 0, y: 0, w: 20, h: 9 })).toBe(
      doc,
    );

    const nested: IrDocument = {
      ...blankDocument(),
      elements: [
        {
          ...flexElement("outer", []),
          children: [
            {
              type: "flex",
              id: "inner",
              direction: "row",
              gap: 0,
              justifyContent: "start",
              alignItems: "start",
              children: [],
            },
          ],
        },
      ],
    };
    expect(resizeFlexChild(nested, "inner", { x: 0, y: 0, w: 20, h: 9 })).toBe(
      nested,
    );
  });

  it("doesn't apply to top-level elements", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [textElement("top1")],
    };
    expect(resizeFlexChild(doc, "top1", { x: 0, y: 0, w: 20, h: 9 })).toBe(doc);
  });

  it("structural sharing: preserves references to unrelated children", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [flexElement("f", ["c1", "c2"])],
    };
    const before = (doc.elements[0] as IrFlexElement).children[1];
    const next = resizeFlexChild(doc, "c1", { x: 0, y: 0, w: 20, h: 9 });
    const flex = next.elements[0];
    if (flex?.type === "flex") {
      expect(flex.children[1]).toBe(before);
    } else {
      expect.unreachable();
    }
  });
});

describe("Store operations: place, select, move/resize, delete, undo/redo across all 8 element types", () => {
  const ALL_TYPES: readonly IrElementType[] = [
    "text",
    "line",
    "rect",
    "table",
    "image",
    "flex",
    "pageNumber",
    "barcode",
  ];
  const RESIZABLE: readonly IrElementType[] = [
    "text",
    "line",
    "rect",
    "image",
    "pageNumber",
    "barcode",
  ];

  for (const type of ALL_TYPES) {
    it(`${type}: a sequence of edits round-trips through undo/redo`, () => {
      const store = new EditorStore(blankDocument());

      // Place
      const el = createDefaultElement(store.getState().document, type, 20, 30);
      store.commit(addElement(store.getState().document, el), [el.id]);
      expect(store.getState().selection).toEqual([el.id]);
      expect(store.getState().document.elements).toHaveLength(1);

      // Select (not pushed to history)
      store.setSelection([el.id]);

      // Move
      store.commit(moveElements(store.getState().document, [el.id], 5, 5), [
        el.id,
      ]);
      expect(store.getState().document.elements[0]).toMatchObject({
        x: 25,
        y: 35,
      });

      // Resize (only for types that support it)
      if (RESIZABLE.includes(type)) {
        store.commit(
          resizeElement(store.getState().document, el.id, {
            x: 25,
            y: 35,
            w: 60,
            h: 12,
          }),
          [el.id],
        );
        const resized = store.getState().document.elements[0];
        if (type === "line") {
          expect(resized).toMatchObject({ length: 60 });
        } else {
          expect(resized).toMatchObject({ w: 60, h: 12 });
        }
      }

      // Delete
      store.commit(deleteElements(store.getState().document, [el.id]), []);
      expect(store.getState().document.elements).toEqual([]);

      // undo rolls back all edits
      while (store.canUndo()) {
        store.undo();
      }
      expect(store.getState().document.elements).toEqual([]);
      expect(store.getState().selection).toEqual([]);

      // redo advances up to the deletion
      while (store.canRedo()) {
        store.redo();
      }
      expect(store.getState().document.elements).toEqual([]);

      // A single undo returns to just before the deletion (element present)
      store.undo();
      expect(store.getState().document.elements).toHaveLength(1);
      expect(store.getState().document.elements[0]?.id).toBe(el.id);
    });
  }

  it("moving and deleting a multi-selection round-trips as 1 commit = 1 history entry", () => {
    const store = new EditorStore({
      ...blankDocument(),
      elements: [textElement("a", 10, 10), textElement("b", 60, 10)],
    });

    store.setSelection(["a", "b"]);
    store.commit(moveElements(store.getState().document, ["a", "b"], 10, 20), [
      "a",
      "b",
    ]);
    expect(store.getState().document.elements[0]).toMatchObject({
      x: 20,
      y: 30,
    });
    expect(store.getState().document.elements[1]).toMatchObject({
      x: 70,
      y: 30,
    });

    store.commit(deleteElements(store.getState().document, ["a", "b"]), []);
    expect(store.getState().document.elements).toEqual([]);

    store.undo();
    expect(store.getState().document.elements).toHaveLength(2);
    expect(store.getState().selection).toEqual(["a", "b"]);

    store.undo();
    expect(store.getState().document.elements[0]).toMatchObject({
      x: 10,
      y: 10,
    });
  });
});
