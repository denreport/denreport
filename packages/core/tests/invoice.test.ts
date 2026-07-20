import { describe, expect, it } from "vitest";
import { checkQualifiedInvoice } from "../src/ir/invoice";
import type {
  IrDocument,
  IrElement,
  IrFlexChild,
  IrTableCellOverride,
} from "../src/ir/types";

function textElement(id: string, text: string): IrElement {
  return {
    type: "text",
    id,
    x: 0,
    y: 0,
    pages: "first",
    w: 40,
    h: 8,
    text,
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  };
}

function tableElement(
  id: string,
  keys: readonly string[],
  cellOverrides?: readonly IrTableCellOverride[],
): IrElement {
  return {
    type: "table",
    id,
    x: 0,
    y: 0,
    bind: "items",
    columns: keys.map((key) => ({ key, label: key, width: 20, align: "left" })),
    rowHeight: 8,
    headerHeight: 8,
    fontSize: 10,
    maxY: 297,
    continuationY: 0,
    minRows: 0,
    ...(cellOverrides !== undefined ? { cellOverrides } : {}),
  };
}

function flexTextChild(id: string, text: string): IrFlexChild {
  return {
    type: "text",
    id,
    w: 40,
    h: 8,
    text,
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  };
}

function baseDocument(
  elements: readonly IrElement[],
  docType?: "qualifiedInvoice",
): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements,
    ...(docType !== undefined ? { docType } : {}),
  };
}

const ALL_SATISFIED: readonly IrElement[] = [
  textElement("t1", "{registrationNumber}"),
  textElement("t2", "{issueDate}"),
  textElement("t3", "{description}"),
  textElement("t4", "{taxableAmount10}"),
  textElement("t5", "{taxAmount10}"),
  textElement("t6", "{customerName}"),
];

describe("checkQualifiedInvoice", () => {
  it("docType なしなら欠落だらけでも空配列", () => {
    expect(checkQualifiedInvoice(baseDocument([]))).toEqual([]);
  });

  it("docType あり・6項目すべて配置なら空配列", () => {
    expect(
      checkQualifiedInvoice(baseDocument(ALL_SATISFIED, "qualifiedInvoice")),
    ).toEqual([]);
  });

  it("1項目欠落なら Q01 が1件、message に記載事項名を含む", () => {
    const elements = ALL_SATISFIED.filter((el) => el.id !== "t1");
    const result = checkQualifiedInvoice(
      baseDocument(elements, "qualifiedInvoice"),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ rule: "Q01", path: "elements" });
    expect(result[0]?.message).toContain("発行者の登録番号");
  });

  it("全欠落なら項目単位で6件", () => {
    const result = checkQualifiedInvoice(baseDocument([], "qualifiedInvoice"));
    expect(result).toHaveLength(6);
    expect(result.every((error) => error.rule === "Q01")).toBe(true);
  });

  it("table の列キーだけで充足できる", () => {
    const elements = ALL_SATISFIED.filter((el) => el.id !== "t3").concat(
      tableElement("tbl1", ["description"]),
    );
    const result = checkQualifiedInvoice(
      baseDocument(elements, "qualifiedInvoice"),
    );
    expect(result).toEqual([]);
  });

  it("flex 子孫の text トークンで充足できる", () => {
    const flex: IrElement = {
      type: "flex",
      id: "f1",
      x: 0,
      y: 0,
      pages: "first",
      direction: "column",
      gap: 0,
      justifyContent: "start",
      alignItems: "start",
      children: [flexTextChild("c1", "{registrationNumber}")],
    };
    const elements = ALL_SATISFIED.filter((el) => el.id !== "t1").concat(flex);
    const result = checkQualifiedInvoice(
      baseDocument(elements, "qualifiedInvoice"),
    );
    expect(result).toEqual([]);
  });

  it("代替キー taxableAmount10 で項目4が充足できる", () => {
    const elements = ALL_SATISFIED.filter((el) => el.id !== "t4").concat(
      textElement("t4b", "{taxableAmount10}"),
    );
    const result = checkQualifiedInvoice(
      baseDocument(elements, "qualifiedInvoice"),
    );
    expect(result).toEqual([]);
  });

  it("table.bind や cellOverrides の一致では充足しない", () => {
    // bind is the array name of row data, and cellOverrides.value is a fixed display value — neither is a template-slot key
    const table = {
      ...tableElement(
        "tbl1",
        ["itemCode"],
        [{ row: 0, key: "itemCode", value: "description" }],
      ),
      bind: "description",
    };
    const elements = ALL_SATISFIED.filter((el) => el.id !== "t3").concat(table);
    const result = checkQualifiedInvoice(
      baseDocument(elements, "qualifiedInvoice"),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.message).toContain("取引内容");
  });
});
