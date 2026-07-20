import type { IrDocument, IrElement, IrFlexChild } from "@denreport/core";

type AnyElement = IrElement | IrFlexChild;

/** Replaces the element with id (either top-level or a flex descendant) with the result of update.
    Returns document as-is if not found. Preserves structural sharing */
export function updateElementById(
  document: IrDocument,
  id: string,
  update: (el: AnyElement) => AnyElement,
): IrDocument {
  function visitChild(child: IrFlexChild): IrFlexChild {
    if (child.id === id) {
      return update(child) as IrFlexChild;
    }
    if (child.type !== "flex") {
      return child;
    }
    const next = child.children.map(visitChild);
    return next.every((c, i) => c === child.children[i])
      ? child
      : { ...child, children: next };
  }

  const elements = document.elements.map((el) => {
    if (el.id === id) {
      return update(el) as IrElement;
    }
    if (el.type !== "flex") {
      return el;
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
