/**
 * The outline/container format detected in a font file's binary data. "ttf"
 * (TrueType outlines in a single-font SFNT container) is the only format
 * export targets accept (see validateFont).
 */
export type FontFormat =
  | "ttf"
  | "cff"
  | "collection"
  | "woff"
  | "woff2"
  | "unknown";

const HEADER_SIZE = 12;
const TABLE_RECORD_SIZE = 16;

const TAG_TTCF = 0x74746366;
const TAG_WOFF = 0x774f4646;
const TAG_WOF2 = 0x774f4632;
const TAG_GLYF = 0x676c7966;
const TAG_CFF = 0x43464620;
const TAG_CFF2 = 0x43464632;

/**
 * Inspects `data`'s SFNT header and table directory to determine its font
 * format. Returns "unknown" if `data` is too short or its table directory is
 * truncated.
 */
// Determine the outline kind from the table tags rather than sfntVersion, so
// that non-conformant fonts wrapping CFF2 in 0x00010000 are still reported correctly.
export function detectFontFormat(data: Uint8Array): FontFormat {
  if (data.length < HEADER_SIZE) return "unknown";
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const headerTag = view.getUint32(0);
  if (headerTag === TAG_TTCF) return "collection";
  if (headerTag === TAG_WOFF) return "woff";
  if (headerTag === TAG_WOF2) return "woff2";

  const numTables = view.getUint16(4);
  const directoryEnd = HEADER_SIZE + numTables * TABLE_RECORD_SIZE;
  if (directoryEnd > data.length) return "unknown";

  let hasGlyf = false;
  for (let i = 0; i < numTables; i++) {
    const tag = view.getUint32(HEADER_SIZE + i * TABLE_RECORD_SIZE);
    if (tag === TAG_CFF || tag === TAG_CFF2) return "cff";
    if (tag === TAG_GLYF) hasGlyf = true;
  }
  return hasGlyf ? "ttf" : "unknown";
}
