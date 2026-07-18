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
 * IrError の path から該当要素の id を解決し、エラーを持つ要素 id の集合を返す。
 * 要素に対応しない path（ルート・page 等）は無視する。
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

/** 要素 id → その要素に解決されるエラー列。要素に対応しない path（ルート・page 等）は含めない */
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
 * 要素に絞ったエラー列から、path が ".<attrPath>" で終わる最初の message を返す。
 * フィールド単位のエラー表示への best-effort な対応付け。
 */
export function errorMessageFor(
  errors: readonly IrError[],
  attrPath: string,
): string | undefined {
  const suffix = `.${attrPath}`;
  return errors.find((error) => error.path.endsWith(suffix))?.message;
}
