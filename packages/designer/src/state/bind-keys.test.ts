import type { IrDocument, IrElement } from "@denreport/core";
import { describe, expect, it } from "vitest";
import { collectBindKeys, sampleDataKeys } from "./bind-keys";

function makeDocument(elements: readonly IrElement[]): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements,
  };
}

function boundText(id: string, key: string): IrElement {
  return {
    type: "text",
    id,
    x: 0,
    y: 0,
    pages: "first",
    w: 10,
    h: 5,
    text: `{${key}}`,
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  };
}

describe("collectBindKeys", () => {
  it("returns text / table / flex descendant binds deduplicated and in lexical order", () => {
    const doc = makeDocument([
      boundText("t1", "customerName"),
      boundText("t2", "customerName"),
      {
        type: "table",
        id: "tbl1",
        x: 0,
        y: 50,
        bind: "items",
        columns: [{ key: "col1", label: "列1", width: 40, align: "left" }],
        rowHeight: 8,
        headerHeight: 8,
        fontSize: 10,
        maxY: 297,
        continuationY: 0,
        minRows: 0,
      },
      {
        type: "flex",
        id: "f1",
        x: 0,
        y: 200,
        pages: "first",
        direction: "column",
        gap: 0,
        justifyContent: "start",
        alignItems: "start",
        children: [
          {
            type: "text",
            id: "c1",
            w: 10,
            h: 5,
            text: "{issuerAddress}",
            fontSize: 10,
            align: "left",
            lineHeight: 1.25,
          },
        ],
      },
    ]);
    expect(collectBindKeys(doc)).toEqual([
      "customerName",
      "issuerAddress",
      "items",
    ]);
  });

  it("excludes empty-string key tokens from candidates", () => {
    expect(collectBindKeys(makeDocument([boundText("t1", "")]))).toEqual([]);
  });

  it("includes {key} tokens inside text as candidates too (no duplicates)", () => {
    const doc = makeDocument([
      {
        type: "text",
        id: "t1",
        x: 0,
        y: 0,
        pages: "first",
        w: 10,
        h: 5,
        text: "合計: {total} 円、{total} 再掲",
        fontSize: 10,
        align: "left",
        lineHeight: 1.25,
      },
      boundText("t2", "customerName"),
    ]);
    expect(collectBindKeys(doc)).toEqual(["customerName", "total"]);
  });

  it("includes {key} tokens inside barcode.value as candidates too", () => {
    const doc = makeDocument([
      {
        type: "barcode",
        id: "bc1",
        x: 0,
        y: 0,
        pages: "first",
        w: 30,
        h: 30,
        symbology: "qrcode",
        value: "{code}",
      },
      boundText("t2", "customerName"),
    ]);
    expect(collectBindKeys(doc)).toEqual(["code", "customerName"]);
  });

  it("is empty for a document with no tokens", () => {
    const doc = makeDocument([
      {
        type: "text",
        id: "t1",
        x: 0,
        y: 0,
        pages: "first",
        w: 10,
        h: 5,
        text: "静的",
        fontSize: 10,
        align: "left",
        lineHeight: 1.25,
      },
    ]);
    expect(collectBindKeys(doc)).toEqual([]);
  });
});

describe("sampleDataKeys", () => {
  it("returns top-level keys in lexical order", () => {
    expect(sampleDataKeys('{"b": 1, "a": {"c": 2}}')).toEqual(["a", "b"]);
  });

  it("returns an empty array when unparsable", () => {
    expect(sampleDataKeys("{oops")).toEqual([]);
    expect(sampleDataKeys("")).toEqual([]);
  });

  it("returns an empty array when the top level is not an object", () => {
    expect(sampleDataKeys("[1, 2]")).toEqual([]);
    expect(sampleDataKeys('"文字列"')).toEqual([]);
    expect(sampleDataKeys("null")).toEqual([]);
  });
});
