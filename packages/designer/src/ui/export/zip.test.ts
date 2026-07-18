import { describe, expect, it } from "vitest";
import type { ZipEntry } from "./zip";
import { buildZip } from "./zip";

interface ReadEntry {
  readonly name: string;
  readonly crc: number;
  readonly size: number;
  readonly localOffset: number;
  readonly data: Uint8Array;
}

interface ReadArchive {
  readonly entryCount: number;
  readonly centralSize: number;
  readonly centralOffset: number;
  readonly entries: readonly ReadEntry[];
}

// 生成側の逆手順で読み戻す最小の zip リーダー（テスト専用・STORE 前提）
function readZip(bytes: Uint8Array): ReadArchive {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = bytes.length - 22;
  expect(view.getUint32(eocdOffset, true)).toBe(0x06054b50);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralSize = view.getUint32(eocdOffset + 12, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);

  const decoder = new TextDecoder();
  const entries: ReadEntry[] = [];
  let offset = centralOffset;
  for (let i = 0; i < entryCount; i++) {
    expect(view.getUint32(offset, true)).toBe(0x02014b50);
    expect(view.getUint16(offset + 10, true)).toBe(0); // STORE
    const crc = view.getUint32(offset + 16, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
    );

    expect(view.getUint32(localOffset, true)).toBe(0x04034b50);
    expect(view.getUint16(localOffset + 6, true) & 0x0800).toBe(0x0800);
    expect(view.getUint32(localOffset + 14, true)).toBe(crc);
    expect(view.getUint32(localOffset + 18, true)).toBe(size);
    const localNameLength = view.getUint16(localOffset + 26, true);
    expect(
      decoder.decode(
        bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength),
      ),
    ).toBe(name);
    const dataStart = localOffset + 30 + localNameLength;
    entries.push({
      name,
      crc,
      size,
      localOffset,
      data: bytes.subarray(dataStart, dataStart + size),
    });
    offset += 46 + nameLength;
  }
  return { entryCount, centralSize, centralOffset, entries };
}

function textEntry(name: string, text: string): ZipEntry {
  return { name, data: new TextEncoder().encode(text) };
}

describe("buildZip", () => {
  it("2エントリの構造（ローカルヘッダ・セントラルディレクトリ・EOCD）が整合する", () => {
    const zip = buildZip([
      textEntry("report.py", "print('hi')"),
      textEntry("NotoSansJP.ttf", "font-bytes"),
    ]);
    const archive = readZip(zip);
    expect(archive.entryCount).toBe(2);
    expect(archive.entries.map((e) => e.name)).toEqual([
      "report.py",
      "NotoSansJP.ttf",
    ]);
    expect(new TextDecoder().decode(archive.entries[0]?.data)).toBe(
      "print('hi')",
    );
    expect(new TextDecoder().decode(archive.entries[1]?.data)).toBe(
      "font-bytes",
    );
    expect(archive.entries[0]?.localOffset).toBe(0);
    // central directory は全ローカルセクションの直後から始まる
    const localSection = archive.centralOffset;
    const secondLocal = archive.entries[1]?.localOffset ?? 0;
    expect(secondLocal).toBeGreaterThan(0);
    expect(secondLocal).toBeLessThan(localSection);
    expect(zip.length).toBe(archive.centralOffset + archive.centralSize + 22);
  });

  it('既知データの CRC-32 が仕様値になる（"123456789" = 0xCBF43926）', () => {
    const zip = buildZip([textEntry("crc.txt", "123456789")]);
    const archive = readZip(zip);
    expect(archive.entries[0]?.crc).toBe(0xcbf43926);
  });

  it("同一入力からバイト同一の出力を返す（決定性）", () => {
    const entries = [
      textEntry("a.txt", "同じ内容"),
      { name: "b.bin", data: new Uint8Array([0, 1, 2, 255]) },
    ];
    expect(buildZip(entries)).toEqual(buildZip(entries));
  });

  it("空データのエントリを格納できる", () => {
    const zip = buildZip([{ name: "empty.txt", data: new Uint8Array(0) }]);
    const archive = readZip(zip);
    expect(archive.entries[0]?.size).toBe(0);
    expect(archive.entries[0]?.crc).toBe(0);
  });

  it("数 MB 級のエントリを格納できる", () => {
    const big = new Uint8Array(3 * 1024 * 1024);
    for (let i = 0; i < big.length; i++) {
      big[i] = i % 251;
    }
    const zip = buildZip([{ name: "big.bin", data: big }]);
    const archive = readZip(zip);
    expect(archive.entries[0]?.size).toBe(big.length);
    // 数 MB の Uint8Array を toEqual で全走査するとタイムアウトするため Buffer で比較する
    expect(
      Buffer.from(archive.entries[0]?.data ?? []).equals(Buffer.from(big)),
    ).toBe(true);
  });

  it("エントリ名は UTF-8 で格納される", () => {
    const zip = buildZip([textEntry("帳票.py", "code")]);
    expect(readZip(zip).entries[0]?.name).toBe("帳票.py");
  });
});
