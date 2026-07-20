export interface ZipEntry {
  /** Entry name (stored with the UTF-8 flag set) */
  readonly name: string;
  readonly data: Uint8Array;
}

const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const EOCD_SIZE = 22;

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;

const VERSION_2_0 = 20;
const FLAG_UTF8_NAME = 0x0800;
// Minimum DOS date value = 1980-01-01 (year=0, month=1, day=1). Time is 00:00
const DOS_DATE_EPOCH = 0x21;

const CRC_TABLE = ((): Uint32Array => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Assembles an uncompressed (STORE) zip archive. Uses a fixed timestamp (the minimum DOS
    format value = 1980-01-01 00:00), so the same input always produces a byte-identical
    output (determinism). Does not use ZIP64, encryption, or data descriptors */
export function buildZip(
  entries: readonly ZipEntry[],
): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const records = entries.map((entry) => ({
    name: encoder.encode(entry.name),
    data: entry.data,
    crc: crc32(entry.data),
  }));

  const localSectionSize = records.reduce(
    (total, r) => total + LOCAL_HEADER_SIZE + r.name.length + r.data.length,
    0,
  );
  const centralSectionSize = records.reduce(
    (total, r) => total + CENTRAL_HEADER_SIZE + r.name.length,
    0,
  );
  const bytes = new Uint8Array(
    localSectionSize + centralSectionSize + EOCD_SIZE,
  );
  const view = new DataView(bytes.buffer);

  let offset = 0;
  const localOffsets: number[] = [];
  for (const record of records) {
    localOffsets.push(offset);
    view.setUint32(offset, LOCAL_SIGNATURE, true);
    view.setUint16(offset + 4, VERSION_2_0, true);
    view.setUint16(offset + 6, FLAG_UTF8_NAME, true);
    view.setUint16(offset + 8, 0, true); // STORE
    view.setUint16(offset + 10, 0, true); // time 00:00
    view.setUint16(offset + 12, DOS_DATE_EPOCH, true);
    view.setUint32(offset + 14, record.crc, true);
    view.setUint32(offset + 18, record.data.length, true);
    view.setUint32(offset + 22, record.data.length, true);
    view.setUint16(offset + 26, record.name.length, true);
    view.setUint16(offset + 28, 0, true); // no extra field
    bytes.set(record.name, offset + LOCAL_HEADER_SIZE);
    bytes.set(record.data, offset + LOCAL_HEADER_SIZE + record.name.length);
    offset += LOCAL_HEADER_SIZE + record.name.length + record.data.length;
  }

  const centralOffset = offset;
  records.forEach((record, i) => {
    view.setUint32(offset, CENTRAL_SIGNATURE, true);
    view.setUint16(offset + 4, VERSION_2_0, true); // version made by
    view.setUint16(offset + 6, VERSION_2_0, true); // version needed
    view.setUint16(offset + 8, FLAG_UTF8_NAME, true);
    view.setUint16(offset + 10, 0, true); // STORE
    view.setUint16(offset + 12, 0, true); // time 00:00
    view.setUint16(offset + 14, DOS_DATE_EPOCH, true);
    view.setUint32(offset + 16, record.crc, true);
    view.setUint32(offset + 20, record.data.length, true);
    view.setUint32(offset + 24, record.data.length, true);
    view.setUint16(offset + 28, record.name.length, true);
    view.setUint16(offset + 30, 0, true); // no extra field
    view.setUint16(offset + 32, 0, true); // no comment
    view.setUint16(offset + 34, 0, true); // disk 0
    view.setUint16(offset + 36, 0, true); // internal attributes
    view.setUint32(offset + 38, 0, true); // external attributes
    view.setUint32(offset + 42, localOffsets[i] ?? 0, true);
    bytes.set(record.name, offset + CENTRAL_HEADER_SIZE);
    offset += CENTRAL_HEADER_SIZE + record.name.length;
  });

  view.setUint32(offset, EOCD_SIGNATURE, true);
  view.setUint16(offset + 4, 0, true); // disk 0
  view.setUint16(offset + 6, 0, true); // disk where the central directory starts
  view.setUint16(offset + 8, records.length, true);
  view.setUint16(offset + 10, records.length, true);
  view.setUint32(offset + 12, centralSectionSize, true);
  view.setUint32(offset + 16, centralOffset, true);
  view.setUint16(offset + 20, 0, true); // no comment

  return bytes;
}
