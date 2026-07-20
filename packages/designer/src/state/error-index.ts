import type {
  IrDocument,
  IrElement,
  IrError,
  IrFlexChild,
} from "@denreport/core";

const ELEMENT_PATH = /^elements\[(\d+)\]((?:\.children\[\d+\])*)/;
const CHILD_INDEX = /\.children\[(\d+)\]/g;

function resolveId(document: IrDocument, path: string): string | null {
  const match = ELEMENT_PATH.exec(path);
  if (match === null) {
    return null;
  }
  let current: IrElement | IrFlexChild | undefined =
    document.elements[Number(match[1])];
  if (current === undefined) {
    return null;
  }
  for (const childMatch of (match[2] ?? "").matchAll(CHILD_INDEX)) {
    if (current.type !== "flex") {
      return null;
    }
    current = current.children[Number(childMatch[1])];
    if (current === undefined) {
      return null;
    }
  }
  return current.id;
}

/**
 * Resolves the id of the corresponding element from an IrError's path, and returns
 * the set of element ids that have errors.
 * Paths that don't correspond to an element (root, page, etc.) are ignored.
 */
export function errorElementIds(
  document: IrDocument,
  errors: readonly IrError[],
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const error of errors) {
    const id = resolveId(document, error.path);
    if (id !== null) {
      ids.add(id);
    }
  }
  return ids;
}

/** Element id -> list of errors that resolve to that element. Paths that don't correspond to an element (root, page, etc.) are excluded */
export function errorsByElement(
  document: IrDocument,
  errors: readonly IrError[],
): ReadonlyMap<string, readonly IrError[]> {
  const map = new Map<string, IrError[]>();
  for (const error of errors) {
    const id = resolveId(document, error.path);
    if (id === null) {
      continue;
    }
    const list = map.get(id);
    if (list === undefined) {
      map.set(id, [error]);
    } else {
      list.push(error);
    }
  }
  return map;
}

/**
 * From an error list already narrowed to an element, returns the first message
 * whose path ends with ".<attrPath>".
 * A best-effort mapping for field-level error display.
 */
export function errorMessageFor(
  errors: readonly IrError[],
  attrPath: string,
): string | undefined {
  const suffix = `.${attrPath}`;
  return errors.find((error) => error.path.endsWith(suffix))?.message;
}
