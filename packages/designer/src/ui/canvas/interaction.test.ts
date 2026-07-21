import type { IrDocument, IrElement, IrFlexElement } from "@denreport/core";
import { describe, expect, it } from "vitest";
import { ja } from "../../i18n/messages/ja";
import { layoutDocument } from "../../state/geometry";
import type { ElementGroup } from "../../state/groups";
import type { CustomGuide } from "../../state/guides";
import { defaultScenarioSet } from "../../state/sample-scenarios";
import type { EditorState, EditorViewState } from "../../state/types";
import type {
  InteractionContext,
  InteractionEvent,
  InteractionState,
} from "./interaction";
import {
  liveBoxFor,
  reduceInteraction,
  resolveClickTarget,
} from "./interaction";

const FLEX: IrFlexElement = {
  type: "flex",
  id: "f",
  x: 20,
  y: 100,
  pages: "first",
  direction: "column",
  gap: 2,
  justifyContent: "start",
  alignItems: "start",
  children: [
    {
      type: "text",
      id: "ct1",
      w: 40,
      h: 8,
      text: "1",
      fontSize: 10,
      align: "left",
      lineHeight: 1.25,
    },
    {
      type: "text",
      id: "ct2",
      w: 40,
      h: 8,
      text: "2",
      fontSize: 10,
      align: "left",
      lineHeight: 1.25,
    },
  ],
};

const ELEMENTS: readonly IrElement[] = [
  {
    type: "text",
    id: "a",
    x: 10,
    y: 10,
    pages: "first",
    w: 40,
    h: 8,
    text: "a",
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  },
  {
    type: "rect",
    id: "b",
    x: 100,
    y: 10,
    pages: "first",
    w: 40,
    h: 20,
    borderWidth: 0.3,
  },
  FLEX,
  {
    type: "text",
    id: "g",
    x: 13,
    y: 50,
    pages: "last",
    w: 40,
    h: 8,
    text: "ghost",
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  },
];

function makeCtx(
  selection: readonly string[] = [],
  view: Partial<EditorViewState> = {},
  elements: readonly IrElement[] = ELEMENTS,
  groups: readonly ElementGroup[] = [],
  customGuides: readonly CustomGuide[] = [],
): InteractionContext {
  const document: IrDocument = {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements,
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
      ...view,
    },
    validationErrors: [],
    validationWarnings: [],
    dirty: false,
    sampleScenarios: defaultScenarioSet("", ja.scenarioNames),
    fontRegistry: new Map(),
    customGuides,
    envelopePresetId: null,
    selectedExportTarget: "pdfme",
    groups,
  };
  return {
    state,
    layout: layoutDocument(document, state.view.pageContext),
    toleranceMm: 2,
  };
}

const IDLE: InteractionState = { kind: "idle" };

function down(
  at: { x: number; y: number },
  targetId: string | null,
  overrides: Partial<Extract<InteractionEvent, { kind: "pointerDown" }>> = {},
): InteractionEvent {
  return {
    kind: "pointerDown",
    at,
    targetId,
    handle: null,
    shiftKey: false,
    ...overrides,
  };
}

describe("Click and selection", () => {
  it("a click below threshold only selects; pointerUp has no document effect", () => {
    const ctx = makeCtx();
    const pressed = reduceInteraction(IDLE, down({ x: 12, y: 12 }, "a"), ctx);
    expect(pressed.state.kind).toBe("pressing");
    expect(pressed.effect).toEqual({ selection: ["a"] });

    const up = reduceInteraction(
      pressed.state,
      { kind: "pointerUp", at: { x: 12.3, y: 12 } },
      makeCtx(["a"]),
    );
    expect(up.state).toEqual(IDLE);
    expect(up.effect).toBeNull();
  });

  it("shift+click adds to the selection, or removes it if already selected", () => {
    const add = reduceInteraction(
      IDLE,
      down({ x: 110, y: 15 }, "b", { shiftKey: true }),
      makeCtx(["a"]),
    );
    expect(add.effect).toEqual({ selection: ["a", "b"] });
    expect(add.state.kind).toBe("pressing");

    const remove = reduceInteraction(
      IDLE,
      down({ x: 110, y: 15 }, "b", { shiftKey: true }),
      makeCtx(["a", "b"]),
    );
    expect(remove.effect).toEqual({ selection: ["a"] });
    expect(remove.state).toEqual(IDLE);
  });

  it("pointerDown on empty space clears the selection and enters marquee", () => {
    const result = reduceInteraction(
      IDLE,
      down({ x: 5, y: 5 }, null),
      makeCtx(["a"]),
    );
    expect(result.state.kind).toBe("marquee");
    expect(result.effect).toEqual({ selection: [] });
  });
});

describe("Expanding selection to group members", () => {
  const GROUPS: readonly ElementGroup[] = [
    { id: "group1", memberIds: ["a", "b"] },
  ];

  it("clicking selects all group members", () => {
    const ctx = makeCtx([], {}, ELEMENTS, GROUPS);
    const pressed = reduceInteraction(IDLE, down({ x: 12, y: 12 }, "a"), ctx);
    expect(pressed.effect).toEqual({ selection: ["a", "b"] });
  });

  it("shift+click adds/removes at the group level", () => {
    const add = reduceInteraction(
      IDLE,
      down({ x: 12, y: 12 }, "a", { shiftKey: true }),
      makeCtx([], {}, ELEMENTS, GROUPS),
    );
    expect(add.effect).toEqual({ selection: ["a", "b"] });

    const remove = reduceInteraction(
      IDLE,
      down({ x: 12, y: 12 }, "a", { shiftKey: true }),
      makeCtx(["a", "b"], {}, ELEMENTS, GROUPS),
    );
    expect(remove.effect).toEqual({ selection: [] });
    expect(remove.state).toEqual(IDLE);
  });

  it("a partial marquee hit still makes the whole group previewIds", () => {
    const ctx = makeCtx([], {}, ELEMENTS, GROUPS);
    const started = reduceInteraction(IDLE, down({ x: 5, y: 5 }, null), ctx);
    // The rectangle (5,5)-(60,20) intersects only a; b (x100–140) is nowhere near it
    const moved = reduceInteraction(
      started.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 60, y: 20 } },
      ctx,
    );
    expect(moved.state.kind).toBe("marquee");
    if (moved.state.kind === "marquee") {
      expect(moved.state.previewIds).toEqual(["a", "b"]);
    }
  });

  it("dragging a selected group moves all its members", () => {
    const ctx = makeCtx(["a", "b"], {}, ELEMENTS, GROUPS);
    const pressed = reduceInteraction(IDLE, down({ x: 12, y: 12 }, "a"), ctx);
    expect(pressed.effect).toBeNull();

    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 30, y: 12 } },
      ctx,
    );
    expect(moved.state.kind).toBe("moving");
    if (moved.state.kind === "moving") {
      expect(moved.state.ids).toEqual(["a", "b"]);
    }
  });
});

