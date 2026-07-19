import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EMBEDDED_BOLD_FONT_NAME,
  EMBEDDED_BOLD_FONT_URL,
  EMBEDDED_FONT_LICENSE_URL,
  EMBEDDED_FONT_NAME,
  EMBEDDED_FONT_URL,
} from "../src/fonts/embedded";
import { detectFontFormat } from "../src/fonts/format";

interface TableRecord {
  readonly offset: number;
  readonly length: number;
}

function readTag(data: Uint8Array, offset: number): string {
  return String.fromCharCode(
    data[offset] ?? 0,
    data[offset + 1] ?? 0,
    data[offset + 2] ?? 0,
    data[offset + 3] ?? 0,
  );
}

function tableDirectory(data: Uint8Array): ReadonlyMap<string, TableRecord> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const numTables = view.getUint16(4);
  const directory = new Map<string, TableRecord>();
  for (let i = 0; i < numTables; i++) {
    const recordOffset = 12 + i * 16;
    directory.set(readTag(data, recordOffset), {
      offset: view.getUint32(recordOffset + 8),
      length: view.getUint32(recordOffset + 12),
    });
  }
  return directory;
}

// Windows (platformID 3) の UTF-16BE レコードだけ読む最小実装
function nameStrings(
  data: Uint8Array,
  table: TableRecord,
): ReadonlyMap<number, string> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const count = view.getUint16(table.offset + 2);
  const storageOffset = table.offset + view.getUint16(table.offset + 4);
  const names = new Map<number, string>();
  for (let i = 0; i < count; i++) {
    const record = table.offset + 6 + i * 12;
    if (view.getUint16(record) !== 3) continue;
    const nameId = view.getUint16(record + 6);
    const length = view.getUint16(record + 8);
    const start = storageOffset + view.getUint16(record + 10);
    let value = "";
    for (let p = 0; p < length; p += 2) {
      value += String.fromCharCode(view.getUint16(start + p));
    }
    names.set(nameId, value);
  }
  return names;
}

describe("embedded font asset", () => {
  const font = new Uint8Array(readFileSync(EMBEDDED_FONT_URL));
  const directory = tableDirectory(font);

  it("exposes the recommended logical name", () => {
    expect(EMBEDDED_FONT_NAME).toBe("NotoSansJP");
  });

  it("is detected as a glyf-outline TTF", () => {
    expect(detectFontFormat(font)).toBe("ttf");
  });

  it("contains glyf and no CFF/CFF2/fvar/gvar tables (static instance)", () => {
    const tags = [...directory.keys()];
    expect(tags).toContain("glyf");
    for (const forbidden of ["CFF ", "CFF2", "fvar", "gvar"]) {
      expect(tags).not.toContain(forbidden);
    }
  });

  it("declares usWeightClass 400 (Regular)", () => {
    const os2 = directory.get("OS/2");
    expect(os2).toBeDefined();
    if (!os2) throw new Error("expected OS/2 table");
    const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
    expect(view.getUint16(os2.offset + 4)).toBe(400);
  });

  it("carries Regular naming, not the variable font's Thin default", () => {
    const nameTable = directory.get("name");
    expect(nameTable).toBeDefined();
    if (!nameTable) throw new Error("expected name table");
    const names = nameStrings(font, nameTable);
    for (const nameId of [1, 4, 6, 17]) {
      expect(names.get(nameId) ?? "").not.toContain("Thin");
    }
    expect(names.get(6)).toBe("NotoSansJP-Regular");
  });

  it("ships a non-empty OFL license file next to the font", () => {
    const license = readFileSync(EMBEDDED_FONT_LICENSE_URL, "utf-8");
    expect(license.length).toBeGreaterThan(0);
    expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });
});

describe("embedded bold font asset", () => {
  const font = new Uint8Array(readFileSync(EMBEDDED_BOLD_FONT_URL));
  const directory = tableDirectory(font);

  it("exposes the recommended logical name", () => {
    expect(EMBEDDED_BOLD_FONT_NAME).toBe("NotoSansJPBold");
  });

  it("is detected as a glyf-outline TTF", () => {
    expect(detectFontFormat(font)).toBe("ttf");
  });

  it("contains glyf and no CFF/CFF2/fvar/gvar tables (static instance)", () => {
    const tags = [...directory.keys()];
    expect(tags).toContain("glyf");
    for (const forbidden of ["CFF ", "CFF2", "fvar", "gvar"]) {
      expect(tags).not.toContain(forbidden);
    }
  });

  it("declares usWeightClass 700 (Bold)", () => {
    const os2 = directory.get("OS/2");
    expect(os2).toBeDefined();
    if (!os2) throw new Error("expected OS/2 table");
    const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
    expect(view.getUint16(os2.offset + 4)).toBe(700);
  });

  it("carries Bold naming", () => {
    const nameTable = directory.get("name");
    expect(nameTable).toBeDefined();
    if (!nameTable) throw new Error("expected name table");
    const names = nameStrings(font, nameTable);
    expect(names.get(6)).toBe("NotoSansJP-Bold");
  });
});
