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

/** ids はトップレベル要素のみ。dx / dy は mm */
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
      // continuationY が y と等値なのは未分離のままの表に限られるため、
      // その場合だけ追従させれば明示的に分離済みの表を壊さずに済む
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

/** box の変化を要素型ごとの属性（x/y/w/h、line は x/y/length、table は x/y のみ）へ反映 */
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

/** rest / last 文脈での table 縦ドラッグ用 */
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

/** トップレベル要素と flex 子（子孫）の両方を id で削除できる */
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

/** トップレベル要素から x/y/pages を落として flex 子の形にする */
export function toFlexChild(
  element: Exclude<IrElement, IrTableElement>,
): IrFlexChild {
  const { x: _x, y: _y, pages: _pages, ...child } = element;
  return child;
}

/** flex 子に x/y/pages を与えてトップレベル要素の形にする（toFlexChild の逆変換） */
export function toTopLevelElement(
  child: IrFlexChild,
  x: number,
  y: number,
  pages: IrPages,
): IrElement {
  return { ...child, x: roundMm(x), y: roundMm(y), pages } as IrElement;
}

/** flex 子孫の寸法のみを box から反映する（w/h、line は length。x/y は書かない）。
    トップレベル要素や flex/table には作用させない */
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