describe("Move", () => {
  it("exceeding the threshold transitions to moving, and pointerUp returns exactly one effect", () => {
    const ctx = makeCtx(["a"]);
    const pressed = reduceInteraction(IDLE, down({ x: 12, y: 12 }, "a"), ctx);
    expect(pressed.effect).toBeNull();

    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 30, y: 12 } },
      ctx,
    );
    expect(moved.state.kind).toBe("moving");
    expect(moved.effect).toBeNull();
    if (moved.state.kind === "moving") {
      // The raw dx=18 snaps to the grid (x=30), becoming 20
      expect(moved.state.offset.x).toBeCloseTo(20, 10);
      expect(moved.state.offset.y).toBeCloseTo(0, 10);
    }

    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 30, y: 12 } },
      ctx,
    );
    expect(up.state).toEqual(IDLE);
    expect(up.effect?.selection).toEqual(["a"]);
    const movedEl = up.effect?.document?.elements.find((el) => el.id === "a");
    expect(movedEl).toMatchObject({ x: 30, y: 10 });
  });

  it("Esc / cancel returns to idle with no effect", () => {
    const ctx = makeCtx(["a"]);
    const pressed = reduceInteraction(IDLE, down({ x: 12, y: 12 }, "a"), ctx);
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 30, y: 12 } },
      ctx,
    );
    const cancelled = reduceInteraction(moved.state, { kind: "cancel" }, ctx);
    expect(cancelled.state).toEqual(IDLE);
    expect(cancelled.effect).toBeNull();
  });

  it("a ghost (element outside the current context) is not a snap candidate", () => {
    // Even when moved near ghost g's left edge x=13.0, no element guide appears and it snaps to the grid
    const ctx = makeCtx(["a"]);
    const pressed = reduceInteraction(IDLE, down({ x: 12, y: 12 }, "a"), ctx);
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 15.8, y: 12 } },
      ctx,
    );
    if (moved.state.kind === "moving") {
      expect(moved.state.offset.x).toBeCloseTo(5, 10);
      expect(moved.state.guides.filter((g) => g.axis === "x")).toEqual([]);
    } else {
      expect.unreachable();
    }
  });

  it("snapping to customGuides works via snapContextFor (takes priority over a grid line at the same position, returning the guide)", () => {
    const ctx = makeCtx(
      ["a"],
      {},
      ELEMENTS,
      [],
      [{ id: "guide1", axis: "x", positionMm: 30 }],
    );
    const pressed = reduceInteraction(IDLE, down({ x: 12, y: 12 }, "a"), ctx);
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 31, y: 12 } },
      ctx,
    );
    if (moved.state.kind === "moving") {
      expect(moved.state.offset.x).toBeCloseTo(20, 10);
      expect(moved.state.guides).toContainEqual({
        axis: "x",
        positionMm: 30,
      });
    } else {
      expect.unreachable();
    }
  });

  it("in the rest context, a table's vertical move is reflected in continuationY", () => {
    const table: IrElement = {
      type: "table",
      id: "tbl",
      x: 15,
      y: 90,
      bind: "items",
      columns: [{ key: "c", label: "c", width: 100, align: "left" }],
      rowHeight: 9,
      headerHeight: 9,
      fontSize: 10,
      maxY: 240,
      continuationY: 30,
      minRows: 3,
    };
    const ctx = makeCtx(["tbl"], { pageContext: "rest", snapEnabled: false }, [
      table,
    ]);
    const pressed = reduceInteraction(IDLE, down({ x: 50, y: 40 }, "tbl"), ctx);
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 53, y: 47 } },
      ctx,
    );
    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 53, y: 47 } },
      ctx,
    );
    const el = up.effect?.document?.elements[0];
    expect(el).toMatchObject({ x: 18, y: 90, continuationY: 37 });
  });

  it("in the first context, a table whose continuationY equals y also reflects a vertical move in continuationY", () => {
    const table: IrElement = {
      type: "table",
      id: "tbl",
      x: 15,
      y: 90,
      bind: "items",
      columns: [{ key: "c", label: "c", width: 100, align: "left" }],
      rowHeight: 9,
      headerHeight: 9,
      fontSize: 10,
      maxY: 240,
      continuationY: 90,
      minRows: 3,
    };
    const ctx = makeCtx(["tbl"], { pageContext: "first", snapEnabled: false }, [
      table,
    ]);
    const pressed = reduceInteraction(IDLE, down({ x: 50, y: 40 }, "tbl"), ctx);
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 53, y: 47 } },
      ctx,
    );
    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 53, y: 47 } },
      ctx,
    );
    const document = up.effect?.document;
    const el = document?.elements[0];
    expect(el).toMatchObject({ x: 18, y: 97, continuationY: 97 });

    const restView = document
      ? layoutDocument(document, "rest").find((v) => v.id === "tbl")
      : undefined;
    expect(restView?.box.y).toBe(97);
  });

  it("in the first context, a table whose continuationY differs from y keeps continuationY unchanged after a vertical move", () => {
    const table: IrElement = {
      type: "table",
      id: "tbl",
      x: 15,
      y: 90,
      bind: "items",
      columns: [{ key: "c", label: "c", width: 100, align: "left" }],
      rowHeight: 9,
      headerHeight: 9,
      fontSize: 10,
      maxY: 240,
      continuationY: 30,
      minRows: 3,
    };
    const ctx = makeCtx(["tbl"], { pageContext: "first", snapEnabled: false }, [
      table,
    ]);
    const pressed = reduceInteraction(IDLE, down({ x: 50, y: 40 }, "tbl"), ctx);
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 53, y: 47 } },
      ctx,
    );
    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 53, y: 47 } },
      ctx,
    );
    const el = up.effect?.document?.elements[0];
    expect(el).toMatchObject({ x: 18, y: 97, continuationY: 30 });
  });
});

