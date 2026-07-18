import type { CharWidthEm } from "@denreport/core";

const HEADER_SIZE = 12;
const TABLE_RECORD_SIZE = 16;

const TAG_HEAD = 0x68656164;
const TAG_HHEA = 0x68686561;
const TAG_HMTX = 0x686d7478;
const TAG_CMAP = 0x636d6170;

const HEAD_UNITS_PER_EM_OFFSET = 18;
const HHEA_NUM_H_METRICS_OFFSET = 34;

const PLATFORM_UNICODE = 0;
const PLATFORM_WINDOWS = 3;
const ENCODING_WINDOWS_UNICODE_BMP = 1;
const ENCODING_WINDOWS_UNICODE_FULL = 10;

interface TableRecord {
  readonly offset: number;
  readonly length: number;
}

function readTableDirectory(
  view: DataView,
  dataLength: number,
): Map<number, TableRecord> | null {
  const numTables = view.getUint16(4);
  const directoryEnd = HEADER_SIZE + numTables * TABLE_RECORD_SIZE;
  if (directoryEnd > dataLength) return null;
  const tables = new Map<number, TableRecord>();
  for (let i = 0; i < numTables; i++) {
    const record = HEADER_SIZE + i * TABLE_RECORD_SIZE;
    const tag = view.getUint32(record);
    const offset = view.getUint32(record + 8);
    const length = view.getUint32(record + 12);
    if (offset + length <= dataLength) tables.set(tag, { offset, length });
  }
  return tables;
}

type GlyphIndexFor = (codePoint: number) => number;

// format 4（BMP のみ）。セグメントは endCode 昇順で並ぶ規約のため線形走査で十分。
// idRangeOffset は任意のバイトオフセットを指しうるため、壊れたフォントではバッファ外を
// 指すことがある。読めなければ .notdef（glyph 0）扱いにして、既存の未マップ経路へ合流させる
function parseCmapFormat4(
  view: DataView,
  offset: number,
  dataLength: number,
): GlyphIndexFor | null {
  if (offset + 14 > dataLength) return null;
  const segCountX2 = view.getUint16(offset + 6);
  const segCount = segCountX2 / 2;
  const endCodeOffset = offset + 14;
  const startCodeOffset = endCodeOffset + segCountX2 + 2; // +2 は reservedPad
  const idDeltaOffset = startCodeOffset + segCountX2;
  const idRangeOffsetOffset = idDeltaOffset + segCountX2;
  const glyphIdArrayOffset = idRangeOffsetOffset + segCountX2;
  if (glyphIdArrayOffset > dataLength) return null;
  return (codePoint: number): number => {
    if (codePoint > 0xffff) return 0;
    for (let i = 0; i < segCount; i++) {
      const endCode = view.getUint16(endCodeOffset + i * 2);
      if (codePoint > endCode) continue;
      const startCode = view.getUint16(startCodeOffset + i * 2);
      if (codePoint < startCode) return 0;
      const idDelta = view.getInt16(idDeltaOffset + i * 2);
      const idRangeOffset = view.getUint16(idRangeOffsetOffset + i * 2);
      if (idRangeOffset === 0) {
        return (codePoint + idDelta) & 0xffff;
      }
      const glyphIndexAddress =
        idRangeOffsetOffset +
        i * 2 +
        idRangeOffset +
        (codePoint - startCode) * 2;
      if (glyphIndexAddress + 2 > dataLength) return 0;
      const glyphId = view.getUint16(glyphIndexAddress);
      return glyphId === 0 ? 0 : (glyphId + idDelta) & 0xffff;
    }
    return 0;
  };
}

// format 12（全域）。グループは startCharCode 昇順で並ぶ規約のため線形走査で十分
function parseCmapFormat12(
  view: DataView,
  offset: number,
  dataLength: number,
): GlyphIndexFor | null {
  if (offset + 16 > dataLength) return null;
  const numGroups = view.getUint32(offset + 12);
  const groupsOffset = offset + 16;
  if (groupsOffset + numGroups * 12 > dataLength) return null;
  return (codePoint: number): number => {
    for (let i = 0; i < numGroups; i++) {
      const group = groupsOffset + i * 12;
      const startCharCode = view.getUint32(group);
      const endCharCode = view.getUint32(group + 4);
      if (codePoint < startCharCode || codePoint > endCharCode) continue;
      const startGlyphId = view.getUint32(group + 8);
      return startGlyphId + (codePoint - startCharCode);
    }
    return 0;
  };
}

