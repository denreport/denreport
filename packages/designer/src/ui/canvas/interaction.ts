import type {
  IrDocument,
  IrElement,
  IrElementType,
  IrFlexChild,
  IrFlexElement,
  IrPages,
  IrTableElement,
} from "@denreport/core";
import {
  DRAG_THRESHOLD_PX,
  MIN_SIZE_MM,
  SNAP_TOLERANCE_PX,
} from "../../state/constants";
import type { DefaultsMessages } from "../../state/defaults";
import { createDefaultElement, defaultSizeMm } from "../../state/defaults";
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
} from "../../state/elements";
import type { MmBox, PlacedElementView } from "../../state/geometry";
import { rotationDeg, roundMm, visibleInContext } from "../../state/geometry";
import { expandIdsToGroups } from "../../state/groups";
import { guidesInPage } from "../../state/guides";
import type { MovingEdges, SnapContext, SnapGuide } from "../../state/snapping";
import { snapForMove, snapForResize } from "../../state/snapping";
import type { EditorState, PageContext } from "../../state/types";

export type HandleId =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "line-start"
  | "line-end"
  | "rotate";

/** rotate 属性を持てる（回転ハンドル・回転欄を出せる）要素型か */
export function isRotatable(type: IrElementType): boolean {
  return type !== "table" && type !== "flex";
}

export interface MmPoint {
  readonly x: number;
  readonly y: number;
}

export type InteractionState =
  | { readonly kind: "idle" }
  | {
      readonly kind: "pressing";
      readonly targetId: string;
      readonly handle: HandleId | null;
      readonly start: MmPoint;
    }
  | {
      readonly kind: "moving";
      readonly ids: readonly string[];
      readonly start: MmPoint;
      readonly offset: MmPoint;
      readonly guides: readonly SnapGuide[];
      readonly flexId: string | null;
      readonly insertIndex: number | null;
    }
  | {
      readonly kind: "resizing";
      readonly id: string;
      readonly handle: HandleId;
      readonly start: MmPoint;
      readonly box: MmBox;
      readonly guides: readonly SnapGuide[];
    }
  | {
      readonly kind: "rotating";
      readonly id: string;
      readonly center: MmPoint;
      readonly baseRotate: number;
      readonly startPointerAngle: number;
      /** 現在角（Shift 15° スナップ・0.1° 丸め適用後） */
      readonly rotate: number;
    }
  | {
      readonly kind: "marquee";
      readonly start: MmPoint;
      readonly current: MmPoint;
      /** 現時点で離した場合に選択される id。pointerUp はこれをそのまま確定する */
      readonly previewIds: readonly string[];
    }
  | {
      readonly kind: "placing";
      readonly elementType: IrElementType;
      readonly at: MmPoint | null;
      readonly box: MmBox | null;
      readonly flexId: string | null;
      readonly insertIndex: number | null;
      readonly guides: readonly SnapGuide[];
    }
  | {
      readonly kind: "reordering";
      readonly flexId: string;
      readonly childId: string;
      readonly fromIndex: number;
      readonly targetFlexId: string | null;
      readonly insertIndex: number | null;
      readonly at: MmPoint;
      readonly grabOffset: MmPoint;
    };

export type InteractionEvent =
  | {
      readonly kind: "pointerDown";
      readonly at: MmPoint;
      readonly targetId: string | null;
      readonly handle: HandleId | null;
      readonly shiftKey: boolean;
    }
  | {
      readonly kind: "pointerMove";
      readonly at: MmPoint;
      readonly shiftKey: boolean;
    }
  | { readonly kind: "pointerUp"; readonly at: MmPoint }
  | {
      readonly kind: "paletteDown";
      readonly elementType: IrElementType;
      readonly at: MmPoint | null;
    }
  | { readonly kind: "cancel" };

export interface InteractionContext {
  readonly state: EditorState;
  readonly layout: readonly PlacedElementView[];
  readonly toleranceMm: number;
  readonly messages: DefaultsMessages;
}