describe("Resize", () => {
  it("handle press then exceeding the threshold enters resizing, and pointerUp applies the dimensions", () => {
    const ctx = makeCtx(["b"]);
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 140, y: 30 }, "b", { handle: "se" }),
      ctx,
    );
    expect(pressed.state.kind).toBe("pressing");

    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 150, y: 40 } },
      ctx,
    );
    expect(moved.state.kind).toBe("resizing");
    if (moved.state.kind === "resizing") {
      expect(moved.state.box).toMatchObject({ x: 100, y: 10, w: 50, h: 30 });
    }

    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 150, y: 40 } },
      ctx,
    );
    const el = up.effect?.document?.elements.find((e) => e.id === "b");
    expect(el).toMatchObject({ w: 50, h: 30 });
  });

  it("moving back to the original position before releasing produces no effect (no unchanged history entry)", () => {
    const ctx = makeCtx(["b"]);
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 140, y: 30 }, "b", { handle: "se" }),
      ctx,
    );
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 150, y: 40 } },
      ctx,
    );
    expect(moved.state.kind).toBe("resizing");
    const movedBack = reduceInteraction(
      moved.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 140, y: 30 } },
      ctx,
    );
    expect(movedBack.state.kind).toBe("resizing");
    if (movedBack.state.kind === "resizing") {
      expect(movedBack.state.box).toMatchObject({
        x: 100,
        y: 10,
        w: 40,
        h: 20,
      });
    }
    const up = reduceInteraction(
      movedBack.state,
      { kind: "pointerUp", at: { x: 140, y: 30 } },
      ctx,
    );
    expect(up.state).toEqual(IDLE);
    expect(up.effect).toBeNull();
  });

  it("clamps to the minimum size of 1mm", () => {
    const ctx = makeCtx(["b"], { snapEnabled: false });
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 140, y: 20 }, "b", { handle: "e" }),
      ctx,
    );
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 90, y: 20 } },
      ctx,
    );
    if (moved.state.kind === "resizing") {
      expect(moved.state.box.w).toBe(1);
      expect(moved.state.box.x).toBe(100);
    } else {
      expect.unreachable();
    }
  });
});

