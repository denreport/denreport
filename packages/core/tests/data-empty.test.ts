import { describe, expect, it } from "vitest";
import { emptyDataFor, validateData } from "../src/ir/data";
import { lowerIr } from "../src/ir/lower";
import type {
  IrBarcodeElement,
  IrDocument,
  IrFlexElement,
  IrTableElement,
  IrTextElement,
} from "../src/ir/types";

function docOf(...elements: IrDocument["elements"]): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { name: "NotoSansJP" },
    elements,
  };
}

function boundText(id: string, key: string): IrTextElement {
  return {
    type: "text",
    id,
    x: 0,
    y: 0,
    pages: "first",
    w: 50,
    h: 10,
    text: `{${key}}`,
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  };
}

function staticText(id: string, text = "静的"): IrTextElement {
  return {
    type: "text",
    id,
    x: 0,
    y: 0,
    pages: "first",
    w: 50,
    h: 10,
    text,
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  };
}

function boundBarcode(id: string, key: string): IrBarcodeElement {
  return {
    type: "barcode",
    id,
    x: 0,
    y: 0,
    pages: "first",
    w: 30,
    h: 30,
    symbology: "qrcode",
    value: `{${key}}`,
  };
}

function table(id: string, bind: string): IrTableElement {
  return {
    type: "table",
    id,
    x: 0,
    y: 0,
    bind,
    columns: [{ key: "name", label: "品目", width: 90, align: "left" }],
    rowHeight: 10,
    headerHeight: 10,
    fontSize: 10,
    maxY: 100,
    continuationY: 0,
    minRows: 3,
  };
}

describe("emptyDataFor", () => {
  it("text 内のトークンを空文字列に補完する", () => {
    expect(emptyDataFor(docOf(boundText("t1", "title")))).toEqual({
      title: "",
    });
  });

  it("table bind を空配列に補完する", () => {
    expect(emptyDataFor(docOf(table("items", "items")))).toEqual({
      items: [],
    });
  });

  it("barcode.value 内のトークンを空文字列に補完する", () => {
    expect(emptyDataFor(docOf(boundBarcode("bc1", "code")))).toEqual({
      code: "",
    });
  });

  it("flex の子の text トークンも収集する", () => {
    const flex: IrFlexElement = {
      type: "flex",
      id: "block",
      x: 0,
      y: 0,
      pages: "first",
      direction: "column",
      gap: 0,
      justifyContent: "start",
      alignItems: "start",
      children: [boundText("nested", "issuerAddr")],
    };
    expect(emptyDataFor(docOf(flex))).toEqual({ issuerAddr: "" });
  });

  it("text と table が同一キーを共有する場合は table を優先する", () => {
    expect(
      emptyDataFor(docOf(boundText("t1", "shared"), table("items", "shared"))),
    ).toEqual({ shared: [] });
  });

  it("静的テキストのみ・table bind なし文書は空オブジェクトになる", () => {
    expect(emptyDataFor(docOf(staticText("t1")))).toEqual({});
    expect(emptyDataFor(docOf())).toEqual({});
  });

  it("text 内の {key} トークンも空文字列に補完する", () => {
    expect(emptyDataFor(docOf(staticText("t1", "合計: {total} 円")))).toEqual({
      total: "",
    });
  });

  it("同一テキスト内の重複トークンキーは1件に集約する", () => {
    expect(emptyDataFor(docOf(staticText("t1", "{a}-{a}")))).toEqual({
      a: "",
    });
  });

  it("トークンキーと table bind が重なる場合は table を優先する", () => {
    expect(
      emptyDataFor(
        docOf(staticText("t1", "{shared}"), table("items", "shared")),
      ),
    ).toEqual({ shared: [] });
  });

  it("合成結果は validateData を空配列で満たす", () => {
    const doc = docOf(
      boundText("t1", "title"),
      staticText("t2", "合計: {total} 円"),
      table("items", "items"),
    );
    expect(validateData(doc, emptyDataFor(doc))).toEqual([]);
  });

  it("minRows の空行に cellOverrides の固定値が出る（雛形モード経路）", () => {
    const withOverride: IrTableElement = {
      ...table("items", "items"),
      cellOverrides: [{ row: 1, key: "name", value: "仮の品目" }],
    };
    const doc = docOf(withOverride);
    const data = emptyDataFor(doc);
    const result = lowerIr(doc, data);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const page = result.document.pages[0] ?? [];
    expect(
      page.some((el) => el.type === "text" && el.content === "仮の品目"),
    ).toBe(true);
  });
});
