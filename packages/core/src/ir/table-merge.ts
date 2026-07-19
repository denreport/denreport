import type { IrTableRow } from "./data";
import type { IrTableElement } from "./types";

/**
 * A half-open interval [start, end) to exclude from a grid line. On a
 * horizontal line the unit is the column index; on a vertical line it is the
 * chunk-local row number (the header band is -1).
 */
export interface SkipRange {
  readonly start: number;
  readonly end: number;
}

/**
 * One merged-cell rectangle within a chunk. `q` is the chunk-local row number
 * (`"header"` for the header row); `rowSpan` is the value after cutting at
 * the chunk boundary.
 */
export interface TableMergeRect {
  readonly q: number | "header";
  readonly col: number;
  readonly rowSpan: number;
  readonly colSpan: number;
}

/**
 * The merge geometry of one chunk. `covered` holds the non-origin covered
 * cells keyed `"q:col"`; the skip maps are keyed by horizontal line index
 * (chunk-local row number) and vertical line index (column index).
 */
export interface TableChunkMerges {
  readonly rects: readonly TableMergeRect[];
  readonly covered: ReadonlySet<string>;
  readonly horizontalSkips: ReadonlyMap<number, readonly SkipRange[]>;
  readonly verticalSkips: ReadonlyMap<number, readonly SkipRange[]>;
}

interface RowInterval {
  readonly start: number;
  readonly end: number;
  readonly col: number;
  readonly colSpan: number;
}

// 検証前の文書（デザイナーの編集途中）にも適用されるため、
// 不正な key・範囲超過はエラーにせず読み飛ばし・切り詰めで吸収する
function staticIntervals(table: IrTableElement): {
  readonly header: readonly TableMergeRect[];
  readonly body: readonly RowInterval[];
} {
  const indexByKey = new Map(table.columns.map((col, i) => [col.key, i]));
  const header: TableMergeRect[] = [];
  const body: RowInterval[] = [];
  for (const span of table.cellSpans ?? []) {
    const col = indexByKey.get(span.key);
    if (col === undefined) continue;
    const colSpan = Math.min(
      Math.max(1, span.colSpan ?? 1),
      table.columns.length - col,
    );
    if (span.row === "header") {
      header.push({ q: "header", col, rowSpan: 1, colSpan });
      continue;
    }
    if (!Number.isInteger(span.row) || span.row < 0) continue;
    body.push({
      start: span.row,
      end: span.row + Math.max(1, span.rowSpan ?? 1),
      col,
      colSpan,
    });
  }
  return { header, body };
}

function dataIntervals(
  table: IrTableElement,
  rows: readonly IrTableRow[],
): RowInterval[] {
  const out: RowInterval[] = [];
  // 左の mergeSameValue 列の値が変わる行では、右の列の結合区間も切る（階層グルーピング）
  const boundaries = new Set<number>();
  table.columns.forEach((column, col) => {
    if (column.mergeSameValue !== true) return;
    const changes: number[] = [];
    let start = 0;
    for (let t = 1; t <= rows.length; t++) {
      const prev = rows[t - 1]?.[column.key] ?? "";
      const changed =
        t === rows.length || (rows[t]?.[column.key] ?? "") !== prev;
      if (changed || boundaries.has(t)) {
        if (t - start >= 2 && prev !== "") {
          out.push({ start, end: t, col, colSpan: 1 });
        }
        if (changed && t < rows.length) changes.push(t);
        start = t;
      }
    }
    for (const t of changes) boundaries.add(t);
  });
  return out;
}

function addSkip(
  skips: Map<number, SkipRange[]>,
  line: number,
  range: SkipRange,
): void {
  const list = skips.get(line);
  if (list === undefined) {
    skips.set(line, [range]);
  } else {
    list.push(range);
  }
}

/**
 * Computes the merge geometry of one table chunk (rows
 * [`rowOffset`, `rowOffset + chunkSize`)). `rows` is the readTableRows result
 * (cellOverrides already applied); data-driven merges group on those values.
 * Merges crossing the chunk boundary are cut, each part keeping its own
 * origin. Pure function shared by lowerIr and the designer canvas.
 */
export function computeChunkMerges(
  table: IrTableElement,
  rows: readonly IrTableRow[],
  rowOffset: number,
  chunkSize: number,
): TableChunkMerges {
  const { header, body } = staticIntervals(table);
  const rects: TableMergeRect[] = [...header];
  for (const interval of [...body, ...dataIntervals(table, rows)]) {
    const start = Math.max(interval.start, rowOffset);
    const end = Math.min(interval.end, rowOffset + chunkSize);
    if (end <= start) continue;
    rects.push({
      q: start - rowOffset,
      col: interval.col,
      rowSpan: end - start,
      colSpan: interval.colSpan,
    });
  }

  const covered = new Set<string>();
  const horizontalSkips = new Map<number, SkipRange[]>();
  const verticalSkips = new Map<number, SkipRange[]>();
  for (const rect of rects) {
    if (rect.q === "header") {
      for (let c = rect.col + 1; c < rect.col + rect.colSpan; c++) {
        covered.add(`header:${c}`);
        addSkip(verticalSkips, c, { start: -1, end: 0 });
      }
      continue;
    }
    for (let r = rect.q; r < rect.q + rect.rowSpan; r++) {
      for (let c = rect.col; c < rect.col + rect.colSpan; c++) {
        if (r === rect.q && c === rect.col) continue;
        covered.add(`${r}:${c}`);
      }
    }
    for (let line = rect.q + 1; line < rect.q + rect.rowSpan; line++) {
      addSkip(horizontalSkips, line, {
        start: rect.col,
        end: rect.col + rect.colSpan,
      });
    }
    for (let c = rect.col + 1; c < rect.col + rect.colSpan; c++) {
      addSkip(verticalSkips, c, { start: rect.q, end: rect.q + rect.rowSpan });
    }
  }
  return { rects, covered, horizontalSkips, verticalSkips };
}

/**
 * Returns the sub-intervals of [`start`, `end`) that remain after removing
 * `skips` (unsorted, possibly overlapping ranges are tolerated). With no
 * skips the domain comes back as a single interval, so grid lines that no
 * merge crosses stay one full-length segment.
 */
export function subtractSkips(
  start: number,
  end: number,
  skips: readonly SkipRange[] | undefined,
): readonly SkipRange[] {
  if (skips === undefined || skips.length === 0) {
    return [{ start, end }];
  }
  const sorted = [...skips].sort((a, b) => a.start - b.start);
  const out: SkipRange[] = [];
  let pos = start;
  for (const skip of sorted) {
    const s = Math.max(skip.start, pos);
    const e = Math.min(skip.end, end);
    if (e <= s) continue;
    if (pos < s) out.push({ start: pos, end: s });
    pos = e;
  }
  if (pos < end) out.push({ start: pos, end });
  return out;
}
