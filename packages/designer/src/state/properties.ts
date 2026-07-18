import type {
  IrColumn,
  IrDocument,
  IrElement,
  IrFlexChild,
  IrFlexDirection,
  IrPage,
  IrTableCellOverride,
  IrTableElement,
} from "@denreport/core";
import { roundMm } from "./geometry";
import { updateElementById as updateById } from "./tree";

/**
 * id の要素（トップレベル・flex 子孫の両方）を next で置換する。
 * next.id === id かつ型不変が呼び出し側の契約（フォームは同型の要素を組み立てて渡す）。
 */
export function replaceElement(
  document: IrDocument,
  id: string,
  next: IrElement | IrFlexChild,
): IrDocument {
  return updateById(document, id, () => next);
}

/**
 * ids の各要素（トップレベル・flex 子孫の両方）に update を適用する。
 * update は無変化なら引数と同一参照を返す契約（updateElementById の structural sharing に乗る）。
 * 1つも変化しなければ同一参照の document を返す。存在しない id は無視する。
 */
export function updateElements(
  document: IrDocument,
  ids: readonly string[],
  update: (el: IrElement | IrFlexChild) => IrElement | IrFlexChild,
): IrDocument {
  return ids.reduce((doc, id) => updateById(doc, id, update), document);
}

/** direction を切り替える。明示主軸寸法は除去して導出に戻す（軸の意味が変わった値を残さない） */
export function setFlexDirection(
  document: IrDocument,
  id: string,
  direction: IrFlexDirection,
): IrDocument {
  return updateById(document, id, (el) => {
    if (el.type !== "flex" || el.direction === direction) {
      return el;
    }
    const { w: _w, h: _h, ...rest } = el;
    return { ...rest, direction };
  });
}

/** 主軸寸法の明示（number、roundMm 適用）/ 導出への切替（undefined = 属性除去） */
export function setFlexMainSize(
  document: IrDocument,
  id: string,
  size: number | undefined,
): IrDocument {
  return updateById(document, id, (el) => {
    if (el.type !== "flex") {
      return el;
    }
    const { w: _w, h: _h, ...rest } = el;
    if (size === undefined) {
      return el.w === undefined && el.h === undefined ? el : rest;
    }
    const main = roundMm(size);
    if (el.direction === "row") {
      return el.w === main ? el : { ...rest, w: main };
    }
    return el.h === main ? el : { ...rest, h: main };
  });
}

/** image の src のみを差し替える。非同期読込の完了時に他属性の編集を巻き戻さないための専用操作 */
export function setImageSrc(
  document: IrDocument,
  id: string,
  src: string,
): IrDocument {
  return updateById(document, id, (el) =>
    el.type !== "image" || el.src === src ? el : { ...el, src },
  );
}

function updateTable(
  document: IrDocument,
  tableId: string,
  update: (table: IrTableElement) => IrTableElement,
): IrDocument {
  return updateById(document, tableId, (el) =>
    el.type === "table" ? update(el) : el,
  );
}

/** 末尾に列を追加する。key はその table 内で未使用の最小 n の "col<n>"、label "列<n>"、width 40、align "left" */
export function addTableColumn(
  document: IrDocument,
  tableId: string,
): IrDocument {
  return updateTable(document, tableId, (table) => {
    const keys = new Set(table.columns.map((column) => column.key));
    let n = 1;
    while (keys.has(`col${n}`)) {
      n += 1;
    }
    const column: IrColumn = {
      key: `col${n}`,
      label: `列${n}`,
      width: 40,
      align: "left",
    };
    return { ...table, columns: [...table.columns, column] };
  });
}

/** overrides が空なら cellOverrides 属性ごと除去し、そうでなければ差し替える */
function withCellOverrides(
  table: IrTableElement,
  overrides: readonly IrTableCellOverride[],
): IrTableElement {
  if (overrides.length === 0) {
    const { cellOverrides: _cellOverrides, ...rest } = table;
    return rest as IrTableElement;
  }
  return { ...table, cellOverrides: overrides };
}

/** index の列を削除する。columns が1個のときは何もしない（削除列を指す上書きも併せて破棄） */
export function removeTableColumn(
  document: IrDocument,
  tableId: string,
  index: number,
): IrDocument {
  return updateTable(document, tableId, (table) => {
    const removed = table.columns[index];
    if (table.columns.length <= 1 || removed === undefined) {
      return table;
    }
    const columns = table.columns.filter((_, i) => i !== index);
    const overrides = (table.cellOverrides ?? []).filter(
      (o) => o.key !== removed.key,
    );
    return withCellOverrides({ ...table, columns }, overrides);
  });
}

/** index の列を delta 方向の隣と入れ替える。端では何もしない */
export function moveTableColumn(
  document: IrDocument,
  tableId: string,
  index: number,
  delta: -1 | 1,
): IrDocument {
  return updateTable(document, tableId, (table) => {
    const target = index + delta;
    const moved = table.columns[index];
    const neighbor = table.columns[target];
    if (moved === undefined || neighbor === undefined) {
      return table;
    }
    const columns = [...table.columns];
    columns[index] = neighbor;
    columns[target] = moved;
    return { ...table, columns };
  });
}

export function updateTableColumn(
  document: IrDocument,
  tableId: string,
  index: number,
  patch: Partial<IrColumn>,
): IrDocument {
  return updateTable(document, tableId, (table) => {
    const current = table.columns[index];
    if (current === undefined) {
      return table;
    }
    const next: IrColumn = { ...current, ...patch };
    if (
      next.key === current.key &&
      next.label === current.label &&
      next.width === current.width &&
      next.align === current.align
    ) {
      return table;
    }
    const columns = [...table.columns];
    columns[index] = next;
    const overrides =
      next.key === current.key
        ? (table.cellOverrides ?? [])
        : (table.cellOverrides ?? []).map((o) =>
            o.key === current.key ? { ...o, key: next.key } : o,
          );
    return withCellOverrides({ ...table, columns }, overrides);
  });
}

/**
 * 表のセル固定値上書きを設定する。value が空文字列なら当該 (row, key) の上書きを削除し、
 * 上書きが 0 件になったら cellOverrides 属性ごと除去する。
 * 変化が無ければ同一参照の document を返す（commit-if-changed 規約）。
 */
export function setTableCellOverride(
  document: IrDocument,
  tableId: string,
  row: number,
  key: string,
  value: string,
): IrDocument {
  return updateTable(document, tableId, (table) => {
    const existing = table.cellOverrides ?? [];
    const index = existing.findIndex((o) => o.row === row && o.key === key);
    if (value === "") {
      if (index === -1) {
        return table;
      }
      return withCellOverrides(
        table,
        existing.filter((_, i) => i !== index),
      );
    }
    if (index === -1) {
      return withCellOverrides(table, [...existing, { row, key, value }]);
    }
    if (existing[index]?.value === value) {
      return table;
    }
    const next = [...existing];
    next[index] = { row, key, value };
    return withCellOverrides(table, next);
  });
}

export function setPage(document: IrDocument, page: IrPage): IrDocument {
  return document.page.width === page.width &&
    document.page.height === page.height
    ? document
    : { ...document, page };
}

export function setFontName(document: IrDocument, name: string): IrDocument {
  return document.font.name === name
    ? document
    : { ...document, font: { name } };
}

export function setDocType(document: IrDocument, enabled: boolean): IrDocument {
  if (enabled) {
    return document.docType === "qualifiedInvoice"
      ? document
      : { ...document, docType: "qualifiedInvoice" };
  }
  if (document.docType === undefined) {
    return document;
  }
  const { docType: _docType, ...rest } = document;
  return rest;
}