describe("Resizing a rotated element", () => {
  // b is x100 y10 w40 h20 → center (120, 20)
  const B_ORIG = { x: 100, y: 10, w: 40, h: 20 };

  function withBRotate(rotate: number): readonly IrElement[] {
    return ELEMENTS.map((el) => (el.id === "b" ? { ...el, rotate } : el));
  }

  // Computes the screen coordinates of point p around the box's center, using the same rotation matrix as rotatePointDeg (SelectionOverlay)
  function screenPoint(
    box: { x: number; y: number; w: number; h: number },
    p: { x: number; y: number },
    deg: number,
  ): { x: number; y: number } {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      x: cx + (p.x - cx) * cos - (p.y - cy) * sin,
      y: cy + (p.x - cx) * sin + (p.y - cy) * cos,
    };
  }

  it("rot=90, e handle (visually the bottom edge), vertical drag extends the width", () => {
    const ctx = makeCtx(["b"], { snapEnabled: false }, withBRotate(90));
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 120, y: 40 }, "b", { handle: "e" }),
      ctx,
    );
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 120, y: 50 } },
      ctx,
    );
    expect(moved.state.kind).toBe("resizing");
    if (moved.state.kind === "resizing") {
      expect(moved.state.box.x).toBeCloseTo(95, 10);
      expect(moved.state.box.y).toBeCloseTo(15, 10);
      expect(moved.state.box.w).toBeCloseTo(50, 10);
      expect(moved.state.box.h).toBeCloseTo(20, 10);

      const anchorOrig = screenPoint(B_ORIG, { x: 100, y: 20 }, 90);
      const anchorNew = screenPoint(
        moved.state.box,
        { x: moved.state.box.x, y: moved.state.box.y + moved.state.box.h / 2 },
        90,
      );
      expect(anchorNew.x).toBeCloseTo(anchorOrig.x, 9);
      expect(anchorNew.y).toBeCloseTo(anchorOrig.y, 9);
    }

    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 120, y: 50 } },
      ctx,
    );
    const el = up.effect?.document?.elements.find((e) => e.id === "b");
    expect(el).toMatchObject({ x: 95, y: 15, w: 50, h: 20 });
  });

  it("rot=90, e handle, horizontal drag leaves the size unchanged (the pre-rotation raw delta isn't mapped)", () => {
    const ctx = makeCtx(["b"], { snapEnabled: false }, withBRotate(90));
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 120, y: 40 }, "b", { handle: "e" }),
      ctx,
    );
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 130, y: 40 } },
      ctx,
    );
    expect(moved.state.kind).toBe("resizing");
    if (moved.state.kind === "resizing") {
      expect(moved.state.box.x).toBeCloseTo(100, 10);
      expect(moved.state.box.y).toBeCloseTo(10, 10);
      expect(moved.state.box.w).toBeCloseTo(40, 10);
      expect(moved.state.box.h).toBeCloseTo(20, 10);
    }

    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 130, y: 40 } },
      ctx,
    );
    expect(up.effect).toBeNull();
  });

  it("rot=90, n handle (visually the right edge), horizontal drag keeps the opposite edge fixed", () => {
    const ctx = makeCtx(["b"], { snapEnabled: false }, withBRotate(90));
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 130, y: 20 }, "b", { handle: "n" }),
      ctx,
    );
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 138, y: 20 } },
      ctx,
    );
    expect(moved.state.kind).toBe("resizing");
    if (moved.state.kind === "resizing") {
      expect(moved.state.box.x).toBeCloseTo(104, 10);
      expect(moved.state.box.y).toBeCloseTo(6, 10);
      expect(moved.state.box.w).toBeCloseTo(40, 10);
      expect(moved.state.box.h).toBeCloseTo(28, 10);

      const anchorOrig = screenPoint(B_ORIG, { x: 120, y: 30 }, 90);
      const anchorNew = screenPoint(
        moved.state.box,
        {
          x: moved.state.box.x + moved.state.box.w / 2,
          y: moved.state.box.y + moved.state.box.h,
        },
        90,
      );
      expect(anchorNew.x).toBeCloseTo(anchorOrig.x, 9);
      expect(anchorNew.y).toBeCloseTo(anchorOrig.y, 9);
    }
  });

  it("rot=45, se handle, dragging in the local +x direction keeps the anchor (nw) fixed on screen", () => {
    const ctx = makeCtx(["b"], { snapEnabled: false }, withBRotate(45));
    const seHandle = { x: 127.07106781186548, y: 41.21320343559643 };
    const pressed = reduceInteraction(
      IDLE,
      down(seHandle, "b", { handle: "se" }),
      ctx,
    );
    const moved = reduceInteraction(
      pressed.state,
      {
        kind: "pointerMove",
        shiftKey: false,
        at: {
          x: seHandle.x + 7.071067811865476,
          y: seHandle.y + 7.071067811865476,
        },
      },
      ctx,
    );
    expect(moved.state.kind).toBe("resizing");
    if (moved.state.kind === "resizing") {
      expect(moved.state.box.x).toBeCloseTo(98.53553390593274, 6);
      expect(moved.state.box.y).toBeCloseTo(13.535533905932738, 6);
      expect(moved.state.box.w).toBeCloseTo(50, 6);
      expect(moved.state.box.h).toBeCloseTo(20, 6);

      const anchorOrig = screenPoint(B_ORIG, { x: 100, y: 10 }, 45);
      const anchorNew = screenPoint(
        moved.state.box,
        { x: moved.state.box.x, y: moved.state.box.y },
        45,
      );
      expect(anchorNew.x).toBeCloseTo(anchorOrig.x, 9);
      expect(anchorNew.y).toBeCloseTo(anchorOrig.y, 9);
    }
  });

  it("rotated, moving back to the original position before releasing produces no effect", () => {
    const ctx = makeCtx(["b"], { snapEnabled: false }, withBRotate(90));
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 120, y: 40 }, "b", { handle: "e" }),
      ctx,
    );
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 120, y: 50 } },
      ctx,
    );
    expect(moved.state.kind).toBe("resizing");
    const movedBack = reduceInteraction(
      moved.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 120, y: 40 } },
      ctx,
    );
    expect(movedBack.state.kind).toBe("resizing");
    if (movedBack.state.kind === "resizing") {
      expect(movedBack.state.box.x).toBeCloseTo(100, 10);
      expect(movedBack.state.box.y).toBeCloseTo(10, 10);
      expect(movedBack.state.box.w).toBeCloseTo(40, 10);
      expect(movedBack.state.box.h).toBeCloseTo(20, 10);
    }
    const up = reduceInteraction(
      movedBack.state,
      { kind: "pointerUp", at: { x: 120, y: 40 } },
      ctx,
    );
    expect(up.state).toEqual(IDLE);
    expect(up.effect).toBeNull();
  });

  it("even when clamping cuts w to the minimum size, the edge not being grabbed stays fixed on screen", () => {
    const ctx = makeCtx(["b"], { snapEnabled: false }, withBRotate(90));
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 120, y: 40 }, "b", { handle: "e" }),
      ctx,
    );
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 120, y: -5 } },
      ctx,
    );
    expect(moved.state.kind).toBe("resizing");
    if (moved.state.kind === "resizing") {
      expect(moved.state.box.x).toBeCloseTo(119.5, 9);
      expect(moved.state.box.y).toBeCloseTo(-9.5, 9);
      expect(moved.state.box.w).toBeCloseTo(1, 9);
      expect(moved.state.box.h).toBeCloseTo(20, 9);

      const anchorOrig = screenPoint(B_ORIG, { x: 100, y: 20 }, 90);
      const anchorNew = screenPoint(
        moved.state.box,
        { x: moved.state.box.x, y: moved.state.box.y + moved.state.box.h / 2 },
        90,
      );
      expect(anchorNew.x).toBeCloseTo(anchorOrig.x, 9);
      expect(anchorNew.y).toBeCloseTo(anchorOrig.y, 9);
    }
  });

  it("snapping still works against the model box, with rotation correction applied afterward", () => {
    const ctx = makeCtx(["b"], {}, withBRotate(90));
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 120, y: 40 }, "b", { handle: "e" }),
      ctx,
    );
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 120, y: 49.3 } },
      ctx,
    );
    expect(moved.state.kind).toBe("resizing");
    if (moved.state.kind === "resizing") {
      expect(moved.state.box.x).toBeCloseTo(95, 6);
      expect(moved.state.box.y).toBeCloseTo(15, 6);
      expect(moved.state.box.w).toBeCloseTo(50, 6);
      expect(moved.state.box.h).toBeCloseTo(20, 6);
      expect(moved.state.guides).toEqual([]);
    }
  });

  it("a rotated line (a degenerate box) always keeps its cross-axis component at 0", () => {
    const lineEl: IrElement = {
      type: "line",
      id: "ln",
      x: 20,
      y: 50,
      pages: "first",
      orientation: "horizontal",
      length: 30,
      thickness: 0.3,
      rotate: 90,
    };
    const ctx = makeCtx(["ln"], { snapEnabled: false }, [...ELEMENTS, lineEl]);
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 35, y: 65 }, "ln", { handle: "line-end" }),
      ctx,
    );
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 35, y: 75 } },
      ctx,
    );
    expect(moved.state.kind).toBe("resizing");
    if (moved.state.kind === "resizing") {
      expect(moved.state.box.x).toBeCloseTo(15, 9);
      expect(moved.state.box.y).toBeCloseTo(55, 9);
      expect(moved.state.box.w).toBeCloseTo(40, 9);
      expect(moved.state.box.h).toBeCloseTo(0, 9);
    }

    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 35, y: 75 } },
      ctx,
    );
    const el = up.effect?.document?.elements.find((e) => e.id === "ln");
    expect(el).toMatchObject({ x: 15, y: 55, length: 40 });
  });

  it("a rotated flex child only gets the inverse rotation applied, and x/y are not written", () => {
    const elements = ELEMENTS.map((el) =>
      el.id === "f" && el.type === "flex"
        ? {
            ...el,
            children: el.children.map((c) =>
              c.id === "ct1" ? { ...c, rotate: 90 } : c,
            ),
          }
        : el,
    );
    const ctx = makeCtx(["ct1"], {}, elements);
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 40, y: 124 }, "ct1", { handle: "e" }),
      ctx,
    );
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 40, y: 134 } },
      ctx,
    );
    expect(moved.state.kind).toBe("resizing");
    if (moved.state.kind === "resizing") {
      expect(moved.state.box).toMatchObject({ x: 20, y: 100, w: 50, h: 8 });
    }

    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 40, y: 134 } },
      ctx,
    );
    const flex = up.effect?.document?.elements.find((e) => e.id === "f");
    if (flex?.type === "flex") {
      expect(flex.children[0]).toMatchObject({ w: 50, h: 8 });
      expect(flex.children[0]).not.toHaveProperty("x");
    } else {
      expect.unreachable();
    }
  });
});

