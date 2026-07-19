import { describe, expect, it } from "vitest";
import { ruleDescription } from "../src/ir/errors";
import { checkQualifiedInvoice } from "../src/ir/invoice";
import { lowerIr } from "../src/ir/lower";
import { parseIr } from "../src/ir/parse";
import type { IrDocument } from "../src/ir/types";

function baseDoc(overrides: Partial<IrDocument> = {}): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements: [],
    ...overrides,
  };
}

describe("parseIr locale", () => {
  it("defaults to ja when options are omitted", () => {
    const result = parseIr("{not json");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors[0]?.message).toBe("入力を JSON として解析できません");
  });

  it("returns ja messages for locale: ja", () => {
    const result = parseIr("{not json", { locale: "ja" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors[0]?.message).toBe("入力を JSON として解析できません");
  });

  it("returns en messages for locale: en", () => {
    const result = parseIr("{not json", { locale: "en" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors[0]?.message).toBe("Could not parse the input as JSON");
  });

  it("translates a parameterized message (S02 missing key)", () => {
    const doc = { version: "1.0", page: {}, elements: [] };
    const result = parseIr(JSON.stringify(doc), { locale: "en" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    const match = result.errors.find(
      (e) => e.rule === "S02" && e.path === "font",
    );
    expect(match?.message).toBe('Missing required key "font"');
  });
});

describe("lowerIr locale", () => {
  function docWithMultiPageTables(): IrDocument {
    const table = (id: string) => ({
      type: "table" as const,
      id,
      x: 0,
      y: 0,
      bind: "items",
      rowHeight: 10,
      headerHeight: 10,
      fontSize: 10,
      maxY: 20,
      continuationY: 0,
      minRows: 3,
      columns: [
        { key: "name", label: "Name", width: 40, align: "left" as const },
      ],
    });
    return baseDoc({ elements: [table("a"), table("b")] });
  }

  it("defaults to ja when options are omitted", () => {
    const result = lowerIr(docWithMultiPageTables(), { items: [] });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors[0]?.message).toBe(
      "2ページ以上に展開される表が複数あります",
    );
  });

  it("returns en messages for locale: en", () => {
    const result = lowerIr(
      docWithMultiPageTables(),
      { items: [] },
      { locale: "en" },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors[0]?.message).toBe(
      "More than one table expands across 2 or more pages",
    );
  });
});

describe("checkQualifiedInvoice locale", () => {
  function invoiceDoc(): IrDocument {
    return baseDoc({ docType: "qualifiedInvoice", elements: [] });
  }

  it("defaults to ja when options are omitted", () => {
    const errors = checkQualifiedInvoice(invoiceDoc());
    expect(errors[0]?.message).toContain("発行者の登録番号");
  });

  it("returns en messages for locale: en", () => {
    const errors = checkQualifiedInvoice(invoiceDoc(), { locale: "en" });
    expect(errors[0]?.message).toContain("Issuer's registration number");
  });
});

describe("ruleDescription", () => {
  it("defaults to ja when options are omitted", () => {
    expect(ruleDescription("M02")).toBe("全要素が用紙内に収まる");
  });

  it("returns en for locale: en", () => {
    expect(ruleDescription("M02", { locale: "en" })).toBe(
      "Every element fits within the page",
    );
  });
});
