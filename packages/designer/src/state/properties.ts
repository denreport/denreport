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
import { roundMm } from "./geometry";
import type { SpanExtent } from "./table-cells";
import { spanExtentsOverlap } from "./table-cells";
import { updateElementById as updateById } from "./tree";

/**
 * Replaces the element with id (either top-level or a flex descendant) with next.
 * It's the caller's contract that next.id === id and the type is unchanged (the form builds and passes an element of the same type).
 */
export function replaceElement(
  document: IrDocument,
  id: string,
  next: IrElement | IrFlexChild,
): IrDocument {
  return updateById(document, id, () => next);
}

/**
 * Applies update to each element in ids (either top-level or a flex descendant).
 * It's update's contract to return the same reference as its argument when unchanged (this rides on updateElementById's structural sharing).
 * Returns the same reference for document if nothing changed. Nonexistent ids are ignored.
 */
export function updateElements(
  document: IrDocument,
  ids: readonly string[],
  update: (el: IrElement | IrFlexChild) => IrElement | IrFlexChild,
): IrDocument {
  return ids.reduce((doc, id) => updateById(doc, id, update), document);
}

/** Switches direction. Removes an explicit main-axis dimension, reverting it to derived (doesn't leave a value whose axis meaning has changed) */
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

/** Makes the main-axis dimension explicit (a number, with roundMm applied) / switches it back to derived (undefined = remove the attribute) */
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

/** Replaces only an image's src. A dedicated operation so an async load's completion doesn't roll back edits to other attributes */
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

/** Appends a column at the end. key is "col<n>" with the smallest n unused within that table; label is "column<n>"; width 40; align "left" */
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
      label: `column${n}`,
      width: 40,
      align: "left",
    };
    return { ...table, columns: [...table.columns, column] };
  });
}

/** Removes the cellOverrides attribute entirely if overrides is empty; otherwise replaces it */
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

/** Removes the cellSpans attribute entirely if spans is empty; otherwise replaces it */
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

/** Replaces colSpan. Doesn't set the attribute when 1 (the default); returns the same reference when the value is unchanged */
function withColSpan(span: IrTableCellSpan, colSpan: number): IrTableCellSpan {
  if (colSpan === (span.colSpan ?? 1)) {
    return span;
  }
  const { colSpan: _colSpan, ...rest } = span;
  return colSpan === 1 ? rest : { ...rest, colSpan };
}

/**
 * Adjusts cellSpans after a column reorder into a shape that passes validation (M20). Overflow
 * past the column range and reaching a mergeSameValue column truncate colSpan; a merge that
 * becomes 1x1, or one that now overlaps an earlier merge, is discarded.
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
 * Deletes the column at index. Does nothing when columns has only 1 item. Overrides/merges
 * that originate at the deleted column are discarded, and merges that covered the deleted
 * column have colSpan narrowed by one column (discarded if it becomes 1x1).
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
 * Swaps the column at index with its neighbor in the delta direction. Does nothing at the
 * edge. Merges that become invalid due to the swap (overflow past the column range, reaching
 * a mergeSameValue column, overlap with another merge) are truncated or discarded.
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

/** Appends a merge at the end. Default is a 2-row vertical merge starting at row 0 of the first column */
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

/** Appends span at the end. It's the caller's contract to have already validated it */
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
 * Applies patch to the merge at index. rowSpan / colSpan don't get an attribute when 1 (the
 * default), and rowSpan is removed on a "header" row. Returns the same reference if unchanged.
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

/** Deletes the merge at index. Removes the cellSpans attribute entirely if it becomes empty */
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

/** Deletes the merges at indices in bulk. Removes the cellSpans attribute entirely if it becomes empty; returns the same reference if there's nothing to remove */
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
 * Sets a table cell's fixed-value override. If value is an empty string, removes the override
 * for that (row, key), and removes the cellOverrides attribute entirely once overrides reaches 0.
 * Returns the same reference for document if unchanged (the commit-if-changed convention).
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

/** Sets the logical name of a slot other than regular. undefined clears the slot (removes the attribute) */
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