describe("Rotate", () => {
  // b is x100 y10 w40 h20 → center (120, 20). The handle press point is the top edge's midpoint (120, 10)
  function pressRotate(ctx: InteractionContext) {
    return reduceInteraction(
      IDLE,
      down({ x: 120, y: 10 }, "b", { handle: "rotate" }),
      ctx,
    );
  }

  it("handle press then exceeding the threshold enters rotating, and pointerUp writes rotate to the document", () => {
    const ctx = makeCtx(["b"]);
    const pressed = pressRotate(ctx);
    expect(pressed.state.kind).toBe("pressing");

    // From directly above center (−90°) to directly beside it (0°) = 90° clockwise
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 130, y: 20 } },
      ctx,
    );
    expect(moved.state).toMatchObject({
      kind: "rotating",
      id: "b",
      center: { x: 120, y: 20 },
      baseRotate: 0,
      rotate: 90,
    });

    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 130, y: 20 } },
      ctx,
    );
    expect(up.state).toEqual(IDLE);
    const el = up.effect?.document?.elements.find((e) => e.id === "b");
    expect(el).toMatchObject({ rotate: 90 });
  });

  it("stays pressing below the threshold", () => {
    const ctx = makeCtx(["b"]);
    const pressed = pressRotate(ctx);
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 120.5, y: 10.5 } },
      ctx,
    );
    expect(moved.state.kind).toBe("pressing");
  });

  it("the current angle rounds to 0.1° and snaps to 15° increments with Shift", () => {
    const ctx = makeCtx(["b"]);
    const pressed = pressRotate(ctx);
    // (130, 25) is atan2(5, 10) ≈ 26.565° from center → a rotation of 116.565°
    const free = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 130, y: 25 } },
      ctx,
    );
    expect(free.state).toMatchObject({ kind: "rotating", rotate: 116.6 });

    const snapped = reduceInteraction(
      free.state,
      { kind: "pointerMove", shiftKey: true, at: { x: 130, y: 25 } },
      ctx,
    );
    expect(snapped.state).toMatchObject({ kind: "rotating", rotate: 120 });
  });

  it("rotates from the existing rotate as a baseline", () => {
    const elements = ELEMENTS.map((el) =>
      el.id === "b" ? { ...el, rotate: 30 } : el,
    );
    const ctx = makeCtx(["b"], {}, elements);
    const pressed = pressRotate(ctx);
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 130, y: 20 } },
      ctx,
    );
    expect(moved.state).toMatchObject({ kind: "rotating", rotate: 120 });
  });

  it("pointerUp doesn't commit when the rotation amount is unchanged", () => {
    const ctx = makeCtx(["b"]);
    const pressed = pressRotate(ctx);
    // Exceeds the threshold, but the angle is still the same straight-up direction as at press time
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 120, y: 5 } },
      ctx,
    );
    expect(moved.state).toMatchObject({ kind: "rotating", rotate: 0 });
    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 120, y: 5 } },
      ctx,
    );
    expect(up.state).toEqual(IDLE);
    expect(up.effect).toBeNull();
  });

  it("Esc cancels rotating with no effect", () => {
    const ctx = makeCtx(["b"]);
    const pressed = pressRotate(ctx);
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 130, y: 20 } },
      ctx,
    );
    expect(moved.state.kind).toBe("rotating");
    const cancelled = reduceInteraction(moved.state, { kind: "cancel" }, ctx);
    expect(cancelled.state).toEqual(IDLE);
    expect(cancelled.effect).toBeNull();
  });

  it("a rotate handle operation on a flex falls back to idle", () => {
    const ctx = makeCtx(["f"]);
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 40, y: 100 }, "f", { handle: "rotate" }),
      ctx,
    );
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 60, y: 120 } },
      ctx,
    );
    expect(moved.state).toEqual(IDLE);
  });
});

describe("Marquee", () => {
  it("rectangle intersection selects only top-level elements (excluding flex children and ghosts)", () => {
    const ctx = makeCtx();
    const started = reduceInteraction(IDLE, down({ x: 5, y: 5 }, null), ctx);
    const moved = reduceInteraction(
      started.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 62, y: 110 } },
      ctx,
    );
    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 62, y: 110 } },
      ctx,
    );
    // The rectangle (5,5)-(62,110) intersects a and the flex container f. ghost g is excluded, since it's outside the context
    expect(up.state).toEqual(IDLE);
    expect(up.effect?.selection).toEqual(["a", "f"]);
    expect(up.effect?.document).toBeUndefined();
  });
});

describe("Marquee preview", () => {
  it("a move beyond the threshold makes previewIds include intersecting elements (excluding flex children and ghosts)", () => {
    const ctx = makeCtx();
    const started = reduceInteraction(IDLE, down({ x: 5, y: 5 }, null), ctx);
    const moved = reduceInteraction(
      started.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 62, y: 110 } },
      ctx,
    );
    expect(moved.state.kind).toBe("marquee");
    if (moved.state.kind === "marquee") {
      expect(moved.state.previewIds).toEqual(["a", "f"]);
    }
  });

  it("previewIds is empty for a move below the threshold", () => {
    const ctx = makeCtx();
    const started = reduceInteraction(IDLE, down({ x: 5, y: 5 }, null), ctx);
    const moved = reduceInteraction(
      started.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 5.5, y: 5.3 } },
      ctx,
    );
    expect(moved.state.kind).toBe("marquee");
    if (moved.state.kind === "marquee") {
      expect(moved.state.previewIds).toEqual([]);
    }
  });

  it("pointerUp's effect.selection matches the previewIds just before it", () => {
    const ctx = makeCtx();
    const started = reduceInteraction(IDLE, down({ x: 5, y: 5 }, null), ctx);
    const moved = reduceInteraction(
      started.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 62, y: 110 } },
      ctx,
    );
    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 62, y: 110 } },
      ctx,
    );
    if (moved.state.kind === "marquee") {
      expect(up.effect?.selection).toEqual(moved.state.previewIds);
    } else {
      expect.unreachable();
    }
  });
});

