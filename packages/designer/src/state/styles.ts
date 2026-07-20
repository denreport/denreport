import type {
  IrDocument,
  IrElement,
  IrFlexChild,
  IrNamedStyle,
} from "@denreport/core";
import { applicableStyleAttrs } from "@denreport/core";
import { updateElementById } from "./tree";

type AnyElement = IrElement | IrFlexChild;

function findStyle(
  document: IrDocument,
  name: string,
): IrNamedStyle | undefined {
  return document.styles?.find((style) => style.name === name);
}

/** image / flex / ellipse / barcode cannot have a style, so this is always undefined */
function elementStyleName(element: AnyElement): string | undefined {
  return element.type === "image" ||
    element.type === "flex" ||
    element.type === "ellipse" ||
    element.type === "barcode"
    ? undefined
    : element.style;
}

/** Overwrites only the attributes applicable to el's type with the definition's values, and sets the style reference */
function withDefinition(el: AnyElement, style: IrNamedStyle): AnyElement {
  if (
    el.type === "image" ||
    el.type === "flex" ||
    el.type === "ellipse" ||
    el.type === "barcode"
  ) {
    return el;
  }
  const patch: Record<string, unknown> = { style: style.name };
  for (const key of applicableStyleAttrs(el.type)) {
    if (style.attrs[key] !== undefined) {
      patch[key] = style.attrs[key];
    }
  }
  return { ...el, ...patch } as AnyElement;
}

function withoutStyle(el: AnyElement): AnyElement {
  if (
    el.type === "image" ||
    el.type === "flex" ||
    el.type === "ellipse" ||
    el.type === "barcode" ||
    el.style === undefined
  ) {
    return el;
  }
  const { style: _style, ...rest } = el;
  return rest as AnyElement;
}

function withStyleName(el: AnyElement, name: string): AnyElement {
  return el.type === "image" ||
    el.type === "flex" ||
    el.type === "ellipse" ||
    el.type === "barcode"
    ? el
    : ({ ...el, style: name } as AnyElement);
}

/** Applies fn across the whole of document.elements (including flex descendants), preserving structural sharing */
function mapAllElements(
  document: IrDocument,
  fn: (el: AnyElement) => AnyElement,
): IrDocument {
  function visitChild(child: IrFlexChild): IrFlexChild {
    const updated = fn(child) as IrFlexChild;
    if (updated.type !== "flex") {
      return updated;
    }
    const next = updated.children.map(visitChild);
    return next.every((c, i) => c === updated.children[i])
      ? updated
      : { ...updated, children: next };
  }

  const elements = document.elements.map((el) => {
    const updated = fn(el) as IrElement;
    if (updated.type !== "flex") {
      return updated;
    }
    const next = updated.children.map(visitChild);
    return next.every((c, i) => c === updated.children[i])
      ? updated
      : { ...updated, children: next };
  });
  return elements.every((el, i) => el === document.elements[i])
    ? document
    : { ...document, elements };
}

/** Removes the attribute entirely once styles becomes empty (the same convention as cellOverrides) */
function finalizeStyles(
  document: IrDocument,
  styles: readonly IrNamedStyle[],
): IrDocument {
  if (styles.length > 0) {
    return { ...document, styles };
  }
  if (document.styles === undefined) {
    return document;
  }
  const { styles: _styles, ...rest } = document;
  return rest as IrDocument;
}

/** Applies a style to an element, writing the definition's values into the matching attributes. Returns the same reference for an unknown id / name */
export function applyStyle(
  document: IrDocument,
  id: string,
  name: string,
): IrDocument {
  const style = findStyle(document, name);
  if (style === undefined) {
    return document;
  }
  return updateElementById(document, id, (el) => withDefinition(el, style));
}

/** Removes the style attribute. Concrete values are preserved */
export function clearStyle(document: IrDocument, id: string): IrDocument {
  return updateElementById(document, id, (el) => withoutStyle(el));
}

/** Replaces if a same-named style exists, otherwise adds it, and re-syncs all referencing elements (including flex descendants) with the definition's values */
export function upsertStyle(
  document: IrDocument,
  style: IrNamedStyle,
): IrDocument {
  const existing = document.styles ?? [];
  const index = existing.findIndex((s) => s.name === style.name);
  const styles =
    index === -1
      ? [...existing, style]
      : existing.map((s, i) => (i === index ? style : s));
  const synced = mapAllElements(document, (el) =>
    elementStyleName(el) === style.name ? withDefinition(el, style) : el,
  );
  return { ...synced, styles };
}

/** Rewrites the definition's name and all references. Returns the same reference if newName collides with an existing name */
export function renameStyle(
  document: IrDocument,
  oldName: string,
  newName: string,
): IrDocument {
  if (oldName === newName) {
    return document;
  }
  const existing = document.styles ?? [];
  if (existing.some((s) => s.name === newName)) {
    return document;
  }
  const index = existing.findIndex((s) => s.name === oldName);
  if (index === -1) {
    return document;
  }
  const styles = existing.map((s, i) =>
    i === index ? { ...s, name: newName } : s,
  );
  const synced = mapAllElements(document, (el) =>
    elementStyleName(el) === oldName ? withStyleName(el, newName) : el,
  );
  return { ...synced, styles };
}

/** Removes the definition and removes the style attribute from all referencing elements. Concrete values are preserved */
export function removeStyle(document: IrDocument, name: string): IrDocument {
  const existing = document.styles ?? [];
  if (!existing.some((s) => s.name === name)) {
    return document;
  }
  const styles = existing.filter((s) => s.name !== name);
  const synced = mapAllElements(document, (el) =>
    elementStyleName(el) === name ? withoutStyle(el) : el,
  );
  return finalizeStyles(synced, styles);
}

/** Builds an IrNamedStyle from an element's applicable attributes (for "create from selected element") */
export function styleFromElement(
  element: IrElement | IrFlexChild,
  name: string,
): IrNamedStyle | null {
  const keys = applicableStyleAttrs(element.type);
  if (keys.length === 0) {
    return null;
  }
  const attrs: Record<string, unknown> = {};
  for (const key of keys) {
    // Optional attributes like fontWeight aren't copied as undefined from an unspecified element (attrs only has a key when specified)
    const value = (element as Record<string, unknown>)[key];
    if (value !== undefined) {
      attrs[key] = value;
    }
  }
  return { name, attrs };
}
