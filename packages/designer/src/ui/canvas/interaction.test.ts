import type { IrDocument, IrElement, IrFlexElement } from "@denreport/core";
import { describe, expect, it } from "vitest";
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
    sampleScenarios: defaultScenarioSet(),
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

describe("クリックと選択", () => {
  it("クリック（閾値未満）は選択のみで、pointerUp に文書 effect がない", () => {
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

  it("Shift+クリックで選択に追加・選択済みなら除外する", () => {
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

  it("空白の pointerDown は選択を解除して marquee に入る", () => {
    const result = reduceInteraction(
      IDLE,
      down({ x: 5, y: 5 }, null),
      makeCtx(["a"]),
    );
    expect(result.state.kind).toBe("marquee");
    expect(result.effect).toEqual({ selection: [] });
  });
});

describe("グループ所属要素の選択展開", () => {
  const GROUPS: readonly ElementGroup[] = [
    { id: "group1", memberIds: ["a", "b"] },
  ];

  it("クリックでグループの全メンバーが選択される", () => {
    const ctx = makeCtx([], {}, ELEMENTS, GROUPS);
    const pressed = reduceInteraction(IDLE, down({ x: 12, y: 12 }, "a"), ctx);
    expect(pressed.effect).toEqual({ selection: ["a", "b"] });
  });

  it("Shift+クリックはグループ単位で加算・除去する", () => {
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

  it("マーキーの部分ヒットでもグループ全体が previewIds になる", () => {
    const ctx = makeCtx([], {}, ELEMENTS, GROUPS);
    const started = reduceInteraction(IDLE, down({ x: 5, y: 5 }, null), ctx);
    // 矩形 (5,5)-(60,20) は a のみに交差し、b（x100〜140）は掠らない
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

  it("選択済みグループのドラッグは全メンバーを移動対象にする", () => {
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

describe("移動", () => {
  it("閾値超過で moving に遷移し、pointerUp で effect がちょうど1回返る", () => {
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
      // 素の dx=18 がグリッド（x=30）に吸着して 20 になる
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

  it("Esc / cancel で effect なしに idle へ戻る", () => {
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

  it("ゴースト（現文脈外要素）はスナップ候補に入らない", () => {
    // ghost g の左端 x=13.0 の近くへ動かしても、要素ガイドは出ずグリッドに吸着する
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

  it("customGuides への移動吸着が snapContextFor 経由で効く（同座標のグリッドより優先されガイドが返る）", () => {
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

  it("rest 文脈では table の縦移動が continuationY に反映される", () => {
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

  it("first 文脈では continuationY が y と等値の table の縦移動が continuationY にも反映される", () => {
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

  it("first 文脈でも continuationY が y と異なる table は縦移動しても continuationY が不変", () => {
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

describe("リサイズ", () => {
  it("ハンドル押下 → 閾値超過で resizing、pointerUp で寸法が反映される", () => {
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

  it("動かして元に戻して離すと effect なし（無変更の履歴を作らない）", () => {
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

  it("最小寸法 1mm でクランプされる", () => {
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

describe("回転要素のリサイズ", () => {
  // b は x100 y10 w40 h20 → 中心 (120, 20)
  const B_ORIG = { x: 100, y: 10, w: 40, h: 20 };

  function withBRotate(rotate: number): readonly IrElement[] {
    return ELEMENTS.map((el) => (el.id === "b" ? { ...el, rotate } : el));
  }

  // rotatePointDeg（SelectionOverlay）と同じ回転行列で、box 中心周りの点 p の画面座標を求める
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

  it("rot=90・e ハンドル（見た目の下辺）・縦ドラッグで幅が伸びる", () => {
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

  it("rot=90・e ハンドル・横ドラッグではサイズ不変（回転前の生差分は写像されない）", () => {
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

  it("rot=90・n ハンドル（見た目の右辺）・横ドラッグで反対側の辺が固定される", () => {
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

  it("rot=45・se ハンドル・ローカル +x 方向ドラッグでアンカー（nw）が画面上不動", () => {
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

  it("回転あり・元に戻して離す → effect なし", () => {
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

  it("クランプで w が最小寸法に切られても、掴んでいない辺は画面上不動", () => {
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

  it("スナップはモデル箱基準のまま働き、回転補正は後段に乗る", () => {
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

  it("回転した line（退化箱）は交差軸成分が常に 0 で成立する", () => {
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

  it("回転した flex 子は逆回転のみ適用され、x/y は書かれない", () => {
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

describe("回転", () => {
  // b は x100 y10 w40 h20 → 中心 (120, 20)。ハンドル押下点は上辺中央 (120, 10)
  function pressRotate(ctx: InteractionContext) {
    return reduceInteraction(
      IDLE,
      down({ x: 120, y: 10 }, "b", { handle: "rotate" }),
      ctx,
    );
  }

  it("ハンドル押下 → 閾値超過で rotating、pointerUp で rotate が文書に入る", () => {
    const ctx = makeCtx(["b"]);
    const pressed = pressRotate(ctx);
    expect(pressed.state.kind).toBe("pressing");

    // 中心の真上 (−90°) から真横 (0°) へ = 時計回りに 90°
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

  it("閾値未満では pressing のまま", () => {
    const ctx = makeCtx(["b"]);
    const pressed = pressRotate(ctx);
    const moved = reduceInteraction(
      pressed.state,
      { kind: "pointerMove", shiftKey: false, at: { x: 120.5, y: 10.5 } },
      ctx,
    );
    expect(moved.state.kind).toBe("pressing");
  });

  it("現在角は 0.1° に丸められ、Shift で 15° にスナップする", () => {
    const ctx = makeCtx(["b"]);
    const pressed = pressRotate(ctx);
    // (130, 25) は中心から atan2(5, 10) ≈ 26.565° → 回転量 116.565°
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

  it("既存の rotate を基点に回転する", () => {
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

  it("回転量が無変化なら pointerUp で commit しない", () => {
    const ctx = makeCtx(["b"]);
    const pressed = pressRotate(ctx);
    // 閾値は超えるが角度は押下時と同じ真上方向
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

  it("Esc で rotating がキャンセルされ effect なし", () => {
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

  it("flex への rotate ハンドル操作は idle に落ちる", () => {
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

describe("マーキー", () => {
  it("矩形交差でトップレベル要素のみ選択される（flex 子・ゴースト除外）", () => {
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
    // 矩形 (5,5)-(62,110): a と flex コンテナ f に交差。ghost g は文脈外なので除外
    expect(up.state).toEqual(IDLE);
    expect(up.effect?.selection).toEqual(["a", "f"]);
    expect(up.effect?.document).toBeUndefined();
  });
});

describe("マーキーのプレビュー", () => {
  it("しきい値超の move で previewIds が交差要素を含む（flex 子・ゴーストは除外）", () => {
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

  it("しきい値未満の move では previewIds が空", () => {
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

  it("pointerUp の effect.selection は直前の previewIds と一致する", () => {
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

  it("moving 中は対象 id にオフセット加算後の box を返す", () => {
    const ctx = makeCtx(["a"]);
    const view = ctx.layout.find((v) => v.id === "a");
    if (view === undefined) {
      expect.unreachable();
      return;
    }
    expect(liveBoxFor(MOVING, view)).toEqual({ x: 15, y: 13, w: 40, h: 8 });
  });

  it("moving 中でも対象外の id には null を返す", () => {
    const ctx = makeCtx(["a"]);
    const view = ctx.layout.find((v) => v.id === "b");
    if (view === undefined) {
      expect.unreachable();
      return;
    }
    expect(liveBoxFor(MOVING, view)).toBeNull();
  });

  it("resizing 中は対象 id に interaction.box を返す", () => {
    const ctx = makeCtx(["b"]);
    const view = ctx.layout.find((v) => v.id === "b");
    if (view === undefined) {
      expect.unreachable();
      return;
    }
    expect(liveBoxFor(RESIZING, view)).toEqual({ x: 100, y: 10, w: 50, h: 30 });
  });

  it("resizing 中でも対象外の id には null を返す", () => {
    const ctx = makeCtx(["b"]);
    const view = ctx.layout.find((v) => v.id === "a");
    if (view === undefined) {
      expect.unreachable();
      return;
    }
    expect(liveBoxFor(RESIZING, view)).toBeNull();
  });

  it("idle・marquee では null を返す", () => {
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

describe("パレット配置", () => {
  it("紙外ドロップはキャンセルされる", () => {
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

  it("紙上ドロップで既定寸法の要素が追加され、新要素が単一選択になる", () => {
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
      // ポインタ中心の箱 (30.4, 50.4) がグリッド (30, 50) に吸着
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

  it("flex コンテナ上では挿入に切り替わる", () => {
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

  it("table は flex 上でも挿入に切り替わらない", () => {
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

describe("flex 子の並び替え", () => {
  it("子のドラッグは reordering になり、ドロップで並びが変わる", () => {
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

  it("同位置に戻すドロップは effect なし", () => {
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

describe("段階的選択 resolveClickTarget", () => {
  it("選択なしでは最外側の要素を返す", () => {
    expect(resolveClickTarget(makeCtx(), "ct1")).toBe("f");
  });

  it("親（flex）選択中は子を返す", () => {
    expect(resolveClickTarget(makeCtx(["f"]), "ct1")).toBe("ct1");
  });

  it("子選択中は同じ子を維持する（末端で深くしない）", () => {
    expect(resolveClickTarget(makeCtx(["ct1"]), "ct1")).toBe("ct1");
  });

  it("兄弟の矩形を直接クリックすると即座にその兄弟が選ばれる", () => {
    expect(resolveClickTarget(makeCtx(["ct1"]), "ct2")).toBe("ct2");
  });

  it("無関係な選択中のクリックは最外側にリセットされる", () => {
    expect(resolveClickTarget(makeCtx(["b"]), "ct1")).toBe("f");
  });

  it("入れ子 flex では1クリックごとに1段ずつ深くなる", () => {
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

describe("#5 既存要素のドラッグ挿入", () => {
  it("単一・非 table のドラッグは flex 上で flexId/insertIndex を持ち guides が空になる", () => {
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

  it("flex 外へ出ると flexId が null に戻る", () => {
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

  it("pointerUp でトップレベルから消え children に入る（1 effect）", () => {
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

  it("table は flex 上でも flexId が付かない", () => {
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

  it("複数選択では flexId が付かない", () => {
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

  it("flex 自身をその子孫（入れ子 flex）へ落とせない（exclude）", () => {
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

describe("#5 flex からの取り出し・移し替え", () => {
  it("子ドラッグで flex 外に出ると targetFlexId が null になる", () => {
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

  it("紙内ドロップでトップレベル化する（x/y はゴースト位置、pages はトップレベル祖先）", () => {
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

  it("紙外ドロップは effect なし", () => {
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

  it("別 flex の上でドロップすると children 間を移動する", () => {
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

describe("#15 flex 子のリサイズ", () => {
  it("ハンドル押下→resizing→pointerUp で resizeFlexChild の結果が反映され guides は常に空", () => {
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

  it("無変更ドロップは effect なし", () => {
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

  it("1mm クランプが効く", () => {
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