describe("liveBoxFor", () => {
  const MOVING: InteractionState = {
    kind: "moving",
    ids: ["a"],
    start: { x: 12, y: 12 },
    offset: { x: 5, y: 3 },
    guides: [],
    flexId: null,
    insertIndex: null,
  };
  const RESIZING: InteractionState = {
    kind: "resizing",
    id: "b",
    handle: "se",
    start: { x: 140, y: 30 },
    box: { x: 100, y: 10, w: 50, h: 30 },
    guides: [],
  };

  it("during moving, returns the box with the offset added for the target id", () => {
    const ctx = makeCtx(["a"]);
    const view = ctx.layout.find((v) => v.id === "a");
    if (view === undefined) {
      expect.unreachable();
      return;
    }
    expect(liveBoxFor(MOVING, view)).toEqual({ x: 15, y: 13, w: 40, h: 8 });
  });

  it("during moving, returns null for an id that isn't the target", () => {
    const ctx = makeCtx(["a"]);
    const view = ctx.layout.find((v) => v.id === "b");
    if (view === undefined) {
      expect.unreachable();
      return;
    }
    expect(liveBoxFor(MOVING, view)).toBeNull();
  });

  it("during resizing, returns interaction.box for the target id", () => {
    const ctx = makeCtx(["b"]);
    const view = ctx.layout.find((v) => v.id === "b");
    if (view === undefined) {
      expect.unreachable();
      return;
    }
    expect(liveBoxFor(RESIZING, view)).toEqual({ x: 100, y: 10, w: 50, h: 30 });
  });

  it("during resizing, returns null for an id that isn't the target", () => {
    const ctx = makeCtx(["b"]);
    const view = ctx.layout.find((v) => v.id === "a");
    if (view === undefined) {
      expect.unreachable();
      return;
    }
    expect(liveBoxFor(RESIZING, view)).toBeNull();
  });

  it("returns null for idle and marquee", () => {
    const ctx = makeCtx();
    const view = ctx.layout.find((v) => v.id === "a");
    if (view === undefined) {
      expect.unreachable();
      return;
    }
    expect(liveBoxFor(IDLE, view)).toBeNull();
    const marquee: InteractionState = {
      kind: "marquee",
      start: { x: 0, y: 0 },
      current: { x: 0, y: 0 },
      previewIds: [],
    };
    expect(liveBoxFor(marquee, view)).toBeNull();
  });
});

describe("Palette placement", () => {
  it("a drop outside the paper is cancelled", () => {
    const ctx = makeCtx();
    const started = reduceInteraction(
      IDLE,
      { kind: "paletteDown", elementType: "rect", at: null },
      ctx,
    );
    expect(started.state.kind).toBe("placing");
    const moved = reduceInteraction(
      started.state,
      { kind: "pointerMove", shiftKey: false, at: { x: -5, y: -5 } },
      ctx,
    );
    if (moved.state.kind === "placing") {
      expect(moved.state.at).toBeNull();
      expect(moved.state.box).toBeNull();
    }
    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: -5, y: -5 } },
      ctx,
    );
    expect(up.state).toEqual(IDLE);
    expect(up.effect).toBeNull();
  });

  it("a drop on the paper adds an element at its default size and singly selects the new element", () => {
    const ctx = makeCtx();
    const started = reduceInteraction(
      IDLE,
      { kind: "paletteDown", elementType: "rect", at: null },
      ctx,
    );
    const moved = reduceInteraction(
      started.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 50.4, y: 60.4 } },
      ctx,
    );
    if (moved.state.kind === "placing") {
      // The pointer-centered box (30.4, 50.4) snaps to the grid (30, 50)
      expect(moved.state.box).toMatchObject({ x: 30, y: 50, w: 40, h: 20 });
    } else {
      expect.unreachable();
    }
    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 50.4, y: 60.4 } },
      ctx,
    );
    expect(up.effect?.selection).toEqual(["rect1"]);
    const added = up.effect?.document?.elements.find((el) => el.id === "rect1");
    expect(added).toMatchObject({ type: "rect", x: 30, y: 50, w: 40, h: 20 });
  });

  it("switches to insertion mode over a flex container", () => {
    const ctx = makeCtx();
    const started = reduceInteraction(
      IDLE,
      { kind: "paletteDown", elementType: "text", at: null },
      ctx,
    );
    const moved = reduceInteraction(
      started.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 30, y: 104 } },
      ctx,
    );
    if (moved.state.kind === "placing") {
      expect(moved.state.flexId).toBe("f");
      expect(moved.state.insertIndex).toBe(0);
    } else {
      expect.unreachable();
    }
    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 30, y: 104 } },
      ctx,
    );
    const flex = up.effect?.document?.elements.find((el) => el.id === "f");
    expect(flex?.type).toBe("flex");
    if (flex?.type === "flex") {
      expect(flex.children.map((c) => c.id)).toEqual(["text1", "ct1", "ct2"]);
      const inserted = flex.children[0];
      expect(inserted).not.toHaveProperty("x");
      expect(inserted).not.toHaveProperty("pages");
    }
    expect(up.effect?.selection).toEqual(["text1"]);
  });

  it("table doesn't switch to insertion mode even over flex", () => {
    const ctx = makeCtx();
    const started = reduceInteraction(
      IDLE,
      { kind: "paletteDown", elementType: "table", at: null },
      ctx,
    );
    const moved = reduceInteraction(
      started.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 30, y: 104 } },
      ctx,
    );
    if (moved.state.kind === "placing") {
      expect(moved.state.flexId).toBeNull();
      expect(moved.state.box).not.toBeNull();
    } else {
      expect.unreachable();
    }
  });
});

