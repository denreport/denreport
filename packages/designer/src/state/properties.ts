import type {
  IrColumn,
  IrDocument,
  IrElement,
  IrFlexChild,
  IrFlexDirection,
  IrFontSlot,
  IrPage,
  IrTableCellOverride,
  IrTableCellSpan,
  IrTableElement,
} from "@denreport/core";
import type { DefaultsMessages } from "./defaults";
import { roundMm } from "./geometry";
import type { SpanExtent } from "./table-cells";
import { spanExtentsOverlap } from "./table-cells";
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

/** 末尾に列を追加する。key はその table 内で未使用の最小 n の "col<n>"、label は m.columnName(n)、width 40、align "left" */
export function addTableColumn(
  document: IrDocument,
  tableId: string,
  m: DefaultsMessages,
): IrDocument {
  return updateTable(document, tableId, (table) => {
    const keys = new Set(table.columns.map((column) => column.key));
    let n = 1;
    while (keys.has(`col${n}`)) {
      n += 1;
    }
    const column: IrColumn = {
      key: `col${n}`,
      label: m.columnName(n),
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

/** spans が空なら cellSpans 属性ごと除去し、そうでなければ差し替える */
function withCellSpans(
  table: IrTableElement,
  spans: readonly IrTableCellSpan[],
): IrTableElement {
  if (spans.length === 0) {
    const { cellSpans: _cellSpans, ...rest } = table;
    return rest as IrTableElement;
  }
  return { ...table, cellSpans: spans };
}

/** colSpan を差し替える。1（デフォルト）なら属性を持たせず、同値なら同一参照を返す */
function withColSpan(span: IrTableCellSpan, colSpan: number): IrTableCellSpan {
  if (colSpan === (span.colSpan ?? 1)) {
    return span;
  }
  const { colSpan: _colSpan, ...rest } = span;
  return colSpan === 1 ? rest : { ...rest, colSpan };
}

/**
 * 列並び変更後の cellSpans を検証（M20）が通る形に整える。列範囲からのはみ出しと
 * mergeSameValue 列への到達は colSpan を切り詰め、1×1 になった結合と先行する結合に
 * 重なった結合は破棄する。
 */
function normalizeCellSpans(
  columns: readonly IrColumn[],
  spans: readonly IrTableCellSpan[],
): readonly IrTableCellSpan[] {
  const indexByKey = new Map(columns.map((column, i) => [column.key, i]));
  const result: IrTableCellSpan[] = [];
  const extents: SpanExtent[] = [];
  for (const span of spans) {
    const col = indexByKey.get(span.key);
    if (col === undefined) {
      result.push(span);
      continue;
    }
    let colSpan = Math.min(span.colSpan ?? 1, columns.length - col);
    for (let c = col + 1; c < col + colSpan; c += 1) {
      if (columns[c]?.mergeSameValue === true) {
        colSpan = c - col;
        break;
      }
    }
    const rowSpan = span.rowSpan ?? 1;
    const extent: SpanExtent = { row: span.row, rowSpan, col, colSpan };
    if (
      (rowSpan === 1 && colSpan === 1) ||
      extents.some((other) => spanExtentsOverlap(other, extent))
    ) {
      continue;
    }
    result.push(withColSpan(span, colSpan));
    extents.push(extent);
  }
  return result;
}

/**
 * index の列を削除する。columns が1個のときは何もしない。削除列を起点に指す上書き・
 * 結合は破棄し、削除列を被覆していた結合は colSpan を1列ぶん狭める（1×1 になれば破棄）。
 */
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
    const indexByKey = new Map(
      table.columns.map((column, i) => [column.key, i]),
    );
    const spans = (table.cellSpans ?? []).flatMap((span) => {
      if (span.key === removed.key) {
        return [];
      }
      const origin = indexByKey.get(span.key);
      const colSpan = span.colSpan ?? 1;
      if (
        origin === undefined ||
        index <= origin ||
        index >= origin + colSpan
      ) {
        return [span];
      }
      if (colSpan === 2 && (span.rowSpan ?? 1) === 1) {
        return [];
      }
      return [withColSpan(span, colSpan - 1)];
    });
    return withCellSpans(
      withCellOverrides({ ...table, columns }, overrides),
      spans,
    );
  });
}

/**
 * index の列を delta 方向の隣と入れ替える。端では何もしない。入れ替えで成立しなくなる
 * 結合（列範囲からのはみ出し・mergeSameValue 列への到達・他の結合との重なり）は
 * 切り詰め・破棄する。
 */
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
    const next = { ...table, columns };
    return table.cellSpans === undefined
      ? next
      : withCellSpans(next, normalizeCellSpans(columns, table.cellSpans));
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
    const merged = { ...current, ...patch };
    const next: IrColumn = {
      key: merged.key,
      label: merged.label,
      width: merged.width,
      align: merged.align,
      ...(merged.mergeSameValue === true ? { mergeSameValue: true } : {}),
    };
    if (
      next.key === current.key &&
      next.label === current.label &&
      next.width === current.width &&
      next.align === current.align &&
      (next.mergeSameValue === true) === (current.mergeSameValue === true)
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
    const spans =
      next.key === current.key
        ? (table.cellSpans ?? [])
        : (table.cellSpans ?? []).map((s) =>
            s.key === current.key ? { ...s, key: next.key } : s,
          );
    return withCellSpans(
      withCellOverrides({ ...table, columns }, overrides),
      spans,
    );
  });
}

