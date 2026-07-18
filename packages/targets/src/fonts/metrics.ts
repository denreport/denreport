const HEADER_SIZE = 12;
const TABLE_RECORD_SIZE = 16;

const TAG_HEAD = 0x68656164;
const TAG_HHEA = 0x68686561;

const HEAD_UNITS_PER_EM_OFFSET = 18;
const HHEA_ASCENDER_OFFSET = 4;

/**
 * Reads a TTF's ascender as a fraction of its unitsPerEm (from the `hhea` and
 * `head` tables), for use as a baseline offset when placing text. Returns
 * null if `data` is not a valid TTF or lacks the required tables.
 */
export function readAscentPerEm(data: Uint8Array): number | null {
  if (data.length < HEADER_SIZE) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const numTables = view.getUint16(4);
  const directoryEnd = HEADER_SIZE + numTables * TABLE_RECORD_SIZE;
  if (directoryEnd > data.length) return null;

  let unitsPerEm: number | null = null;
  let ascender: number | null = null;
  for (let i = 0; i < numTables; i++) {
    const record = HEADER_SIZE + i * TABLE_RECORD_SIZE;
    const tag = view.getUint32(record);
    const offset = view.getUint32(record + 8);
    const length = view.getUint32(record + 12);
    if (offset + length > data.length) continue;
    if (tag === TAG_HEAD && length >= HEAD_UNITS_PER_EM_OFFSET + 2) {
      unitsPerEm = view.getUint16(offset + HEAD_UNITS_PER_EM_OFFSET);
    }
    if (tag === TAG_HHEA && length >= HHEA_ASCENDER_OFFSET + 2) {
      ascender = view.getInt16(offset + HHEA_ASCENDER_OFFSET);
    }
  }

  if (unitsPerEm === null || unitsPerEm === 0 || ascender === null) return null;
  return ascender / unitsPerEm;
}
