import { describe, expect, it } from "vitest";
import { analyzeData, validateData } from "../src/ir/data";
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

  function docWithBoundText(): IrDocument {
    return baseDoc({
      elements: [
        {
          type: "text",
          id: "t1",
          x: 0,
          y: 0,
          pages: "first",
          w: 50,
          h: 10,
          text: "{name}",
          fontSize: 10,
          align: "left",
          lineHeight: 1.25,
        },
      ],
    });
  }

  it("returns en messages for a C01 data error, not mixed with ja", () => {
    const result = lowerIr(docWithBoundText(), { name: 42 }, { locale: "en" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors[0]?.message).toBe(
      'The value for key "name" is not a string',
    );
  });
});

describe("analyzeData / validateData locale", () => {
  function docWithBoundText(): IrDocument {
    return baseDoc({
      elements: [
        {
          type: "text",
          id: "t1",
          x: 0,
          y: 0,
          pages: "first",
          w: 50,
          h: 10,
          text: "{name}",
          fontSize: 10,
          align: "left",
          lineHeight: 1.25,
        },
      ],
    });
  }

  it("defaults to ja when options are omitted", () => {
    const problems = analyzeData(docWithBoundText(), {});
    expect(problems[0]?.message).toBe('データにキー "name" がありません');
  });

  it("returns en messages for locale: en", () => {
    const problems = analyzeData(docWithBoundText(), {}, { locale: "en" });
    expect(problems[0]?.message).toBe('Data has no key "name"');
  });

  it("validateData carries the same locale through to IrError", () => {
    const errors = validateData(docWithBoundText(), {}, { locale: "en" });
    expect(errors[0]?.message).toBe('Data has no key "name"');
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
