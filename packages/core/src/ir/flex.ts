import type {
  IrDocument,
  IrElement,
  IrFlexAlign,
  IrFlexChild,
  IrFlexDirection,
  IrFlexElement,
  IrPages,
} from "./types";

/**
 * An IrElement with its flex container resolved away: never a flex element
 * itself, and always carrying absolute `x`/`y` coordinates.
 */
export type IrPlacedElement = Exclude<IrElement, IrFlexElement>;

// Common shape for position-less geometric input, needed by both resolveFlex and validateIr (M02/M12).
// Both a top-level flex (which has x/y/pages) and a flex child (which doesn't) can be passed as-is.
type IrFlexGeometry = Pick<
  IrFlexElement,
  "direction" | "w" | "h" | "gap" | "justifyContent" | "alignItems" | "children"
>;

interface Size {
  readonly w: number;
  readonly h: number;
}

export interface FlexMeasurement {
  readonly boxWidth: number;
  readonly boxHeight: number;
  readonly contentMain: number;
}

function mainOf(size: Size, direction: IrFlexDirection): number {
  return direction === "row" ? size.w : size.h;
}

function crossOf(size: Size, direction: IrFlexDirection): number {
  return direction === "row" ? size.h : size.w;
}

function elementSize(el: IrFlexChild): Size {
  switch (el.type) {
    case "text":
    case "rect":
    case "ellipse":
    case "image":
    case "pageNumber":
    case "barcode":
      return { w: el.w, h: el.h };
    case "line":
      return el.orientation === "horizontal"
        ? { w: el.length, h: 0 }
        : { w: 0, h: el.length };
    case "flex": {
      const measurement = measureFlex(el);
      return { w: measurement.boxWidth, h: measurement.boxHeight };
    }
  }
}

// Nested flex is called recursively from elementSize, so it resolves depth-first.
export function measureFlex(flex: IrFlexGeometry): FlexMeasurement {
  const sizes = flex.children.map(elementSize);
  const mains = sizes.map((size) => mainOf(size, flex.direction));
  const crosses = sizes.map((size) => crossOf(size, flex.direction));
  const gapTotal = flex.gap * Math.max(0, flex.children.length - 1);
  const contentMain = mains.reduce((total, main) => total + main, 0) + gapTotal;
  const explicitMain = flex.direction === "row" ? flex.w : flex.h;
  const main = explicitMain ?? contentMain;
  const cross = crosses.length > 0 ? Math.max(...crosses) : 0;
  return {
    boxWidth: flex.direction === "row" ? main : cross,
    boxHeight: flex.direction === "row" ? cross : main,
    contentMain,
  };
}

function justifyOffset(
  justify: IrFlexAlign,
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
  align: IrFlexAlign,
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

function placeChildren(
  flex: IrFlexGeometry,
  originX: number,
  originY: number,
  pages: IrPages,
): IrPlacedElement[] {
  const measurement = measureFlex(flex);
  const mainLen =
    flex.direction === "row" ? measurement.boxWidth : measurement.boxHeight;
  const crossLen =
    flex.direction === "row" ? measurement.boxHeight : measurement.boxWidth;
  const sizes = flex.children.map(elementSize);
  const mains = sizes.map((size) => mainOf(size, flex.direction));
  const crosses = sizes.map((size) => crossOf(size, flex.direction));
  const offset = justifyOffset(
    flex.justifyContent,
    mainLen,
    measurement.contentMain,
  );

  const placed: IrPlacedElement[] = [];
  let cursor = offset;
  flex.children.forEach((child, i) => {
    const mainPos = cursor;
    const crossPos = alignOffset(flex.alignItems, crossLen, crosses[i] ?? 0);
    const x = flex.direction === "row" ? originX + mainPos : originX + crossPos;
    const y = flex.direction === "row" ? originY + crossPos : originY + mainPos;
    if (child.type === "flex") {
      placed.push(...placeChildren(child, x, y, pages));
    } else {
      placed.push({ ...child, x, y, pages } as IrPlacedElement);
    }
    cursor += (mains[i] ?? 0) + flex.gap;
  });
  return placed;
}

/**
 * Expands every flex element in `document` into its children, positioned
 * absolutely according to the container's direction, gap, justifyContent, and
 * alignItems (recursively for nested flex). Returns the document's elements
 * in order with every flex container replaced by its placed descendants.
 */
export function resolveFlex(document: IrDocument): readonly IrPlacedElement[] {
  const placed: IrPlacedElement[] = [];
  for (const el of document.elements) {
    if (el.type === "flex") {
      placed.push(...placeChildren(el, el.x, el.y, el.pages));
    } else {
      placed.push(el);
    }
  }
  return placed;
}