describe("Reordering flex children", () => {
  it("dragging a child enters reordering, and dropping changes the order", () => {
    const ctx = makeCtx(["ct1"]);
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 30, y: 104 }, "ct1"),
      ctx,
    );
    expect(pressed.state.kind).toBe("pressing");
    expect(pressed.effect).toBeNull();

    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 30, y: 115 } },
      ctx,
    );
    expect(moved.state.kind).toBe("reordering");
    if (moved.state.kind === "reordering") {
      expect(moved.state.flexId).toBe("f");
      expect(moved.state.insertIndex).toBe(2);
    }

    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 30, y: 115 } },
      ctx,
    );
    const flex = up.effect?.document?.elements.find((el) => el.id === "f");
    if (flex?.type === "flex") {
      expect(flex.children.map((c) => c.id)).toEqual(["ct2", "ct1"]);
    } else {
      expect.unreachable();
    }
    expect(up.effect?.selection).toEqual(["ct1"]);
  });

  it("a drop back at the same position has no effect", () => {
    const ctx = makeCtx(["ct1"]);
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 30, y: 104 }, "ct1"),
      ctx,
    );
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 30, y: 105.5 } },
      ctx,
    );
    expect(moved.state.kind).toBe("reordering");
    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 30, y: 105.5 } },
      ctx,
    );
    expect(up.state).toEqual(IDLE);
    expect(up.effect).toBeNull();
  });
});

describe("Progressive selection: resolveClickTarget", () => {
  it("returns the outermost element when nothing is selected", () => {
    expect(resolveClickTarget(makeCtx(), "ct1")).toBe("f");
  });

  it("returns the child while the parent (flex) is selected", () => {
    expect(resolveClickTarget(makeCtx(["f"]), "ct1")).toBe("ct1");
  });

  it("keeps the same child selected while a child is selected (doesn't go deeper at a leaf)", () => {
    expect(resolveClickTarget(makeCtx(["ct1"]), "ct1")).toBe("ct1");
  });

  it("clicking a sibling rectangle directly selects that sibling immediately", () => {
    expect(resolveClickTarget(makeCtx(["ct1"]), "ct2")).toBe("ct2");
  });

  it("clicking while an unrelated selection is active resets to the outermost element", () => {
    expect(resolveClickTarget(makeCtx(["b"]), "ct1")).toBe("f");
  });

  it("nested flex goes one level deeper per click", () => {
    const nested: IrFlexElement = {
      type: "flex",
      id: "of",
      x: 150,
      y: 150,
      pages: "first",
      direction: "column",
      gap: 0,
      justifyContent: "start",
      alignItems: "start",
      children: [
        {
          type: "flex",
          id: "mf",
          direction: "row",
          gap: 0,
          justifyContent: "start",
          alignItems: "start",
          children: [
            {
              type: "text",
              id: "lf",
              w: 20,
              h: 8,
              text: "leaf",
              fontSize: 10,
              align: "left",
              lineHeight: 1.25,
            },
          ],
        },
      ],
    };
    const elements = [...ELEMENTS, nested];
    expect(resolveClickTarget(makeCtx([], {}, elements), "lf")).toBe("of");
    expect(resolveClickTarget(makeCtx(["of"], {}, elements), "lf")).toBe("mf");
    expect(resolveClickTarget(makeCtx(["mf"], {}, elements), "lf")).toBe("lf");
  });
});

describe("#5 Drag-inserting existing elements", () => {
  it("dragging a single non-table element over flex sets flexId/insertIndex and clears guides", () => {
    const ctx = makeCtx(["a"]);
    const pressed = reduceInteraction(IDLE, down({ x: 12, y: 12 }, "a"), ctx);
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 30, y: 104 } },
      ctx,
    );
    expect(moved.state.kind).toBe("moving");
    if (moved.state.kind === "moving") {
      expect(moved.state.flexId).toBe("f");
      expect(moved.state.insertIndex).toBe(0);
      expect(moved.state.guides).toEqual([]);
    }
  });

  it("flexId reverts to null once dragged out of flex", () => {
    const ctx = makeCtx(["a"]);
    const pressed = reduceInteraction(IDLE, down({ x: 12, y: 12 }, "a"), ctx);
    const onFlex = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 30, y: 104 } },
      ctx,
    );
    const off = reduceInteraction(
      onFlex.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 30, y: 12 } },
      ctx,
    );
    if (off.state.kind === "moving") {
      expect(off.state.flexId).toBeNull();
    } else {
      expect.unreachable();
    }
  });

  it("pointerUp removes it from the top level and moves it into children (1 effect)", () => {
    const ctx = makeCtx(["a"]);
    const pressed = reduceInteraction(IDLE, down({ x: 12, y: 12 }, "a"), ctx);
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 30, y: 104 } },
      ctx,
    );
    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 30, y: 104 } },
      ctx,
    );
    expect(
      up.effect?.document?.elements.find((el) => el.id === "a"),
    ).toBeUndefined();
    const flex = up.effect?.document?.elements.find((el) => el.id === "f");
    if (flex?.type === "flex") {
      expect(flex.children.map((c) => c.id)).toEqual(["a", "ct1", "ct2"]);
      expect(flex.children[0]).not.toHaveProperty("x");
    } else {
      expect.unreachable();
    }
    expect(up.effect?.selection).toEqual(["a"]);
  });

  it("table doesn't get a flexId even over flex", () => {
    const table: IrElement = {
      type: "table",
      id: "tbl",
      x: 10,
      y: 10,
      bind: "items",
      columns: [{ key: "c", label: "c", width: 30, align: "left" }],
      rowHeight: 8,
      headerHeight: 8,
      fontSize: 10,
      maxY: 240,
      continuationY: 10,
      minRows: 1,
    };
    const ctx = makeCtx(["tbl"], {}, [...ELEMENTS, table]);
    const pressed = reduceInteraction(IDLE, down({ x: 12, y: 12 }, "tbl"), ctx);
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 30, y: 104 } },
      ctx,
    );
    if (moved.state.kind === "moving") {
      expect(moved.state.flexId).toBeNull();
    } else {
      expect.unreachable();
    }
  });

  it("a multi-selection doesn't get a flexId", () => {
    const ctx = makeCtx(["a", "b"]);
    const pressed = reduceInteraction(IDLE, down({ x: 12, y: 12 }, "a"), ctx);
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 30, y: 104 } },
      ctx,
    );
    if (moved.state.kind === "moving") {
      expect(moved.state.flexId).toBeNull();
    } else {
      expect.unreachable();
    }
  });

  it("a flex can't be dropped onto its own descendant (nested flex) (exclude)", () => {
    const outer: IrFlexElement = {
      type: "flex",
      id: "outer",
      x: 150,
      y: 150,
      pages: "first",
      direction: "column",
      gap: 0,
      justifyContent: "start",
      alignItems: "start",
      children: [
        {
          type: "flex",
          id: "inner",
          direction: "row",
          gap: 0,
          justifyContent: "start",
          alignItems: "start",
          children: [
            {
              type: "text",
              id: "leaf",
              w: 20,
              h: 8,
              text: "leaf",
              fontSize: 10,
              align: "left",
              lineHeight: 1.25,
            },
          ],
        },
      ],
    };
    const ctx = makeCtx(["outer"], {}, [...ELEMENTS, outer]);
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 155, y: 152 }, "outer"),
      ctx,
    );
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 160, y: 155 } },
      ctx,
    );
    if (moved.state.kind === "moving") {
      expect(moved.state.flexId).toBeNull();
    } else {
      expect.unreachable();
    }
  });
});

