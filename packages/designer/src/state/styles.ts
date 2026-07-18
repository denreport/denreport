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

/** image / flex / ellipse / barcode は style を持てないため常に undefined */
function elementStyleName(element: AnyElement): string | undefined {
  return element.type === "image" ||
    element.type === "flex" ||
    element.type === "ellipse" ||
    element.type === "barcode"
    ? undefined
    : element.style;
}

/** el の型に該当する属性だけを定義値で上書きし、style 参照を設定する */
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

/** document.elements（flex 子孫を含む）全体へ fn を適用し、structural sharing を維持する */
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

/** styles が空になったら属性ごと除去する（cellOverrides と同じ規約） */
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

/** 要素にスタイルを適用し、該当属性へ定義値を書き込む。未知の id / name では同一参照 */
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

/** style 属性を除去する。具体値は保持 */
export function clearStyle(document: IrDocument, id: string): IrDocument {
  return updateElementById(document, id, (el) => withoutStyle(el));
}

/** 同名があれば置換・なければ追加し、参照中の全要素（flex 子孫含む）を定義値で再同期する */
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

/** 定義の name と全参照を書き換える。newName が既存名と衝突する場合は同一参照 */
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

/** 定義を除去し、全参照要素の style 属性を除去する。具体値は保持 */
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

/** 要素の適用可能属性から IrNamedStyle を組み立てる（「選択要素から作成」用） */
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
    attrs[key] = (element as Record<string, unknown>)[key];
  }
  return { name, attrs };
}
