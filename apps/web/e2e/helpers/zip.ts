const EOCD_SIZE = 22;
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const CENTRAL_HEADER_SIZE = 46;
const LOCAL_HEADER_SIZE = 30;

export interface ZipEntryData {
  readonly name: string;
  readonly data: Buffer;
}

/** Reads back a STORE-only zip (no comment, single disk) from its central directory.
    Throws if any entry has a compression method other than 0 (early detection of a broken assumption) */
export function readStoreZip(buffer: Buffer): readonly ZipEntryData[] {
  const eocdOffset = buffer.length - EOCD_SIZE;
  if (eocdOffset < 0 || buffer.readUInt32LE(eocdOffset) !== EOCD_SIGNATURE) {
    throw new Error("EOCD record not found");
  }
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);

  const entries: ZipEntryData[] = [];
  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new Error("central directory header is invalid");
    }
    const method = buffer.readUInt16LE(offset + 10);
    const size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer
      .subarray(
        offset + CENTRAL_HEADER_SIZE,
        offset + CENTRAL_HEADER_SIZE + nameLength,
      )
      .toString("utf8");
    if (method !== 0) {
      throw new Error(
        `Entry uses a compression method other than STORE: ${name}`,
      );
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart =
      localOffset + LOCAL_HEADER_SIZE + localNameLength + localExtraLength;
    entries.push({ name, data: buffer.subarray(dataStart, dataStart + size) });
    offset += CENTRAL_HEADER_SIZE + nameLength + extraLength + commentLength;
  }
  return entries;
}
