import type {
  IrDocument,
  IrElement,
  IrFlexChild,
  IrPages,
  IrTableElement,
} from "@denreport/core";
import type { MmBox } from "./geometry";
import { roundMm } from "./geometry";
import { updateElementById } from "./tree";

export function addElement(
  document: IrDocument,
  element: IrElement,
): IrDocument {
  return { ...document, elements: [...document.elements, element] };
}

/** ids are top-level elements only. dx / dy are in mm */
export function moveElements(
  document: IrDocument,
  ids: readonly string[],
  dx: number,
  dy: number,
): IrDocument {
  const idSet = new Set(ids);
  return {
    ...document,
    elements: document.elements.map((el) => {
      if (!idSet.has(el.id)) {
        return el;
      }
      const x = roundMm(el.x + dx);
      const y = roundMm(el.y + dy);
      // continuationY equals y only for a table that hasn't been detached yet, so
      // following it only in that case avoids breaking a table that's already been explicitly detached
      if (el.type === "table" && el.continuationY === el.y) {
        return { ...el, x, y, continuationY: y };
      }
      return { ...el, x, y };
    }),
  };
}

function applyBox(el: IrElement, box: MmBox): IrElement {
  switch (el.type) {
    case "text":
    case "rect":
    case "ellipse":
    case "image":
    case "pageNumber":
    case "barcode":
      return {
        ...el,
        x: roundMm(box.x),
        y: roundMm(box.y),
        w: roundMm(box.w),
        h: roundMm(box.h),
      };
    case "line":
      return {
        ...el,
        x: roundMm(box.x),
        y: roundMm(box.y),
        length: roundMm(el.orientation === "horizontal" ? box.w : box.h),
      };
    case "table":
    case "flex":
      return { ...el, x: roundMm(box.x), y: roundMm(box.y) };
  }
}

/** Reflects a box change onto the attributes for each element type (x/y/w/h; line is x/y/length; table is x/y only) */
export function resizeElement(
  document: IrDocument,
  id: string,
  box: MmBox,
): IrDocument {
  return {
    ...document,
    elements: document.elements.map((el) =>
      el.id === id ? applyBox(el, box) : el,
    ),
  };
}

/** Sets rotate, rounded to 0.1deg units. Removes the attribute if the rounded value is 0.
    Returns the document as-is for table / flex or an unknown id. Also affects flex children */
export function rotateElement(
  document: IrDocument,
  id: string,
  rotate: number,
): IrDocument {
  const rounded = Math.round(rotate * 10) / 10;
  return updateElementById(document, id, (el) => {
    if (el.type === "table" || el.type === "flex") {
      return el;
    }
    if (rounded === 0) {
      if (el.rotate === undefined) {
        return el;
      }
      const { rotate: _rotate, ...rest } = el;
      return rest;
    }
    return el.rotate === rounded ? el : { ...el, rotate: rounded };
  });
}

/** For a table's vertical drag in the rest / last context */
export function setTableContinuationY(
  document: IrDocument,
  id: string,
  y: number,
): IrDocument {
  return {
    ...document,
    elements: document.elements.map((el) =>
      el.id === id && el.type === "table"
        ? { ...el, continuationY: roundMm(y) }
        : el,
    ),
  };
}

/** Can delete both top-level elements and flex children (descendants) by id */
export function deleteElements(
  document: IrDocument,
  ids: readonly string[],
): IrDocument {
  const idSet = new Set(ids);

  function pruneChildren(
    children: readonly IrFlexChild[],
  ): readonly IrFlexChild[] {
    let changed = false;
    const next: IrFlexChild[] = [];
    for (const child of children) {
      if (idSet.has(child.id)) {
        changed = true;
        continue;
      }
      if (child.type === "flex") {
        const pruned = pruneChildren(child.children);
        if (pruned !== child.children) {
          changed = true;
          next.push({ ...child, children: pruned });
          continue;
        }
      }
      next.push(child);
    }
    return changed ? next : children;
  }

  let changed = false;
  const elements: IrElement[] = [];
  for (const el of document.elements) {
    if (idSet.has(el.id)) {
      changed = true;
      continue;
    }
    if (el.type === "flex") {
      const pruned = pruneChildren(el.children);
      if (pruned !== el.children) {
        changed = true;
        elements.push({ ...el, children: pruned });
        continue;
      }
    }
    elements.push(el);
  }
  return changed ? { ...document, elements } : document;
}

function updateFlexChildren(
  document: IrDocument,
  flexId: string,
  update: (children: readonly IrFlexChild[]) => readonly IrFlexChild[],
): IrDocument {
  function visitChild(child: IrFlexChild): IrFlexChild {
    if (child.type !== "flex") {
      return child;
    }
    if (child.id === flexId) {
      return { ...child, children: update(child.children) };
    }
    const next = child.children.map(visitChild);
    return next.every((c, i) => c === child.children[i])
      ? child
      : { ...child, children: next };
  }

  const elements = document.elements.map((el) => {
    if (el.type !== "flex") {
      return el;
    }
    if (el.id === flexId) {
      return { ...el, children: update(el.children) };
    }
    const next = el.children.map(visitChild);
    return next.every((c, i) => c === el.children[i])
      ? el
      : { ...el, children: next };
  });
  return elements.every((el, i) => el === document.elements[i])
    ? document
    : { ...document, elements };
}

export function insertFlexChild(
  document: IrDocument,
  flexId: string,
  child: IrFlexChild,
  index: number,
): IrDocument {
  return updateFlexChildren(document, flexId, (children) => {
    const next = [...children];
    next.splice(index, 0, child);
    return next;
  });
}

export function reorderFlexChild(
  document: IrDocument,
  flexId: string,
  fromIndex: number,
  toIndex: number,
): IrDocument {
  if (fromIndex === toIndex) {
    return document;
  }
  return updateFlexChildren(document, flexId, (children) => {
    const next = [...children];
    const [moved] = next.splice(fromIndex, 1);
    if (moved === undefined) {
      return children;
    }
    next.splice(toIndex, 0, moved);
    return next;
  });
}

/** Drops x/y/pages from a top-level element to shape it as a flex child */
export function toFlexChild(
  element: Exclude<IrElement, IrTableElement>,
): IrFlexChild {
  const { x: _x, y: _y, pages: _pages, ...child } = element;
  return child;
}

/** Gives a flex child x/y/pages to shape it as a top-level element (the inverse of toFlexChild) */
export function toTopLevelElement(
  child: IrFlexChild,
  x: number,
  y: number,
  pages: IrPages,
): IrElement {
  return { ...child, x: roundMm(x), y: roundMm(y), pages } as IrElement;
}

/** Reflects only the dimensions of a flex descendant from box (w/h; line is length; x/y are not written).
    Does not affect top-level elements or flex/table */
export function resizeFlexChild(
  document: IrDocument,
  id: string,
  box: MmBox,
): IrDocument {
  if (document.elements.some((el) => el.id === id)) {
    return document;
  }
  return updateElementById(document, id, (el) => {
    switch (el.type) {
      case "text":
      case "rect":
      case "ellipse":
      case "image":
      case "pageNumber":
      case "barcode":
        return { ...el, w: roundMm(box.w), h: roundMm(box.h) };
      case "line":
        return {
          ...el,
          length: roundMm(el.orientation === "horizontal" ? box.w : box.h),
        };
      case "table":
      case "flex":
        return el;
    }
  });
}