describe("#5 Taking out of / moving between flex containers", () => {
  it("dragging a child out of flex sets targetFlexId to null", () => {
    const ctx = makeCtx(["ct1"]);
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 30, y: 104 }, "ct1"),
      ctx,
    );
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 100, y: 50 } },
      ctx,
    );
    expect(moved.state.kind).toBe("reordering");
    if (moved.state.kind === "reordering") {
      expect(moved.state.targetFlexId).toBeNull();
    }
  });

  it("a drop inside the paper promotes it to top level (x/y from the ghost position, pages from the top-level ancestor)", () => {
    const ctx = makeCtx(["ct1"]);
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 30, y: 104 }, "ct1"),
      ctx,
    );
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 100, y: 50 } },
      ctx,
    );
    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 100, y: 50 } },
      ctx,
    );
    const el = up.effect?.document?.elements.find((e) => e.id === "ct1");
    expect(el).toMatchObject({ x: 90, y: 46, pages: "first" });
    const flex = up.effect?.document?.elements.find((e) => e.id === "f");
    if (flex?.type === "flex") {
      expect(flex.children.map((c) => c.id)).toEqual(["ct2"]);
    } else {
      expect.unreachable();
    }
    expect(up.effect?.selection).toEqual(["ct1"]);
  });

  it("a drop outside the paper has no effect", () => {
    const ctx = makeCtx(["ct1"]);
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 30, y: 104 }, "ct1"),
      ctx,
    );
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: -10, y: 50 } },
      ctx,
    );
    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: -10, y: 50 } },
      ctx,
    );
    expect(up.state).toEqual(IDLE);
    expect(up.effect).toBeNull();
  });

  it("dropping over another flex moves it between children", () => {
    const other: IrFlexElement = {
      type: "flex",
      id: "f2",
      x: 150,
      y: 100,
      pages: "first",
      direction: "column",
      gap: 2,
      justifyContent: "start",
      alignItems: "start",
      children: [
        {
          type: "text",
          id: "ot1",
          w: 30,
          h: 8,
          text: "other",
          fontSize: 10,
          align: "left",
          lineHeight: 1.25,
        },
      ],
    };
    const ctx = makeCtx(["ct1"], {}, [...ELEMENTS, other]);
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 30, y: 104 }, "ct1"),
      ctx,
    );
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 155, y: 104 } },
      ctx,
    );
    expect(moved.state.kind).toBe("reordering");
    if (moved.state.kind === "reordering") {
      expect(moved.state.targetFlexId).toBe("f2");
    }
    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 155, y: 104 } },
      ctx,
    );
    const sourceFlex = up.effect?.document?.elements.find((e) => e.id === "f");
    if (sourceFlex?.type === "flex") {
      expect(sourceFlex.children.map((c) => c.id)).toEqual(["ct2"]);
    } else {
      expect.unreachable();
    }
    const targetFlex = up.effect?.document?.elements.find((e) => e.id === "f2");
    if (targetFlex?.type === "flex") {
      expect(targetFlex.children.map((c) => c.id)).toEqual(["ct1", "ot1"]);
    } else {
      expect.unreachable();
    }
  });
});

describe("#15 Resizing flex children", () => {
  it("handle press then resizing then pointerUp applies resizeFlexChild's result, and guides is always empty", () => {
    const ctx = makeCtx(["ct1"]);
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 60, y: 108 }, "ct1", { handle: "se" }),
      ctx,
    );
    expect(pressed.state.kind).toBe("pressing");
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 70, y: 120 } },
      ctx,
    );
    expect(moved.state.kind).toBe("resizing");
    if (moved.state.kind === "resizing") {
      expect(moved.state.guides).toEqual([]);
      expect(moved.state.box).toMatchObject({ x: 20, y: 100, w: 50, h: 20 });
    }
    const up = reduceInteraction(
      moved.state,
      { kind: "pointerUp", at: { x: 70, y: 120 } },
      ctx,
    );
    const flex = up.effect?.document?.elements.find((e) => e.id === "f");
    if (flex?.type === "flex") {
      expect(flex.children[0]).toMatchObject({ w: 50, h: 20 });
      expect(flex.children[0]).not.toHaveProperty("x");
    } else {
      expect.unreachable();
    }
  });

  it("an unchanged drop has no effect", () => {
    const ctx = makeCtx(["ct1"]);
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 60, y: 108 }, "ct1", { handle: "se" }),
      ctx,
    );
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 70, y: 120 } },
      ctx,
    );
    const movedBack = reduceInteraction(
      moved.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 60, y: 108 } },
      ctx,
    );
    const up = reduceInteraction(
      movedBack.state,
      { kind: "pointerUp", at: { x: 60, y: 108 } },
      ctx,
    );
    expect(up.state).toEqual(IDLE);
    expect(up.effect).toBeNull();
  });

  it("the 1mm clamp applies", () => {
    const ctx = makeCtx(["ct1"]);
    const pressed = reduceInteraction(
      IDLE,
      down({ x: 60, y: 108 }, "ct1", { handle: "se" }),
      ctx,
    );
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 15, y: 98 } },
      ctx,
    );
    if (moved.state.kind === "resizing") {
      expect(moved.state.box.w).toBe(1);
      expect(moved.state.box.h).toBe(1);
    } else {
      expect.unreachable();
    }
  });
});
