import type { IrDocument, IrTableElement } from "@denreport/core";
import { describe, expect, it } from "vitest";
import { cellView, tableCellSources } from "./table-cells";

function table(overrides: Partial<IrTableElement> = {}): IrTableElement {
  return {
    type: "table",
    id: "tbl1",
    x: 10,
    y: 10,
    bind: "items",
    columns: [
      { key: "name", label: "品目", width: 40, align: "left" },
      { key: "amount", label: "金額", width: 30, align: "right" },
    ],
    rowHeight: 8,
    headerHeight: 8,
    fontSize: 10,
    maxY: 200,
    continuationY: 10,
    minRows: 0,
    ...overrides,
  };
}

function docOf(
  ...elements: readonly IrDocument["elements"][number][]
): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements,
  };
}

describe("tableCellSources / cellView", () => {
  it("bind 行と上書きを合成する（上書きが優先）", () => {
    const doc = docOf(
      table({ cellOverrides: [{ row: 0, key: "name", value: "固定値" }] }),
    );
    const sampleJson = JSON.stringify({
      items: [
        { name: "item0", amount: "10" },
        { name: "item1", amount: "20" },
      ],
    });
    const sources = tableCellSources(doc, sampleJson);
    const source = sources.get("tbl1");
    if (source === undefined) throw new Error("expected a source");

    expect(cellView(source, 0, "name")).toEqual({
      text: "固定値",
      overridden: true,
    });
    expect(cellView(source, 0, "amount")).toEqual({
      text: "10",
      overridden: false,
    });
    expect(cellView(source, 1, "name")).toEqual({
      text: "item1",
      overridden: false,
    });
  });

  it("bind 行の一部の型が不正でも、他のセルは表示する", () => {
    const doc = docOf(table());
    const sampleJson = JSON.stringify({
      items: [{ name: "item0", amount: 10 }, "not an object"],
    });
    const sources = tableCellSources(doc, sampleJson);
    const source = sources.get("tbl1");
    if (source === undefined) throw new Error("expected a source");

    expect(cellView(source, 0, "name")).toEqual({
      text: "item0",
      overridden: false,
    });
    expect(cellView(source, 0, "amount")).toEqual({
      text: "",
      overridden: false,
    });
    expect(cellView(source, 1, "name")).toEqual({
      text: "",
      overridden: false,
    });
  });

  it("bind が欠落していても上書きだけは表示する", () => {
    const doc = docOf(
      table({ cellOverrides: [{ row: 0, key: "name", value: "仮値" }] }),
    );
    const sources = tableCellSources(doc, "{}");
    const source = sources.get("tbl1");
    if (source === undefined) throw new Error("expected a source");

    expect(cellView(source, 0, "name")).toEqual({
      text: "仮値",
      overridden: true,
    });
    expect(cellView(source, 0, "amount")).toEqual({
      text: "",
      overridden: false,
    });
  });

  it("不正 JSON・空文字列でも空行扱いで例外を投げない", () => {
    const doc = docOf(table());
    expect(() => tableCellSources(doc, "{not json")).not.toThrow();
    expect(() => tableCellSources(doc, "")).not.toThrow();
    const source = tableCellSources(doc, "")?.get("tbl1");
    if (source === undefined) throw new Error("expected a source");
    expect(cellView(source, 0, "name")).toEqual({
      text: "",
      overridden: false,
    });
  });
});
