import type {
  IrDocument,
  IrElement,
  IrFlexChild,
  IrFlexDirection,
  IrFlexElement,
  IrPages,
  IrTableElement,
} from "@denreport/core";
import type { PageContext } from "./types";

export interface MmBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** 0.1mm 単位への丸め。IR に書き戻すすべての座標・寸法に適用する */
export function roundMm(value: number): number {
  return Math.round(value * 10) / 10;
}

/** 文脈 c で編集可能なのは pages が c または all、および pages を持たない table */
export function visibleInContext(
  pages: IrPages | null,
  context: PageContext,
): boolean {
  return pages === null || pages === "all" || pages === context;
}

/** table / flex は rotate を持たない。それ以外の要素の回転角（度）を返す */
export function rotationDeg(element: IrElement | IrFlexChild): number {
  return element.type !== "table" && element.type !== "flex"
    ? (element.rotate ?? 0)
    : 0;
}

/** 描画・ヒットテスト・スナップが共用する、文書中の全要素の箱と文脈情報 */
export interface PlacedElementView {
  readonly id: string;
  readonly element: IrElement | IrFlexChild;
  readonly box: MmBox;
  /** null は table（全文脈で編集可） */
  readonly pages: IrPages | null;
  /** 直近の親 flex。トップレベルは null */
  readonly parentFlexId: string | null;
  /** 親 flex の children 内の位置 */
  readonly childIndex: number | null;
}

interface Size {
  readonly w: number;
  readonly h: number;
}

type FlexNode = IrFlexElement | Extract<IrFlexChild, { type: "flex" }>;

export type FlexLike = Pick<
  IrFlexElement,
  "direction" | "gap" | "w" | "h" | "children"
>;

function mainOf(size: Size, direction: IrFlexDirection): number {
  return direction === "row" ? size.w : size.h;
}

function crossOf(size: Size, direction: IrFlexDirection): number {
  return direction === "row" ? size.h : size.w;
}

function childSize(child: IrFlexChild): Size {
  switch (child.type) {
    case "text":
    case "rect":
    case "ellipse":
    case "image":
    case "pageNumber":
    case "barcode":
      return { w: child.w, h: child.h };
    case "line":
      return child.orientation === "horizontal"
        ? { w: child.length, h: 0 }
        : { w: 0, h: child.length };
    case "flex":
      return measureFlex(child).box;
  }
}

interface FlexMeasure {
  readonly box: Size;
  readonly contentMain: number;
  readonly childSizes: readonly Size[];
}

function measureFlex(flex: FlexLike): FlexMeasure {
  const childSizes = flex.children.map(childSize);
  const gapTotal = flex.gap * Math.max(0, flex.children.length - 1);
  const contentMain =
    childSizes.reduce(
      (total, size) => total + mainOf(size, flex.direction),
      0,
    ) + gapTotal;
  const explicitMain = flex.direction === "row" ? flex.w : flex.h;
  const main = explicitMain ?? contentMain;
  const cross = childSizes.reduce(
    (max, size) => Math.max(max, crossOf(size, flex.direction)),
    0,
  );
  return {
    box:
      flex.direction === "row" ? { w: main, h: cross } : { w: cross, h: main },
    contentMain,
    childSizes,
  };
}

/** 主軸の内容寸法 C（= Σ子の主軸寸法 + gap×(子数−1)。入れ子の flex は導出寸法で数える） */
export function flexMainContentSize(flex: FlexLike): number {
  return measureFlex(flex).contentMain;
}

function justifyOffset(
  justify: IrFlexElement["justifyContent"],
  main: number,
  content: number,
): number {
  switch (justify) {
    case "start":
      return 0;
    case "center":
      return (main - content) / 2;
    case "end":
      return main - content;
  }
}

function alignOffset(
  align: IrFlexElement["alignItems"],
  cross: number,
  childCross: number,
): number {
  switch (align) {
    case "start":
      return 0;
    case "center":
      return (cross - childCross) / 2;
    case "end":
      return cross - childCross;
  }
}

function tableBox(table: IrTableElement, context: PageContext): MmBox {
  const top = context === "first" ? table.y : table.continuationY;
  const width = table.columns.reduce((total, col) => total + col.width, 0);
  const capacity = Math.floor(
    (table.maxY - top - table.headerHeight) / table.rowHeight,
  );
  const rows = Math.max(
    0,
    context === "first" ? Math.min(table.minRows, capacity) : capacity,
  );
  return {
    x: table.x,
    y: top,
    w: width,
    h: table.headerHeight + rows * table.rowHeight,
  };
}

/**
 * 文書中の全要素の箱（mm）を配列順 = 描画順で返す。
 * flex コンテナと table の箱は resolveFlex が返さないため、ここが規範式で導出する
 * （子の座標は resolveFlex と一致することをテストで担保する）。
 */
export function layoutDocument(
  document: IrDocument,
  context: PageContext,
): readonly PlacedElementView[] {
  const views: PlacedElementView[] = [];

  function pushFlex(
    flex: FlexNode,
    x: number,
    y: number,
    pages: IrPages,
    parentFlexId: string | null,
    childIndex: number | null,
  ): void {
    const measure = measureFlex(flex);
    views.push({
      id: flex.id,
      element: flex,
      box: { x, y, w: measure.box.w, h: measure.box.h },
      pages,
      parentFlexId,
      childIndex,
    });
    const mainLen = mainOf(measure.box, flex.direction);
    const crossLen = crossOf(measure.box, flex.direction);
    let cursor = justifyOffset(
      flex.justifyContent,
      mainLen,
      measure.contentMain,
    );
    flex.children.forEach((child, i) => {
      const size = measure.childSizes[i] ?? { w: 0, h: 0 };
      const crossPos = alignOffset(
        flex.alignItems,
        crossLen,
        crossOf(size, flex.direction),
      );
      const childX = flex.direction === "row" ? x + cursor : x + crossPos;
      const childY = flex.direction === "row" ? y + crossPos : y + cursor;
      if (child.type === "flex") {
        pushFlex(child, childX, childY, pages, flex.id, i);
      } else {
        views.push({
          id: child.id,
          element: child,
          box: { x: childX, y: childY, w: size.w, h: size.h },
          pages,
          parentFlexId: flex.id,
          childIndex: i,
        });
      }
      cursor += mainOf(size, flex.direction) + flex.gap;
    });
  }

  for (const el of document.elements) {
    switch (el.type) {
      case "flex":
        pushFlex(el, el.x, el.y, el.pages, null, null);
        break;
      case "table":
        views.push({
          id: el.id,
          element: el,
          box: tableBox(el, context),
          pages: null,
          parentFlexId: null,
          childIndex: null,
        });
        break;
      case "line":
        views.push({
          id: el.id,
          element: el,
          box:
            el.orientation === "horizontal"
              ? { x: el.x, y: el.y, w: el.length, h: 0 }
              : { x: el.x, y: el.y, w: 0, h: el.length },
          pages: el.pages,
          parentFlexId: null,
          childIndex: null,
        });
        break;
      default:
        views.push({
          id: el.id,
          element: el,
          box: { x: el.x, y: el.y, w: el.w, h: el.h },
          pages: el.pages,
          parentFlexId: null,
          childIndex: null,
        });
    }
  }
  return views;
}
