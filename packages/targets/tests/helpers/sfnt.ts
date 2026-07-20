const HEADER_SIZE = 12;
const TABLE_RECORD_SIZE = 16;

export interface SfntTable {
  readonly tag: string;
  readonly data?: Uint8Array;
}

function writeTag(view: DataView, offset: number, tag: string): void {
  for (let i = 0; i < 4; i++) view.setUint8(offset + i, tag.charCodeAt(i));
}

// A synthetic sfnt with a table directory and (only when given) table
// bodies. This suffices because format detection and metrics reading only
// read the header, the directory, and head/hhea.
export function buildSfnt(
  version: number | string,
  tables: readonly (string | SfntTable)[],
): Uint8Array {
  const entries = tables.map((table) =>
    typeof table === "string" ? { tag: table } : table,
  );
  const bodiesSize = entries.reduce(
    (total, entry) => total + (entry.data?.length ?? 0),
    0,
  );
  const directoryEnd = HEADER_SIZE + entries.length * TABLE_RECORD_SIZE;
  const bytes = new Uint8Array(directoryEnd + bodiesSize);
  const view = new DataView(bytes.buffer);
  if (typeof version === "string") writeTag(view, 0, version);
  else view.setUint32(0, version);
  view.setUint16(4, entries.length);

  let bodyOffset = directoryEnd;
  entries.forEach((entry, i) => {
    const record = HEADER_SIZE + i * TABLE_RECORD_SIZE;
    writeTag(view, record, entry.tag);
    if (entry.data !== undefined) {
      view.setUint32(record + 8, bodyOffset);
      view.setUint32(record + 12, entry.data.length);
      bytes.set(entry.data, bodyOffset);
      bodyOffset += entry.data.length;
    }
  });
  return bytes;
}

export function buildHeadTable(unitsPerEm: number): Uint8Array {
  const bytes = new Uint8Array(54);
  new DataView(bytes.buffer).setUint16(18, unitsPerEm);
  return bytes;
}

export function buildHheaTable(
  ascender: number,
  numberOfHMetrics = 0,
): Uint8Array {
  const bytes = new Uint8Array(36);
  const view = new DataView(bytes.buffer);
  view.setInt16(4, ascender);
  view.setUint16(34, numberOfHMetrics);
  return bytes;
}

export interface HmtxEntry {
  readonly advanceWidth: number;
  readonly lsb: number;
}

export function buildHmtxTable(entries: readonly HmtxEntry[]): Uint8Array {
  const bytes = new Uint8Array(entries.length * 4);
  const view = new DataView(bytes.buffer);
  entries.forEach((entry, i) => {
    view.setUint16(i * 4, entry.advanceWidth);
    view.setInt16(i * 4 + 2, entry.lsb);
  });
  return bytes;
}

export interface CmapMapping {
  readonly code: number;
  readonly glyphId: number;
}

// A simplified format 4 subtable with 1 code point = 1 segment
// (idRangeOffset is always 0). Appends the conventional terminating segment
// (0xFFFF -> unmapped) at the end.
export function buildCmapFormat4Subtable(
  mappings: readonly CmapMapping[],
): Uint8Array {
  const segments = [
    ...[...mappings]
      .sort((a, b) => a.code - b.code)
      .map((m) => ({
        start: m.code,
        end: m.code,
        idDelta: (m.glyphId - m.code) & 0xffff,
      })),
    { start: 0xffff, end: 0xffff, idDelta: 1 },
  ];
  const segCount = segments.length;
  const length = 14 + segCount * 2 * 4 + 2;
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 4);
  view.setUint16(2, length);
  view.setUint16(4, 0);
  view.setUint16(6, segCount * 2);
  let offset = 14;
  for (const seg of segments) {
    view.setUint16(offset, seg.end);
    offset += 2;
  }
  offset += 2; // reservedPad
  for (const seg of segments) {
    view.setUint16(offset, seg.start);
    offset += 2;
  }
  for (const seg of segments) {
    view.setInt16(offset, seg.idDelta);
    offset += 2;
  }
  for (const _seg of segments) {
    view.setUint16(offset, 0); // idRangeOffset
    offset += 2;
  }
  return bytes;
}

export interface CmapGroup {
  readonly startCharCode: number;
  readonly endCharCode: number;
  readonly startGlyphId: number;
}

export function buildCmapFormat12Subtable(
  groups: readonly CmapGroup[],
): Uint8Array {
  const length = 16 + groups.length * 12;
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 12);
  view.setUint32(4, length);
  view.setUint32(12, groups.length);
  let offset = 16;
  for (const group of groups) {
    view.setUint32(offset, group.startCharCode);
    view.setUint32(offset + 4, group.endCharCode);
    view.setUint32(offset + 8, group.startGlyphId);
    offset += 12;
  }
  return bytes;
}

export interface CmapSubtableEntry {
  readonly platformId: number;
  readonly encodingId: number;
  readonly data: Uint8Array;
}

export function buildCmapTable(
  subtables: readonly CmapSubtableEntry[],
): Uint8Array {
  const headerSize = 4 + subtables.length * 8;
  const bodySize = subtables.reduce((total, s) => total + s.data.length, 0);
  const bytes = new Uint8Array(headerSize + bodySize);
  const view = new DataView(bytes.buffer);
  view.setUint16(2, subtables.length);
  let subtableOffset = headerSize;
  subtables.forEach((s, i) => {
    const record = 4 + i * 8;
    view.setUint16(record, s.platformId);
    view.setUint16(record + 2, s.encodingId);
    view.setUint32(record + 4, subtableOffset);
    bytes.set(s.data, subtableOffset);
    subtableOffset += s.data.length;
  });
  return bytes;
}

export const SYNTHETIC_TTF_ASCENT_PER_EM = 0.8;
// Has an hmtx with only glyph0 (.notdef) and an empty cmap, so every code point falls back to this width.
export const SYNTHETIC_TTF_CHAR_WIDTH_EM = 0.001;

export function syntheticTtf(): Uint8Array {
  return buildSfnt(0x00010000, [
    "glyf",
    { tag: "head", data: buildHeadTable(1000) },
    { tag: "hhea", data: buildHheaTable(800, 1) },
    { tag: "hmtx", data: buildHmtxTable([{ advanceWidth: 1, lsb: 0 }]) },
    {
      tag: "cmap",
      data: buildCmapTable([
        { platformId: 3, encodingId: 1, data: buildCmapFormat4Subtable([]) },
      ]),
    },
    "loca",
  ]);
}

export function syntheticCff(): Uint8Array {
  return buildSfnt("OTTO", ["CFF ", "head"]);
}

// A TTF where every code point falls back to the same advance (em ratio =
// advanceWidth / unitsPerEm). For tests that want to trigger wrapping /
// justification deterministically from w and fontSize.
export function buildUniformWidthTtf(
  advanceWidth: number,
  unitsPerEm = 1000,
  ascender = 800,
): Uint8Array {
  return buildSfnt(0x00010000, [
    "glyf",
    { tag: "head", data: buildHeadTable(unitsPerEm) },
    { tag: "hhea", data: buildHheaTable(ascender, 1) },
    { tag: "hmtx", data: buildHmtxTable([{ advanceWidth, lsb: 0 }]) },
    {
      tag: "cmap",
      data: buildCmapTable([
        { platformId: 3, encodingId: 1, data: buildCmapFormat4Subtable([]) },
      ]),
    },
    "loca",
  ]);
}