/** 末尾に結合を追加する。既定は先頭列の行0を起点とした縦2行の結合 */
export function addTableCellSpan(
  document: IrDocument,
  tableId: string,
): IrDocument {
  return updateTable(document, tableId, (table) => {
    const key = table.columns[0]?.key;
    if (key === undefined) {
      return table;
    }
    const span: IrTableCellSpan = { row: 0, key, rowSpan: 2 };
    return { ...table, cellSpans: [...(table.cellSpans ?? []), span] };
  });
}

/** span を末尾に追加する。妥当性は呼び出し側が先回りで検査する契約 */
export function appendTableCellSpan(
  document: IrDocument,
  tableId: string,
  span: IrTableCellSpan,
): IrDocument {
  return updateTable(document, tableId, (table) => ({
    ...table,
    cellSpans: [...(table.cellSpans ?? []), span],
  }));
}

/**
 * index の結合に patch を適用する。rowSpan / colSpan は 1（デフォルト）なら属性を
 * 持たせず、"header" 行では rowSpan を除去する。変化が無ければ同一参照を返す。
 */
export function updateTableCellSpan(
  document: IrDocument,
  tableId: string,
  index: number,
  patch: Partial<IrTableCellSpan>,
): IrDocument {
  return updateTable(document, tableId, (table) => {
    const current = table.cellSpans?.[index];
    if (current === undefined) {
      return table;
    }
    const merged = { ...current, ...patch };
    const rowSpan = merged.rowSpan ?? 1;
    const colSpan = merged.colSpan ?? 1;
    const next: IrTableCellSpan = {
      row: merged.row,
      key: merged.key,
      ...(merged.row !== "header" && rowSpan !== 1 ? { rowSpan } : {}),
      ...(colSpan !== 1 ? { colSpan } : {}),
    };
    if (
      next.row === current.row &&
      next.key === current.key &&
      (next.rowSpan ?? 1) === (current.rowSpan ?? 1) &&
      (next.colSpan ?? 1) === (current.colSpan ?? 1)
    ) {
      return table;
    }
    const spans = [...(table.cellSpans ?? [])];
    spans[index] = next;
    return { ...table, cellSpans: spans };
  });
}

/** index の結合を削除する。0件になれば cellSpans 属性ごと除去する */
export function removeTableCellSpan(
  document: IrDocument,
  tableId: string,
  index: number,
): IrDocument {
  return updateTable(document, tableId, (table) => {
    const spans = table.cellSpans ?? [];
    if (spans[index] === undefined) {
      return table;
    }
    return withCellSpans(
      table,
      spans.filter((_, i) => i !== index),
    );
  });
}

/** indices の結合をまとめて削除する。0件になれば cellSpans 属性ごと除去し、対象なしなら同一参照を返す */
export function removeTableCellSpansAt(
  document: IrDocument,
  tableId: string,
  indices: readonly number[],
): IrDocument {
  return updateTable(document, tableId, (table) => {
    const set = new Set(indices);
    const spans = table.cellSpans ?? [];
    if (!spans.some((_, i) => set.has(i))) {
      return table;
    }
    return withCellSpans(
      table,
      spans.filter((_, i) => !set.has(i)),
    );
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

export function setFontRegular(document: IrDocument, name: string): IrDocument {
  return document.font.regular === name
    ? document
    : { ...document, font: { ...document.font, regular: name } };
}

/** regular 以外のスロットの論理名を設定する。undefined でスロット解除（属性除去） */
export function setFontSlot(
  document: IrDocument,
  slot: Exclude<IrFontSlot, "regular">,
  name: string | undefined,
): IrDocument {
  if (document.font[slot] === name) {
    return document;
  }
  if (name === undefined) {
    const { [slot]: _removed, ...rest } = document.font;
    return { ...document, font: rest };
  }
  return { ...document, font: { ...document.font, [slot]: name } };
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