/** 確定時のみ返る。document は文書編集純関数の適用結果 */
export interface InteractionEffect {
  readonly document?: IrDocument;
  readonly selection?: readonly string[];
}

interface ReduceResult {
  readonly state: InteractionState;
  readonly effect: InteractionEffect | null;
}

const IDLE: InteractionState = { kind: "idle" };

function context(ctx: InteractionContext): PageContext {
  return ctx.state.view.pageContext;
}

function findView(
  ctx: InteractionContext,
  id: string,
): PlacedElementView | undefined {
  return ctx.layout.find((view) => view.id === id);
}

function thresholdMm(ctx: InteractionContext): number {
  return ctx.toleranceMm * (DRAG_THRESHOLD_PX / SNAP_TOLERANCE_PX);
}

function distance(a: MmPoint, b: MmPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function snapContextFor(
  ctx: InteractionContext,
  excludeIds: ReadonlySet<string>,
): SnapContext {
  const pageContext = context(ctx);
  const otherBoxes = ctx.layout
    .filter(
      (view) =>
        view.parentFlexId === null &&
        !excludeIds.has(view.id) &&
        visibleInContext(view.pages, pageContext),
    )
    .map((view) => view.box);
  return {
    page: ctx.state.document.page,
    otherBoxes,
    toleranceMm: ctx.toleranceMm,
    gridEnabled: true,
    guideLines: guidesInPage(ctx.state.customGuides, ctx.state.document.page),
  };
}

function unionBox(boxes: readonly MmBox[]): MmBox {
  let x1 = Number.POSITIVE_INFINITY;
  let y1 = Number.POSITIVE_INFINITY;
  let x2 = Number.NEGATIVE_INFINITY;
  let y2 = Number.NEGATIVE_INFINITY;
  for (const box of boxes) {
    x1 = Math.min(x1, box.x);
    y1 = Math.min(y1, box.y);
    x2 = Math.max(x2, box.x + box.w);
    y2 = Math.max(y2, box.y + box.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function boxContains(box: MmBox, point: MmPoint): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.w &&
    point.y >= box.y &&
    point.y <= box.y + box.h
  );
}

function boxesIntersect(a: MmBox, b: MmBox): boolean {
  return (
    a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h
  );
}

function sameBoxRounded(a: MmBox, b: MmBox): boolean {
  return (
    roundMm(a.x) === roundMm(b.x) &&
    roundMm(a.y) === roundMm(b.y) &&
    roundMm(a.w) === roundMm(b.w) &&
    roundMm(a.h) === roundMm(b.h)
  );
}

function inPaper(ctx: InteractionContext, point: MmPoint): boolean {
  const page = ctx.state.document.page;
  return (
    point.x >= 0 &&
    point.x <= page.width &&
    point.y >= 0 &&
    point.y <= page.height
  );
}

// ---- moving ----

function movingUpdate(
  ids: readonly string[],
  start: MmPoint,
  at: MmPoint,
  ctx: InteractionContext,
): InteractionState {
  const raw: MmPoint = { x: at.x - start.x, y: at.y - start.y };
  const singleId = ids.length === 1 ? ids[0] : undefined;
  const singleView =
    singleId !== undefined ? findView(ctx, singleId) : undefined;
  if (singleView !== undefined && singleView.element.type !== "table") {
    const flexView = innermostFlexAt(
      ctx,
      at,
      idAndDescendants(singleView.element),
    );
    if (flexView !== null) {
      return {
        kind: "moving",
        ids,
        start,
        offset: raw,
        guides: [],
        flexId: flexView.id,
        insertIndex: insertIndexFor(ctx, flexView, at),
      };
    }
  }
  if (!ctx.state.view.snapEnabled) {
    return {
      kind: "moving",
      ids,
      start,
      offset: raw,
      guides: [],
      flexId: null,
      insertIndex: null,
    };
  }
  const idSet = new Set(ids);
  const boxes = ctx.layout
    .filter((view) => idSet.has(view.id))
    .map((view) => view.box);
  const bounds = unionBox(boxes);
  const moved: MmBox = {
    x: bounds.x + raw.x,
    y: bounds.y + raw.y,
    w: bounds.w,
    h: bounds.h,
  };
  const snap = snapForMove(moved, snapContextFor(ctx, idSet));
  return {
    kind: "moving",
    ids,
    start,
    offset: {
      x: raw.x + (snap.box.x - moved.x),
      y: raw.y + (snap.box.y - moved.y),
    },
    guides: snap.guides,
    flexId: null,
    insertIndex: null,
  };
}

function commitMove(
  ctx: InteractionContext,
  ids: readonly string[],
  offset: MmPoint,
): IrDocument {
  const pageContext = context(ctx);
  let doc = ctx.state.document;
  if (pageContext === "first") {
    return moveElements(doc, ids, offset.x, offset.y);
  }
  // rest / last 文脈では table の縦位置は continuationY が担う
  const tables = doc.elements.filter(
    (el): el is Extract<IrElement, { type: "table" }> =>
      el.type === "table" && ids.includes(el.id),
  );
  const tableIds = new Set(tables.map((el) => el.id));
  const otherIds = ids.filter((id) => !tableIds.has(id));
  doc = moveElements(doc, otherIds, offset.x, offset.y);
  for (const table of tables) {
    doc = moveElements(doc, [table.id], offset.x, 0);
    doc = setTableContinuationY(doc, table.id, table.continuationY + offset.y);
  }
  return doc;
}

// ---- resizing ----

function edgesOf(
  handle: HandleId,
  element: IrElement | IrFlexChild,
): MovingEdges {
  if (handle === "line-start" || handle === "line-end") {
    const horizontal =
      element.type === "line" && element.orientation === "horizontal";
    if (handle === "line-start") {
      return horizontal ? { left: true } : { top: true };
    }
    return horizontal ? { right: true } : { bottom: true };
  }
  return {
    left: handle.includes("w"),
    right: handle.includes("e"),
    top: handle.includes("n"),
    bottom: handle.includes("s"),
  };
}

function clampBoxMin(
  box: MmBox,
  edges: MovingEdges,
  minW: number,
  minH: number,
): MmBox {
  let { x, y, w, h } = box;
  if (w < minW) {
    if (edges.left === true) {
      x = box.x + box.w - minW;
    }
    w = minW;
  }
  if (h < minH) {
    if (edges.top === true) {
      y = box.y + box.h - minH;
    }
    h = minH;
  }
  return { x, y, w, h };
}

function resizingUpdate(
  id: string,
  handle: HandleId,
  at: MmPoint,
  start: MmPoint,
  ctx: InteractionContext,
): InteractionState {
  const view = findView(ctx, id);
  if (view === undefined) {
    return IDLE;
  }
  const orig = view.box;
  const edges = edgesOf(handle, view.element);
  const rot = rotationDeg(view.element);
  const rad = (rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rawDx = at.x - start.x;
  const rawDy = at.y - start.y;
  // ハンドル表示は回転後の位置にあるため、ポインタ差分を要素ローカル系へ逆回転してから辺に適用する
  const dx = rot === 0 ? rawDx : rawDx * cos + rawDy * sin;
  const dy = rot === 0 ? rawDy : -rawDx * sin + rawDy * cos;
  const isLine = view.element.type === "line";
  const minW = isLine && orig.w === 0 ? 0 : MIN_SIZE_MM;
  const minH = isLine && orig.h === 0 ? 0 : MIN_SIZE_MM;

  let box: MmBox = {
    x: orig.x + (edges.left === true ? dx : 0),
    y: orig.y + (edges.top === true ? dy : 0),
    w:
      orig.w + (edges.right === true ? dx : 0) - (edges.left === true ? dx : 0),
    h:
      orig.h + (edges.bottom === true ? dy : 0) - (edges.top === true ? dy : 0),
  };
  box = clampBoxMin(box, edges, minW, minH);

  let guides: readonly SnapGuide[] = [];
  // flex 子は確定時に位置が再解決されるため、トップレベルの箱への位置吸着に意味がない
  if (ctx.state.view.snapEnabled && view.parentFlexId === null) {
    const snap = snapForResize(box, edges, snapContextFor(ctx, new Set([id])));
    box = clampBoxMin(snap.box, edges, minW, minH);
    guides = snap.guides;
  }
  // 回転はモデル箱の中心周りのため、中心移動 S に (R−I) を掛けた平行移動で
  // 掴んでいない側の画面位置を固定する（flex 子は x/y を持たないため適用しない）
  if (rot !== 0 && view.parentFlexId === null) {
    const sx = box.x + box.w / 2 - (orig.x + orig.w / 2);
    const sy = box.y + box.h / 2 - (orig.y + orig.h / 2);
    box = {
      x: box.x + sx * (cos - 1) - sy * sin,
      y: box.y + sx * sin + sy * (cos - 1),
      w: box.w,
      h: box.h,
    };
  }
  return { kind: "resizing", id, handle, start, box, guides };
}

// ---- rotating ----

function pointerAngleDeg(center: MmPoint, at: MmPoint): number {
  return (Math.atan2(at.y - center.y, at.x - center.x) * 180) / Math.PI;
}

// M19（±360）に常に収まるよう (-180, 180] へ正規化する
function normalizeAngleDeg(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
}

function rotatingUpdate(
  state: Omit<Extract<InteractionState, { kind: "rotating" }>, "rotate">,
  at: MmPoint,
  shiftKey: boolean,
): InteractionState {
  const pointer = pointerAngleDeg(state.center, at);
  let rotate = state.baseRotate + (pointer - state.startPointerAngle);
  if (shiftKey) {
    rotate = Math.round(rotate / 15) * 15;
  }
  rotate = Math.round(normalizeAngleDeg(rotate) * 10) / 10;
  return { ...state, kind: "rotating", rotate };
}

// ---- marquee ----

function marqueeHits(
  start: MmPoint,
  current: MmPoint,
  ctx: InteractionContext,
): readonly string[] {
  const rect: MmBox = {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    w: Math.abs(current.x - start.x),
    h: Math.abs(current.y - start.y),
  };
  const pageContext = context(ctx);
  return ctx.layout
    .filter(
      (view) =>
        view.parentFlexId === null &&
        visibleInContext(view.pages, pageContext) &&
        boxesIntersect(view.box, rect),
    )
    .map((view) => view.id);
}

/** ドラッグ対象でなければ null。moving は offset 込み、resizing は box をそのまま返す */
export function liveBoxFor(
  interaction: InteractionState,
  view: PlacedElementView,
): MmBox | null {
  if (interaction.kind === "moving") {
    if (!interaction.ids.includes(view.id)) {
      return null;
    }
    return {
      x: view.box.x + interaction.offset.x,
      y: view.box.y + interaction.offset.y,
      w: view.box.w,
      h: view.box.h,
    };
  }
  if (interaction.kind === "resizing") {
    return interaction.id === view.id ? interaction.box : null;
  }
  return null;
}

// ---- flex 挿入位置 ----

function flexChildViews(
  ctx: InteractionContext,
  flexId: string,
): readonly PlacedElementView[] {
  return ctx.layout
    .filter((view) => view.parentFlexId === flexId)
    .sort((a, b) => (a.childIndex ?? 0) - (b.childIndex ?? 0));
}

function insertIndexFor(
  ctx: InteractionContext,
  flexView: PlacedElementView,
  at: MmPoint,
): number {
  const flex = flexView.element as IrFlexElement;
  const children = flexChildViews(ctx, flexView.id);
  const main = flex.direction === "row" ? at.x : at.y;
  let index = 0;
  for (const child of children) {
    const center =
      flex.direction === "row"
        ? child.box.x + child.box.w / 2
        : child.box.y + child.box.h / 2;
    if (main > center) {
      index += 1;
    }
  }
  return index;
}

/** element 自身と、flex なら子孫すべての id。挿入・移動先の判定で自分自身への循環を除くのに使う */
function idAndDescendants(
  element: IrElement | IrFlexChild,
): ReadonlySet<string> {
  const ids = new Set<string>([element.id]);
  function visit(children: readonly IrFlexChild[]): void {
    for (const child of children) {
      ids.add(child.id);
      if (child.type === "flex") {
        visit(child.children);
      }
    }
  }
  if (element.type === "flex") {
    visit(element.children);
  }
  return ids;
}

interface ReorderTarget {
  readonly targetFlexId: string | null;
  readonly insertIndex: number | null;
}

/** ドラッグ中の flex 子が今どの flex 上にあるか（自分自身とその子孫を除いて）判定する */
function reorderTargetFor(
  ctx: InteractionContext,
  childView: PlacedElementView,
  at: MmPoint,
): ReorderTarget {
  const targetFlexView = innermostFlexAt(
    ctx,
    at,
    idAndDescendants(childView.element),
  );
  if (targetFlexView === null) {
    return { targetFlexId: null, insertIndex: null };
  }
  return {
    targetFlexId: targetFlexView.id,
    insertIndex: insertIndexFor(ctx, targetFlexView, at),
  };
}

/** flex 子の取り出し先 pages はトップレベル祖先の pages を引き継ぐ（見えていたものが見え続けるように） */
function topLevelAncestorPages(
  ctx: InteractionContext,
  flexId: string,
): IrPages | null {
  let current = findView(ctx, flexId);
  while (current !== undefined && current.parentFlexId !== null) {
    current = findView(ctx, current.parentFlexId);
  }
  return current?.pages ?? null;
}

/** ポインタ下の最も内側の（可視な）flex コンテナ。excludeIds への挿入は循環になるため除く */
function innermostFlexAt(
  ctx: InteractionContext,
  at: MmPoint,
  excludeIds: ReadonlySet<string>,
): PlacedElementView | null {
  const pageContext = context(ctx);
  let best: PlacedElementView | null = null;
  let bestDepth = -1;
  for (const view of ctx.layout) {
    if (view.element.type !== "flex") {
      continue;
    }
    if (excludeIds.has(view.id)) {
      continue;
    }
    if (!visibleInContext(view.pages, pageContext)) {
      continue;
    }
    if (!boxContains(view.box, at)) {
      continue;
    }
    let depth = 0;
    let parent = view.parentFlexId;
    while (parent !== null) {
      depth += 1;
      parent = findView(ctx, parent)?.parentFlexId ?? null;
    }
    if (depth >= bestDepth) {
      best = view;
      bestDepth = depth;
    }
  }
  return best;
}

// ---- placing ----

function placingUpdate(
  elementType: IrElementType,
  at: MmPoint | null,
  ctx: InteractionContext,
): InteractionState {
  if (at === null || !inPaper(ctx, at)) {
    return {
      kind: "placing",
      elementType,
      at: null,
      box: null,
      flexId: null,
      insertIndex: null,
      guides: [],
    };
  }
  const size = defaultSizeMm(elementType);
  const centered: MmBox = {
    x: at.x - size.w / 2,
    y: at.y - size.h / 2,
    w: size.w,
    h: size.h,
  };
  // table は flex の子になれないため、flex 上でも通常の絶対配置として扱う
  if (elementType !== "table") {
    const flexView = innermostFlexAt(ctx, at, new Set());
    if (flexView !== null) {
      return {
        kind: "placing",
        elementType,
        at,
        box: centered,
        flexId: flexView.id,
        insertIndex: insertIndexFor(ctx, flexView, at),
        guides: [],
      };
    }
  }
  if (!ctx.state.view.snapEnabled) {
    return {
      kind: "placing",
      elementType,
      at,
      box: centered,
      flexId: null,
      insertIndex: null,
      guides: [],
    };
  }
  const snap = snapForMove(centered, snapContextFor(ctx, new Set()));
  return {
    kind: "placing",
    elementType,
    at,
    box: snap.box,
    flexId: null,
    insertIndex: null,
    guides: snap.guides,
  };
}

function commitPlacing(
  state: Extract<InteractionState, { kind: "placing" }>,
  ctx: InteractionContext,
): InteractionEffect | null {
  if (state.at === null || state.box === null) {
    return null;
  }
  const doc = ctx.state.document;
  if (state.flexId !== null && state.insertIndex !== null) {
    // flexId は table 以外でのみ設定される
    const child = toFlexChild(
      createDefaultElement(
        doc,
        state.elementType,
        0,
        0,
        ctx.messages,
      ) as Exclude<IrElement, IrTableElement>,
    );
    return {
      document: insertFlexChild(doc, state.flexId, child, state.insertIndex),
      selection: [child.id],
    };
  }
  const element = createDefaultElement(
    doc,
    state.elementType,
    state.box.x,
    state.box.y,
    ctx.messages,
  );
  return { document: addElement(doc, element), selection: [element.id] };
}

// ---- クリックの階層解決（段階的選択） ----

function ancestorChain(ctx: InteractionContext, id: string): readonly string[] {
  const chain: string[] = [id];
  let parent = findView(ctx, id)?.parentFlexId ?? null;
  while (parent !== null) {
    chain.unshift(parent);
    parent = findView(ctx, parent)?.parentFlexId ?? null;
  }
  return chain;
}

/** DOM ヒット要素の祖先チェーンと現在の選択から、今回のクリックが対象とする要素 id を返す。
    選択チェーンとの共通接頭辞 + 1 段を対象にすることで、クリックのたびに1段ずつ深くなる */
export function resolveClickTarget(
  ctx: InteractionContext,
  targetId: string,
): string {
  const clickChain = ancestorChain(ctx, targetId);
  const selected =
    ctx.state.selection.length === 1 ? ctx.state.selection[0] : undefined;
  if (selected === undefined) {
    return clickChain[0] ?? targetId;
  }
  const selectionChain = ancestorChain(ctx, selected);
  let prefix = 0;
  while (
    prefix < clickChain.length &&
    prefix < selectionChain.length &&
    clickChain[prefix] === selectionChain[prefix]
  ) {
    prefix += 1;
  }
  if (prefix === 0) {
    return clickChain[0] ?? targetId;
  }
  return clickChain[Math.min(prefix, clickChain.length - 1)] ?? targetId;
}

// ---- pointerDown ----

function onPointerDown(
  event: Extract<InteractionEvent, { kind: "pointerDown" }>,
  ctx: InteractionContext,
): ReduceResult {
  const selection = ctx.state.selection;
  if (event.targetId === null) {
    const effect =
      !event.shiftKey && selection.length > 0 ? { selection: [] } : null;
    return {
      state: {
        kind: "marquee",
        start: event.at,
        current: event.at,
        previewIds: [],
      },
      effect,
    };
  }
  if (event.handle !== null) {
    const view = findView(ctx, event.targetId);
    if (view === undefined) {
      return { state: IDLE, effect: null };
    }
    return {
      state: {
        kind: "pressing",
        targetId: view.id,
        handle: event.handle,
        start: event.at,
      },
      effect: null,
    };
  }
  const view = findView(ctx, resolveClickTarget(ctx, event.targetId));
  if (view === undefined) {
    return { state: IDLE, effect: null };
  }
  if (view.parentFlexId !== null) {
    // flex 子は単一選択のみ（複数選択の意味論が定義できない）
    const effect = selection.includes(view.id)
      ? null
      : { selection: [view.id] };
    return {
      state: {
        kind: "pressing",
        targetId: view.id,
        handle: null,
        start: event.at,
      },
      effect,
    };
  }
  if (event.shiftKey) {
    if (selection.includes(view.id)) {
      const groupMembers = new Set(
        expandIdsToGroups(ctx.state.groups, ctx.state.document, [view.id]),
      );
      return {
        state: IDLE,
        effect: {
          selection: selection.filter((id) => !groupMembers.has(id)),
        },
      };
    }
    return {
      state: {
        kind: "pressing",
        targetId: view.id,
        handle: null,
        start: event.at,
      },
      effect: {
        selection: expandIdsToGroups(ctx.state.groups, ctx.state.document, [
          ...selection,
          view.id,
        ]),
      },
    };
  }
  const effect = selection.includes(view.id)
    ? null
    : {
        selection: expandIdsToGroups(ctx.state.groups, ctx.state.document, [
          view.id,
        ]),
      };
  return {
    state: {
      kind: "pressing",
      targetId: view.id,
      handle: null,
      start: event.at,
    },
    effect,
  };
}

// ---- pressing からの遷移 ----

function pressingMove(
  state: Extract<InteractionState, { kind: "pressing" }>,
  at: MmPoint,
  shiftKey: boolean,
  ctx: InteractionContext,
): InteractionState {
  if (distance(at, state.start) < thresholdMm(ctx)) {
    return state;
  }
  const view = findView(ctx, state.targetId);
  if (view === undefined) {
    return IDLE;
  }
  if (state.handle === "rotate") {
    const el = view.element;
    if (el.type === "table" || el.type === "flex") {
      return IDLE;
    }
    const center: MmPoint = {
      x: view.box.x + view.box.w / 2,
      y: view.box.y + view.box.h / 2,
    };
    return rotatingUpdate(
      {
        kind: "rotating",
        id: view.id,
        center,
        baseRotate: el.rotate ?? 0,
        startPointerAngle: pointerAngleDeg(center, state.start),
      },
      at,
      shiftKey,
    );
  }
  if (state.handle !== null) {
    return resizingUpdate(state.targetId, state.handle, at, state.start, ctx);
  }
  if (view.parentFlexId !== null) {
    const target = reorderTargetFor(ctx, view, at);
    return {
      kind: "reordering",
      flexId: view.parentFlexId,
      childId: view.id,
      fromIndex: view.childIndex ?? 0,
      targetFlexId: target.targetFlexId,
      insertIndex: target.insertIndex,
      at,
      grabOffset: {
        x: state.start.x - view.box.x,
        y: state.start.y - view.box.y,
      },
    };
  }
  const ids = ctx.state.selection.includes(state.targetId)
    ? ctx.state.selection.filter(
        (id) => findView(ctx, id)?.parentFlexId === null,
      )
    : [state.targetId];
  return movingUpdate(ids, state.start, at, ctx);
}

// ---- reducer 本体 ----

export function reduceInteraction(
  state: InteractionState,
  event: InteractionEvent,
  ctx: InteractionContext,
): ReduceResult {
  switch (event.kind) {
    case "cancel":
      return { state: IDLE, effect: null };
    case "paletteDown":
      return {
        state: placingUpdate(event.elementType, event.at, ctx),
        effect: null,
      };
    case "pointerDown":
      if (state.kind !== "idle") {
        return { state, effect: null };
      }
      return onPointerDown(event, ctx);
    case "pointerMove":
      switch (state.kind) {
        case "idle":
          return { state, effect: null };
        case "pressing":
          return {
            state: pressingMove(state, event.at, event.shiftKey, ctx),
            effect: null,
          };
        case "moving":
          return {
            state: movingUpdate(state.ids, state.start, event.at, ctx),
            effect: null,
          };
        case "resizing":
          return {
            state: resizingUpdate(
              state.id,
              state.handle,
              event.at,
              state.start,
              ctx,
            ),
            effect: null,
          };
        case "rotating":
          return {
            state: rotatingUpdate(state, event.at, event.shiftKey),
            effect: null,
          };
        case "marquee": {
          const previewIds =
            distance(state.start, event.at) < thresholdMm(ctx)
              ? []
              : expandIdsToGroups(
                  ctx.state.groups,
                  ctx.state.document,
                  marqueeHits(state.start, event.at, ctx),
                );
          return {
            state: {
              kind: "marquee",
              start: state.start,
              current: event.at,
              previewIds,
            },
            effect: null,
          };
        }
        case "placing":
          return {
            state: placingUpdate(state.elementType, event.at, ctx),
            effect: null,
          };
        case "reordering": {
          const childView = findView(ctx, state.childId);
          if (childView === undefined) {
            return { state: IDLE, effect: null };
          }
          return {
            state: {
              ...state,
              ...reorderTargetFor(ctx, childView, event.at),
              at: event.at,
            },
            effect: null,
          };
        }
      }
      break;
    case "pointerUp":
      switch (state.kind) {
        case "idle":
          return { state, effect: null };
        case "pressing":
          return { state: IDLE, effect: null };
        case "moving": {
          if (state.flexId !== null && state.insertIndex !== null) {
            const id = state.ids[0];
            if (id === undefined) {
              return { state: IDLE, effect: null };
            }
            const view = findView(ctx, id);
            if (view === undefined || view.element.type === "table") {
              return { state: IDLE, effect: null };
            }
            const document = insertFlexChild(
              deleteElements(ctx.state.document, [id]),
              state.flexId,
              toFlexChild(view.element as Exclude<IrElement, IrTableElement>),
              state.insertIndex,
            );
            return { state: IDLE, effect: { document, selection: [id] } };
          }
          if (state.offset.x === 0 && state.offset.y === 0) {
            return { state: IDLE, effect: null };
          }
          return {
            state: IDLE,
            effect: {
              document: commitMove(ctx, state.ids, state.offset),
              selection: state.ids,
            },
          };
        }
        case "rotating": {
          if (state.rotate === state.baseRotate) {
            return { state: IDLE, effect: null };
          }
          return {
            state: IDLE,
            effect: {
              document: rotateElement(
                ctx.state.document,
                state.id,
                state.rotate,
              ),
            },
          };
        }
        case "resizing": {
          // 元の幾何に戻して離したら commit しない（無変更の履歴・onChange を作らない）
          const view = findView(ctx, state.id);
          if (view !== undefined && sameBoxRounded(state.box, view.box)) {
            return { state: IDLE, effect: null };
          }
          const document =
            view !== undefined && view.parentFlexId !== null
              ? resizeFlexChild(ctx.state.document, state.id, state.box)
              : resizeElement(ctx.state.document, state.id, state.box);
          return { state: IDLE, effect: { document } };
        }
        case "marquee": {
          if (distance(state.start, event.at) < thresholdMm(ctx)) {
            return { state: IDLE, effect: null };
          }
          return { state: IDLE, effect: { selection: state.previewIds } };
        }
        case "placing":
          return { state: IDLE, effect: commitPlacing(state, ctx) };
        case "reordering": {
          if (state.targetFlexId === null) {
            // flex 外・紙内ドロップ: トップレベル化。紙外は effect なしでキャンセル
            if (!inPaper(ctx, event.at)) {
              return { state: IDLE, effect: null };
            }
            const childView = findView(ctx, state.childId);
            const pages = topLevelAncestorPages(ctx, state.flexId);
            if (childView === undefined || pages === null) {
              return { state: IDLE, effect: null };
            }
            const element = toTopLevelElement(
              childView.element as IrFlexChild,
              event.at.x - state.grabOffset.x,
              event.at.y - state.grabOffset.y,
              pages,
            );
            const document = addElement(
              deleteElements(ctx.state.document, [state.childId]),
              element,
            );
            return {
              state: IDLE,
              effect: { document, selection: [state.childId] },
            };
          }
          if (state.insertIndex === null) {
            return { state: IDLE, effect: null };
          }
          if (state.targetFlexId === state.flexId) {
            const to =
              state.insertIndex > state.fromIndex
                ? state.insertIndex - 1
                : state.insertIndex;
            if (to === state.fromIndex) {
              return { state: IDLE, effect: null };
            }
            return {
              state: IDLE,
              effect: {
                document: reorderFlexChild(
                  ctx.state.document,
                  state.flexId,
                  state.fromIndex,
                  to,
                ),
                selection: [state.childId],
              },
            };
          }
          // 別 flex への移し替え
          const childView = findView(ctx, state.childId);
          if (childView === undefined) {
            return { state: IDLE, effect: null };
          }
          const document = insertFlexChild(
            deleteElements(ctx.state.document, [state.childId]),
            state.targetFlexId,
            childView.element as IrFlexChild,
            state.insertIndex,
          );
          return {
            state: IDLE,
            effect: { document, selection: [state.childId] },
          };
        }
      }
      break;
  }
  return { state, effect: null };
}