// platform 3 (Windows) encoding 10 (Unicode full) > encoding 1 (Unicode BMP) > platform 0 (Unicode) の優先順
function selectCmapSubtable(
  view: DataView,
  cmapOffset: number,
  cmapLength: number,
  dataLength: number,
): number | null {
  if (cmapLength < 4) return null;
  const numTables = view.getUint16(cmapOffset + 2);
  const recordsEnd = cmapOffset + 4 + numTables * 8;
  if (recordsEnd > cmapOffset + cmapLength) return null;
  let fullOffset: number | null = null;
  let bmpOffset: number | null = null;
  let unicodeOffset: number | null = null;
  for (let i = 0; i < numTables; i++) {
    const record = cmapOffset + 4 + i * 8;
    const platformId = view.getUint16(record);
    const encodingId = view.getUint16(record + 2);
    const subtableOffset = cmapOffset + view.getUint32(record + 4);
    if (subtableOffset + 2 > dataLength) continue;
    if (
      platformId === PLATFORM_WINDOWS &&
      encodingId === ENCODING_WINDOWS_UNICODE_FULL
    ) {
      fullOffset = subtableOffset;
    } else if (
      platformId === PLATFORM_WINDOWS &&
      encodingId === ENCODING_WINDOWS_UNICODE_BMP
    ) {
      bmpOffset = subtableOffset;
    } else if (platformId === PLATFORM_UNICODE && unicodeOffset === null) {
      unicodeOffset = subtableOffset;
    }
  }
  return fullOffset ?? bmpOffset ?? unicodeOffset;
}

/**
 * Builds a CharWidthEm function from a TTF's `cmap` (format 4 or 12), `hmtx`,
 * `hhea.numberOfHMetrics`, and `head.unitsPerEm` tables. Returns null if
 * `data` is not a valid TTF or is missing a required table.
 */
export function readCharWidths(data: Uint8Array): CharWidthEm | null {
  if (data.length < HEADER_SIZE) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tables = readTableDirectory(view, data.length);
  if (tables === null) return null;

  const head = tables.get(TAG_HEAD);
  const hhea = tables.get(TAG_HHEA);
  const hmtx = tables.get(TAG_HMTX);
  const cmap = tables.get(TAG_CMAP);
  if (!head || !hhea || !hmtx || !cmap) return null;

  if (head.length < HEAD_UNITS_PER_EM_OFFSET + 2) return null;
  const unitsPerEm = view.getUint16(head.offset + HEAD_UNITS_PER_EM_OFFSET);
  if (unitsPerEm === 0) return null;

  if (hhea.length < HHEA_NUM_H_METRICS_OFFSET + 2) return null;
  const numberOfHMetrics = view.getUint16(
    hhea.offset + HHEA_NUM_H_METRICS_OFFSET,
  );
  if (numberOfHMetrics === 0 || hmtx.length < numberOfHMetrics * 4) return null;

  const subtableOffset = selectCmapSubtable(
    view,
    cmap.offset,
    cmap.length,
    data.length,
  );
  if (subtableOffset === null) return null;
  const format = view.getUint16(subtableOffset);
  const glyphIndexFor =
    format === 4
      ? parseCmapFormat4(view, subtableOffset, data.length)
      : format === 12
        ? parseCmapFormat12(view, subtableOffset, data.length)
        : null;
  if (glyphIndexFor === null) return null;

  return (codePoint: number): number => {
    const glyphId = glyphIndexFor(codePoint);
    const index = Math.min(glyphId, numberOfHMetrics - 1);
    return view.getUint16(hmtx.offset + index * 4) / unitsPerEm;
  };
}
