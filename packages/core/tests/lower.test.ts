import { describe, expect, it } from "vitest";
import { PAGE_COUNT_MAX } from "../src/ir/constants";
import type { IrData } from "../src/ir/data";
import type { IrRuleId } from "../src/ir/errors";
import type { LoweredElement } from "../src/ir/lower";
import { lowerIr } from "../src/ir/lower";
import type {
  IrBarcodeElement,
  IrColumn,
  IrDocument,
  IrElement,
  IrEllipseElement,
  IrFlexChild,
  IrFlexElement,
  IrImageElement,
  IrLineElement,
  IrPageNumberElement,
  IrRectElement,
  IrTableElement,
  IrTextElement,
} from "../src/ir/types";

const COLUMNS: readonly IrColumn[] = [
  { key: "name", label: "品目", width: 90, align: "left" },
  { key: "amount", label: "金額", width: 35, align: "right" },
];

function staticText(overrides: Partial<IrTextElement> = {}): IrTextElement {
  return {
    type: "text",
    id: "t1",
    x: 0,
    y: 0,
    pages: "first",
    w: 50,
    h: 10,
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
    text: "hello",
    ...overrides,
  } as IrTextElement;
}

function boundText(
  key: string,
  overrides: Partial<IrTextElement> = {},
): IrTextElement {
  return {
    type: "text",
    id: "t1",
    x: 0,
    y: 0,
    pages: "first",
    w: 50,
    h: 10,
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
    text: `{${key}}`,
    ...overrides,
  } as IrTextElement;
}

function boundTextChild(
  key: string,
  overrides: Partial<IrTextElement> = {},
): IrFlexChild {
  return {
    type: "text",
    id: "c1",
    w: 50,
    h: 10,
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
    text: `{${key}}`,
    ...overrides,
  } as IrFlexChild;
}

function line(overrides: Partial<IrLineElement> = {}): IrLineElement {
  return {
    type: "line",
    id: "l1",
    x: 0,
    y: 0,
    pages: "first",
    orientation: "horizontal",
    length: 50,
    thickness: 0.3,
    ...overrides,
  };
}

function rect(overrides: Partial<IrRectElement> = {}): IrRectElement {
  return {
    type: "rect",
    id: "r1",
    x: 0,
    y: 0,
    pages: "first",
    w: 20,
    h: 10,
    borderWidth: 0.3,
    ...overrides,
  };
}

function ellipse(overrides: Partial<IrEllipseElement> = {}): IrEllipseElement {
  return {
    type: "ellipse",
    id: "el1",
    x: 0,
    y: 0,
    pages: "first",
    w: 30,
    h: 20,
    borderWidth: 0.3,
    ...overrides,
  };
}

function image(overrides: Partial<IrImageElement> = {}): IrImageElement {
  return {
    type: "image",
    id: "img1",
    x: 0,
    y: 0,
    pages: "first",
    w: 20,
    h: 20,
    src: "data:image/png;base64,AAAA",
    ...overrides,
  };
}

function barcode(overrides: Partial<IrBarcodeElement> = {}): IrBarcodeElement {
  return {
    type: "barcode",
    id: "bc1",
    x: 0,
    y: 0,
    pages: "first",
    w: 30,
    h: 30,
    symbology: "qrcode",
    value: "abc",
    ...overrides,
  };
}

function pageNumber(
  overrides: Partial<IrPageNumberElement> = {},
): IrPageNumberElement {
  return {
    type: "pageNumber",
    id: "pn1",
    x: 0,
    y: 285,
    pages: "all",
    w: 210,
    h: 6,
    format: "{n} / {N}",
    fontSize: 9,
    align: "center",
    lineHeight: 1.25,
    ...overrides,
  };
}

function table(overrides: Partial<IrTableElement> = {}): IrTableElement {
  return {
    type: "table",
    id: "items",
    x: 15,
    y: 0,
    bind: "items",
    columns: COLUMNS,
    rowHeight: 10,
    headerHeight: 10,
    fontSize: 10,
    maxY: 100,
    continuationY: 0,
    minRows: 0,
    ...overrides,
  };
}

function flex(overrides: Partial<IrFlexElement> = {}): IrFlexElement {
  return {
    type: "flex",
    id: "f1",
    x: 10,
    y: 10,
    pages: "first",
    direction: "column",
    gap: 0,
    justifyContent: "start",
    alignItems: "start",
    children: [],
    ...overrides,
  };
}

function docOf(...elements: readonly IrElement[]): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements,
  };
}

function rowsOf(n: number): Record<string, string>[] {
  return Array.from({ length: n }, (_, i) => ({
    name: `item${i}`,
    amount: `${i}`,
  }));
}

function rulesOf(errors: readonly { rule: IrRuleId }[]): IrRuleId[] {
  return errors.map((e) => e.rule);
}

describe("lowerIr — C01", () => {
  it("treats a missing bind key as a warning and renders empty content", () => {
    const doc = docOf(staticText(), boundText("title", { id: "t2" }));
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.warnings).toEqual([
      { rule: "C01", path: "elements[1].text", message: expect.any(String) },
    ]);
    const t2 = result.document.pages[0]?.find((el) => el.sourceId === "t2");
    expect(t2).toMatchObject({ content: "" });
  });

  it("reports a non-string bind value as a hard error", () => {
    const doc = docOf(boundText("title"));
    const result = lowerIr(doc, { title: 123 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors).toEqual([
      { rule: "C01", path: "elements[0].text", message: expect.any(String) },
    ]);
  });

  it("treats a missing flex descendant bind key as a warning with a children path", () => {
    const doc = docOf(flex({ children: [boundTextChild("addr")] }));
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.warnings).toEqual([
      {
        rule: "C01",
        path: "elements[0].children[0].text",
        message: expect.any(String),
      },
    ]);
  });

  it("passes with no warnings when every bind key resolves to a string", () => {
    const doc = docOf(boundText("title"));
    const result = lowerIr(doc, { title: "請求書" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.warnings).toEqual([]);
  });

  it("treats a missing barcode value key as a warning and renders empty content", () => {
    const doc = docOf(barcode({ value: "{code}" }));
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.warnings).toEqual([
      { rule: "C01", path: "elements[0].value", message: expect.any(String) },
    ]);
    expect(result.document.pages[0]?.[0]).toMatchObject({ content: "" });
  });

  it("reports a non-string barcode value token as a hard error", () => {
    const doc = docOf(barcode({ value: "{code}" }));
    const result = lowerIr(doc, { code: 123 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors).toEqual([
      { rule: "C01", path: "elements[0].value", message: expect.any(String) },
    ]);
  });
});

describe("lowerIr — text token interpolation", () => {
  it("substitutes a {key} token from data", () => {
    const doc = docOf(staticText({ text: "合計: {total} 円" }));
    const result = lowerIr(doc, { total: "12,000" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.document.pages[0]?.[0]).toMatchObject({
      content: "合計: 12,000 円",
    });
  });

  it("treats a missing token key as a warning and renders an empty substitution", () => {
    const doc = docOf(staticText({ text: "合計: {total} 円" }));
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.warnings).toEqual([
      { rule: "C01", path: "elements[0].text", message: expect.any(String) },
    ]);
    expect(result.document.pages[0]?.[0]).toMatchObject({
      content: "合計:  円",
    });
  });

  it("reports a non-string token value as a hard error", () => {
    const doc = docOf(staticText({ text: "{total}" }));
    const result = lowerIr(doc, { total: 12000 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors).toEqual([
      { rule: "C01", path: "elements[0].text", message: expect.any(String) },
    ]);
  });
});

describe("lowerIr — footnotes", () => {
  it("replaces marks with *n and appends the note block, including data interpolation in note text", () => {
    const doc: IrDocument = {
      ...docOf(staticText({ text: "税抜{#tax}価格" })),
      footnotes: {
        x: 15,
        w: 180,
        bottom: 10,
        fontSize: 8,
        lineHeight: 1.25,
        pages: "all",
        notes: [{ id: "tax", text: "税率は{rate}%です" }],
      },
    };
    const result = lowerIr(doc, { rate: "10" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const page = result.document.pages[0] ?? [];
    expect(page[0]).toMatchObject({ content: "税抜*1価格" });
    expect(page[1]).toMatchObject({ content: "*1 税率は10%です" });
  });

  it("places a footnotes.pages: last block only on the final page", () => {
    const doc: IrDocument = {
      ...docOf(
        staticText({ text: "{#a}" }),
        table({ maxY: 100, headerHeight: 10, rowHeight: 10, continuationY: 0 }),
      ),
      footnotes: {
        x: 15,
        w: 180,
        bottom: 10,
        fontSize: 8,
        lineHeight: 1.25,
        pages: "last",
        notes: [{ id: "a", text: "本文" }],
      },
    };
    const result = lowerIr(doc, { items: rowsOf(10) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.document.pageCount).toBe(2);
    const isNoteBlock = (el: { sourceId: string }): boolean =>
      el.sourceId === "apxFootnotes";
    expect(result.document.pages[0]?.some(isNoteBlock)).toBe(false);
    expect(result.document.pages[1]?.some(isNoteBlock)).toBe(true);
  });
});

describe("lowerIr — C02", () => {
  it("treats a missing table bind key as a warning and renders minRows empty rows", () => {
    const doc = docOf(table({ minRows: 2 }));
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.warnings).toEqual([
      { rule: "C02", path: "elements[0].bind", message: expect.any(String) },
    ]);
    const page = result.document.pages[0] ?? [];
    const cellTexts = page.filter(
      (el) =>
        el.type === "text" && el.content !== "品目" && el.content !== "金額",
    );
    expect(cellTexts).toEqual([]);
    const lines = page.filter(
      (el): el is Extract<typeof el, { type: "line" }> => el.type === "line",
    );
    expect(lines.filter((l) => l.orientation === "horizontal")).toHaveLength(2);
  });

  it("reports a non-array table bind value", () => {
    const doc = docOf(table());
    const result = lowerIr(doc, { items: "not an array" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors).toEqual([
      { rule: "C02", path: "elements[0].bind", message: expect.any(String) },
    ]);
  });

  it("reports the row number for a non-object row and a missing column key", () => {
    const doc = docOf(table());
    const data: IrData = {
      items: [{ name: "foo", amount: "1" }, "not an object", { name: "bar" }],
    };
    const result = lowerIr(doc, data);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors).toHaveLength(2);
    for (const e of result.errors) {
      expect(e.rule).toBe("C02");
      expect(e.path).toBe("elements[0].bind");
    }
    expect(result.errors[0]?.message).toContain("1");
    expect(result.errors[1]?.message).toContain("2");
    expect(result.errors[1]?.message).toContain("amount");
  });

  it("excludes an invalid table from page-count computation while still applying C03/C04 to valid tables", () => {
    const doc = docOf(
      table({ id: "broken", bind: "broken" }),
      table({ id: "valid", bind: "items" }),
    );
    const result = lowerIr(doc, {
      broken: "not an array",
      items: rowsOf(3),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(rulesOf(result.errors)).toEqual(["C02"]);
  });
});

describe("lowerIr — shared bind key between text and table", () => {
  it("renders empty content instead of a non-string value when a missing key is shared", () => {
    const doc = docOf(boundText("items"), table({ bind: "items" }));
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const t1 = result.document.pages[0]?.find((el) => el.sourceId === "t1");
    expect(t1).toMatchObject({ content: "" });
  });
});

describe("lowerIr — C03", () => {
  function multiPageTable(id: string): IrTableElement {
    // headerHeight=10, rowHeight=10, maxY=100 → kFirst=kCont=9. m=10 → P=2
    return table({
      id,
      minRows: 10,
      maxY: 100,
      headerHeight: 10,
      rowHeight: 10,
    });
  }
  const data: IrData = { items: rowsOf(10) };

  it("reports the second and later multi-page tables in document order", () => {
    const doc = docOf(
      multiPageTable("t1"),
      multiPageTable("t2"),
      multiPageTable("t3"),
    );
    const result = lowerIr(doc, data);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    const c03 = result.errors.filter((e) => e.rule === "C03");
    expect(c03.map((e) => e.path)).toEqual(["elements[1]", "elements[2]"]);
  });

  it("allows a single multi-page table", () => {
    const doc = docOf(multiPageTable("t1"));
    const result = lowerIr(doc, data);
    expect(result.ok).toBe(true);
  });
});

describe("lowerIr — C04", () => {
  it("rejects a document whose expanded page count exceeds the limit", () => {
    // headerHeight=1, rowHeight=1, maxY=2 → kFirst=kCont=1. m=PAGE_COUNT_MAX+3 → P > PAGE_COUNT_MAX
    const doc = docOf(
      table({
        headerHeight: 1,
        rowHeight: 1,
        maxY: 2,
        continuationY: 0,
        minRows: PAGE_COUNT_MAX + 3,
      }),
    );
    const result = lowerIr(doc, { items: [] });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.rule).toBe("C04");
    expect(result.errors[0]?.path).toBe("");
    expect(result.errors[0]?.message).toContain(String(PAGE_COUNT_MAX));
  });

  it("accepts a document exactly at the limit", () => {
    const doc = docOf(
      table({
        headerHeight: 1,
        rowHeight: 1,
        maxY: 2,
        continuationY: 0,
        minRows: PAGE_COUNT_MAX,
      }),
    );
    const result = lowerIr(doc, { items: [] });
    expect(result.ok).toBe(true);
  });
});

it("keeps only hard errors across rule groups in a single pass (missing bind is a warning, not an error)", () => {
  const doc = docOf(
    boundText("missing"),
    table({
      id: "t1",
      minRows: 10,
      maxY: 100,
      headerHeight: 10,
      rowHeight: 10,
    }),
    table({
      id: "t2",
      minRows: 10,
      maxY: 100,
      headerHeight: 10,
      rowHeight: 10,
    }),
  );
  const result = lowerIr(doc, { items: rowsOf(10) });
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected failure");
  expect(rulesOf(result.errors).sort()).toEqual(["C03"]);
});

describe("lowerIr — page count and split boundaries", () => {
  it("uses P = 1 when the display row count fits the first page exactly", () => {
    // kFirst = floor((100-0-10)/10) = 9
    const doc = docOf(table({ maxY: 100, headerHeight: 10, rowHeight: 10 }));
    const result = lowerIr(doc, { items: rowsOf(9) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.document.pageCount).toBe(1);
  });

  it("splits into a second page for one row over capacity", () => {
    const doc = docOf(
      table({ maxY: 100, headerHeight: 10, rowHeight: 10, continuationY: 0 }),
    );
    const result = lowerIr(doc, { items: rowsOf(10) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.document.pageCount).toBe(2);
  });

  it("floors non-exact row capacity", () => {
    // kFirst = floor((95-0-10)/10) = floor(8.5) = 8
    const doc = docOf(table({ maxY: 95, headerHeight: 10, rowHeight: 10 }));
    const withCapacity = lowerIr(doc, { items: rowsOf(8) });
    const overCapacity = lowerIr(doc, { items: rowsOf(9) });
    expect(withCapacity.ok && withCapacity.document.pageCount).toBe(1);
    expect(overCapacity.ok && overCapacity.document.pageCount).toBe(2);
  });

  it("uses P = 1 for a header-only table when there are no rows", () => {
    const doc = docOf(table({ maxY: 100, headerHeight: 10, rowHeight: 10 }));
    const result = lowerIr(doc, { items: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.document.pageCount).toBe(1);
    expect(result.document.pages[0]).toEqual([
      expect.objectContaining({ type: "rect" }),
      ...Array.from({ length: 1 }, () =>
        expect.objectContaining({ type: "line" }),
      ),
      expect.objectContaining({ type: "text", content: "品目" }),
      expect.objectContaining({ type: "text", content: "金額" }),
    ]);
  });

  it("uses N = 1 for a document without any table", () => {
    const doc = docOf(staticText());
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.document.pageCount).toBe(1);
  });

  it("computes multi-page splits across three pages", () => {
    // kFirst = floor((100-0-10)/10) = 9, kCont = floor((100-20-10)/10) = 7
    // m=20 → P = 1 + ceil((20-9)/7) = 1 + 2 = 3
    const doc = docOf(
      table({
        maxY: 100,
        headerHeight: 10,
        rowHeight: 10,
        continuationY: 20,
      }),
    );
    const result = lowerIr(doc, { items: rowsOf(20) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.document.pageCount).toBe(3);
  });
});

describe("lowerIr — page assignment", () => {
  function countHorizontalLines(
    page: readonly { type: string; orientation?: string }[],
  ): number {
    return page.filter(
      (el) => el.type === "line" && el.orientation === "horizontal",
    ).length;
  }

  it("degenerates rest to no output and last to page 1 when N = 1", () => {
    const doc = docOf(
      staticText({ id: "onFirst", pages: "first", text: "first" }),
      staticText({ id: "onRest", pages: "rest", text: "rest" }),
      staticText({ id: "onLast", pages: "last", text: "last" }),
      staticText({ id: "onAll", pages: "all", text: "all" }),
    );
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.document.pageCount).toBe(1);
    const ids = result.document.pages[0]?.map((el) => el.sourceId);
    expect(ids).toEqual(["onFirst", "onLast", "onAll"]);
  });

  it("places first/rest/last/all correctly across multiple pages", () => {
    const doc = docOf(
      staticText({ id: "onFirst", pages: "first", text: "first" }),
      staticText({ id: "onRest", pages: "rest", text: "rest" }),
      staticText({ id: "onLast", pages: "last", text: "last" }),
      staticText({ id: "onAll", pages: "all", text: "all" }),
      table({ maxY: 100, headerHeight: 10, rowHeight: 10, continuationY: 0 }),
    );
    const result = lowerIr(doc, { items: rowsOf(10) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.document.pageCount).toBe(2);
    const page1Ids = result.document.pages[0]?.map((el) => el.sourceId) ?? [];
    const page2Ids = result.document.pages[1]?.map((el) => el.sourceId) ?? [];
    expect(page1Ids).toContain("onFirst");
    expect(page1Ids).not.toContain("onRest");
    expect(page1Ids).not.toContain("onLast");
    expect(page1Ids).toContain("onAll");
    expect(page2Ids).not.toContain("onFirst");
    expect(page2Ids).toContain("onRest");
    expect(page2Ids).toContain("onLast");
    expect(page2Ids).toContain("onAll");
  });

  it("places the table chunk p on page p", () => {
    const doc = docOf(
      table({ maxY: 100, headerHeight: 10, rowHeight: 10, continuationY: 0 }),
    );
    const result = lowerIr(doc, { items: rowsOf(10) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(countHorizontalLines(result.document.pages[0] ?? [])).toBe(9);
    expect(countHorizontalLines(result.document.pages[1] ?? [])).toBe(1);
  });
});

describe("lowerIr — chunk geometry", () => {
  it("re-displays the header and starts the continuation chunk at continuationY", () => {
    const doc = docOf(
      table({ maxY: 100, headerHeight: 10, rowHeight: 10, continuationY: 40 }),
    );
    const result = lowerIr(doc, { items: rowsOf(10) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const page2Headers = (result.document.pages[1] ?? []).filter(
      (el) => el.type === "text" && el.content === "品目",
    );
    expect(page2Headers).toHaveLength(1);
    expect(page2Headers[0]).toMatchObject({ y: 40 + 1.8 });
  });

  it("omits cell text for empty rows but still draws frame and lines", () => {
    const doc = docOf(
      table({ maxY: 100, headerHeight: 10, rowHeight: 10, minRows: 3 }),
    );
    const result = lowerIr(doc, { items: rowsOf(1) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const page = result.document.pages[0] ?? [];
    const cellTexts = page.filter(
      (el) =>
        el.type === "text" && el.content !== "品目" && el.content !== "金額",
    );
    expect(cellTexts).toHaveLength(2); // 1 row × 2 columns
    const lines = page.filter(
      (el): el is Extract<typeof el, { type: "line" }> => el.type === "line",
    );
    expect(lines.filter((l) => l.orientation === "horizontal")).toHaveLength(3); // 3 rows
    expect(lines.filter((l) => l.orientation === "vertical")).toHaveLength(1); // 2 columns
  });

  it("places columns at the expected X offsets and cell text geometry", () => {
    const doc = docOf(
      table({ x: 15, maxY: 100, headerHeight: 10, rowHeight: 10 }),
    );
    const result = lowerIr(doc, { items: rowsOf(1) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const page = result.document.pages[0] ?? [];
    const verticalLines = page.filter(
      (el): el is Extract<typeof el, { type: "line" }> =>
        el.type === "line" && el.orientation === "vertical",
    );
    expect(verticalLines).toHaveLength(1);
    expect(verticalLines[0]?.x).toBe(15 + 90);

    const dataCell = page.find(
      (el) => el.type === "text" && el.content === "item0",
    );
    expect(dataCell).toMatchObject({
      x: 15 + 1.5,
      w: 90 - 2 * 1.5,
      h: 10 - 2.0,
      y: 0 + 10 + 0 * 10 + 2.0,
      align: "left",
    });
  });

  it("draws frame, then horizontal lines, then vertical lines, then header cells, then data cells", () => {
    const doc = docOf(table({ maxY: 100, headerHeight: 10, rowHeight: 10 }));
    const result = lowerIr(doc, { items: rowsOf(2) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const types = (result.document.pages[0] ?? []).map((el) =>
      el.type === "line" ? `line:${el.orientation}` : el.type,
    );
    expect(types).toEqual([
      "rect",
      "line:horizontal",
      "line:horizontal",
      "line:vertical",
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
    ]);
  });
});

describe("lowerIr — cellOverrides", () => {
  it("overrides a bound cell's content", () => {
    const doc = docOf(
      table({
        maxY: 100,
        headerHeight: 10,
        rowHeight: 10,
        cellOverrides: [{ row: 0, key: "name", value: "固定値" }],
      }),
    );
    const result = lowerIr(doc, { items: rowsOf(2) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const page = result.document.pages[0] ?? [];
    expect(
      page.some((el) => el.type === "text" && el.content === "item0"),
    ).toBe(false);
    expect(
      page.some((el) => el.type === "text" && el.content === "固定値"),
    ).toBe(true);
  });

  it("fills only the overridden column for a row beyond the bound data (other columns stay empty)", () => {
    const doc = docOf(
      table({
        maxY: 100,
        headerHeight: 10,
        rowHeight: 10,
        minRows: 3,
        cellOverrides: [{ row: 2, key: "name", value: "仮値" }],
      }),
    );
    const result = lowerIr(doc, { items: rowsOf(1) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const page = result.document.pages[0] ?? [];
    const overriddenCell = page.find(
      (el) => el.type === "text" && el.content === "仮値",
    );
    expect(overriddenCell).toMatchObject({
      y: 0 + 10 + 2 * 10 + 2.0,
    });
    const emptyNeighbor = page.find(
      (el) =>
        el.type === "text" &&
        el.content === "" &&
        el.y === 0 + 10 + 2 * 10 + 2.0,
    );
    expect(emptyNeighbor).toBeDefined();
  });

  it("keeps an override inactive (no effect on output or page count) once its row is beyond max(bind rows, minRows)", () => {
    const withOverride = docOf(
      table({
        maxY: 100,
        headerHeight: 10,
        rowHeight: 10,
        minRows: 2,
        cellOverrides: [{ row: 5, key: "name", value: "届かない値" }],
      }),
    );
    const withoutOverride = docOf(
      table({ maxY: 100, headerHeight: 10, rowHeight: 10, minRows: 2 }),
    );
    const data: IrData = { items: rowsOf(1) };
    const resultWith = lowerIr(withOverride, data);
    const resultWithout = lowerIr(withoutOverride, data);
    expect(resultWith.ok).toBe(true);
    expect(resultWithout.ok).toBe(true);
    if (!resultWith.ok || !resultWithout.ok)
      throw new Error("expected success");
    expect(
      resultWith.document.pages[0]?.some(
        (el) => el.type === "text" && el.content === "届かない値",
      ),
    ).toBe(false);
    expect(resultWith.document.pageCount).toBe(
      resultWithout.document.pageCount,
    );
  });

  it("applies an override whose row lands on a continuation-page chunk", () => {
    // headerHeight=10, rowHeight=10, maxY=100 → kFirst=9, kCont(continuationY=40)=5. row 10 は2ページ目
    const doc = docOf(
      table({
        maxY: 100,
        headerHeight: 10,
        rowHeight: 10,
        continuationY: 40,
        minRows: 12,
        cellOverrides: [{ row: 10, key: "name", value: "継続ページの値" }],
      }),
    );
    const result = lowerIr(doc, { items: rowsOf(9) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(
      (result.document.pages[1] ?? []).some(
        (el) => el.type === "text" && el.content === "継続ページの値",
      ),
    ).toBe(true);
  });

  it("produces a deeply equal result to a document without cellOverrides (regression)", () => {
    const withAttribute = docOf(
      table({ maxY: 100, headerHeight: 10, rowHeight: 10, cellOverrides: [] }),
    );
    const without = docOf(
      table({ maxY: 100, headerHeight: 10, rowHeight: 10 }),
    );
    const data: IrData = { items: rowsOf(2) };
    expect(lowerIr(withAttribute, data)).toEqual(lowerIr(without, data));
  });

  it("applies an override into the minRows empty rows produced by a missing table bind key, alongside the C02 warning", () => {
    const doc = docOf(
      table({
        maxY: 100,
        headerHeight: 10,
        rowHeight: 10,
        minRows: 2,
        cellOverrides: [{ row: 1, key: "name", value: "仮値" }],
      }),
    );
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.warnings).toEqual([
      { rule: "C02", path: "elements[0].bind", message: expect.any(String) },
    ]);
    const page = result.document.pages[0] ?? [];
    const cellTexts = page.filter(
      (el) =>
        el.type === "text" && el.content !== "品目" && el.content !== "金額",
    );
    expect(
      cellTexts.filter((el) => el.type === "text" && el.content !== ""),
    ).toEqual([expect.objectContaining({ content: "仮値" })]);
  });
});

describe("lowerIr — pageNumber", () => {
  it("replaces {n} and {N} and keeps other characters literal", () => {
    const doc = docOf(
      pageNumber({ format: "page {n} of {N} — {x}" }),
      table({ maxY: 100, headerHeight: 10, rowHeight: 10, continuationY: 0 }),
    );
    const result = lowerIr(doc, { items: rowsOf(10) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const page1 = result.document.pages[0]?.find((el) => el.sourceId === "pn1");
    const page2 = result.document.pages[1]?.find((el) => el.sourceId === "pn1");
    expect(page1).toMatchObject({ content: "page 1 of 2 — {x}" });
    expect(page2).toMatchObject({ content: "page 2 of 2 — {x}" });
  });
});

describe("lowerIr — text/pageNumber color", () => {
  it("defaults text and pageNumber color to black", () => {
    const doc = docOf(staticText(), pageNumber());
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const [text, pn] = result.document.pages[0] ?? [];
    expect(text).toMatchObject({ color: "#000000" });
    expect(pn).toMatchObject({ color: "#000000" });
  });

  it("resolves explicit text and pageNumber color", () => {
    const doc = docOf(
      staticText({ color: "#ff0000" }),
      pageNumber({ color: "#00ff00" }),
    );
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const [text, pn] = result.document.pages[0] ?? [];
    expect(text).toMatchObject({ color: "#ff0000" });
    expect(pn).toMatchObject({ color: "#00ff00" });
  });

  it("keeps table header/cell text black regardless of surrounding elements", () => {
    const doc = docOf(table({ maxY: 100 }));
    const result = lowerIr(doc, { items: rowsOf(1) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const texts = (result.document.pages[0] ?? []).filter(
      (el): el is Extract<LoweredElement, { type: "text" }> =>
        el.type === "text",
    );
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) {
      expect(text.color).toBe("#000000");
    }
  });
});

describe("lowerIr — text font style attributes", () => {
  it("defaults fontWeight/fontStyle/underline to normal/normal/false", () => {
    const doc = docOf(staticText(), pageNumber());
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const [text, pn] = result.document.pages[0] ?? [];
    expect(text).toMatchObject({
      fontWeight: "normal",
      fontStyle: "normal",
      underline: false,
    });
    expect(pn).toMatchObject({
      fontWeight: "normal",
      fontStyle: "normal",
      underline: false,
    });
  });

  it("resolves explicit fontWeight/fontStyle/underline to concrete values", () => {
    const doc = docOf(
      staticText({ fontWeight: "bold", fontStyle: "italic", underline: true }),
    );
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.document.pages[0]?.[0]).toMatchObject({
      fontWeight: "bold",
      fontStyle: "italic",
      underline: true,
    });
  });

  it("resolves the attributes on a named-style-referencing element from its concrete values", () => {
    const doc: IrDocument = {
      ...docOf(
        staticText({ style: "強調", fontWeight: "bold", underline: true }),
      ),
      styles: [
        { name: "強調", attrs: { fontWeight: "bold", underline: true } },
      ],
    };
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.document.pages[0]?.[0]).toMatchObject({
      fontWeight: "bold",
      fontStyle: "normal",
      underline: true,
    });
  });

  it("keeps table header/cell text at normal weight and style", () => {
    const doc = docOf(table({ maxY: 100 }));
    const result = lowerIr(doc, { items: rowsOf(1) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const texts = (result.document.pages[0] ?? []).filter(
      (el): el is Extract<LoweredElement, { type: "text" }> =>
        el.type === "text",
    );
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) {
      expect(text).toMatchObject({
        fontWeight: "normal",
        fontStyle: "normal",
        underline: false,
      });
    }
  });
});

describe("lowerIr — invariants", () => {
  it("keeps pageCount consistent with pages.length", () => {
    const doc = docOf(staticText());
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.document.pages).toHaveLength(result.document.pageCount);
  });

  it("preserves the elements array order, including table chunk position", () => {
    const doc = docOf(
      staticText({ id: "before", text: "before" }),
      table({ maxY: 100, headerHeight: 10, rowHeight: 10 }),
      staticText({ id: "after", text: "after" }),
    );
    const result = lowerIr(doc, { items: rowsOf(1) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const sourceIds = result.document.pages[0]?.map((el) => el.sourceId);
    expect(sourceIds?.[0]).toBe("before");
    expect(sourceIds?.at(-1)).toBe("after");
  });

  it("reflects resolveFlex geometry for a flex child", () => {
    const doc = docOf(
      flex({
        x: 10,
        y: 20,
        direction: "column",
        gap: 2,
        children: [
          {
            type: "text",
            id: "c1",
            text: "a",
            w: 30,
            h: 5,
            fontSize: 10,
            align: "left",
            lineHeight: 1.25,
          },
          {
            type: "text",
            id: "c2",
            text: "b",
            w: 30,
            h: 5,
            fontSize: 10,
            align: "left",
            lineHeight: 1.25,
          },
        ],
      }),
    );
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const page = result.document.pages[0] ?? [];
    expect(page.find((el) => el.sourceId === "c1")).toMatchObject({
      x: 10,
      y: 20,
    });
    expect(page.find((el) => el.sourceId === "c2")).toMatchObject({
      x: 10,
      y: 27,
    });
  });

  it("uses the source element id as sourceId, not the flex container id", () => {
    const doc = docOf(
      flex({
        children: [
          {
            type: "text",
            id: "child",
            text: "a",
            w: 30,
            h: 5,
            fontSize: 10,
            align: "left",
            lineHeight: 1.25,
          },
        ],
      }),
    );
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const sourceIds = result.document.pages[0]?.map((el) => el.sourceId);
    expect(sourceIds).toEqual(["child"]);
  });
});

describe("lowerIr — other basic element lowering", () => {
  it("lowers line, rect and image elements verbatim", () => {
    const doc = docOf(
      line({ id: "ln", orientation: "vertical", length: 20, thickness: 0.5 }),
      rect({ id: "rc", w: 30, h: 15, borderWidth: 0.6 }),
      image({ id: "im", w: 10, h: 10, src: "data:image/png;base64,AAAA" }),
    );
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const [ln, rc, im] = result.document.pages[0] ?? [];
    expect(ln).toEqual({
      type: "line",
      sourceId: "ln",
      x: 0,
      y: 0,
      orientation: "vertical",
      length: 20,
      thickness: 0.5,
      color: "#000000",
      strokeStyle: "solid",
      rotate: 0,
    });
    expect(rc).toEqual({
      type: "rect",
      sourceId: "rc",
      x: 0,
      y: 0,
      w: 30,
      h: 15,
      borderWidth: 0.6,
      borderColor: "#000000",
      fillColor: null,
      borderStyle: "solid",
      cornerRadius: 0,
      rotate: 0,
    });
    expect(im).toEqual({
      type: "image",
      sourceId: "im",
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      src: "data:image/png;base64,AAAA",
      rotate: 0,
    });
  });

  it("lowers a barcode element, resolving its token value into content", () => {
    const doc = docOf(
      barcode({ id: "bc1", symbology: "ean13", value: "{code}" }),
    );
    const result = lowerIr(doc, { code: "4912345678904" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.document.pages[0]?.[0]).toEqual({
      type: "barcode",
      sourceId: "bc1",
      x: 0,
      y: 0,
      w: 30,
      h: 30,
      symbology: "ean13",
      content: "4912345678904",
      rotate: 0,
    });
  });

  it("lowers an ellipse with resolved default style", () => {
    const doc = docOf(ellipse({ id: "el", w: 30, h: 20, borderWidth: 0.5 }));
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.document.pages[0]?.[0]).toEqual({
      type: "ellipse",
      sourceId: "el",
      x: 0,
      y: 0,
      w: 30,
      h: 20,
      borderWidth: 0.5,
      borderColor: "#000000",
      fillColor: null,
      rotate: 0,
    });
  });

  it("lowers an ellipse with explicit colors", () => {
    const doc = docOf(
      ellipse({
        id: "el",
        borderColor: "#123456",
        fillColor: "#abcdef",
      }),
    );
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.document.pages[0]?.[0]).toMatchObject({
      borderColor: "#123456",
      fillColor: "#abcdef",
    });
  });

  it("resolves explicit line and rect style attributes", () => {
    const doc = docOf(
      line({ id: "ln", color: "#ff0000", strokeStyle: "dashed" }),
      rect({
        id: "rc",
        borderColor: "#00ff00",
        fillColor: "#0000ff",
        borderStyle: "dotted",
        cornerRadius: 3,
      }),
    );
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const [ln, rc] = result.document.pages[0] ?? [];
    expect(ln).toMatchObject({ color: "#ff0000", strokeStyle: "dashed" });
    expect(rc).toMatchObject({
      borderColor: "#00ff00",
      fillColor: "#0000ff",
      borderStyle: "dotted",
      cornerRadius: 3,
    });
  });
});

describe("lowerIr — rotate resolution", () => {
  it("resolves an explicit rotate and defaults omitted rotate to 0", () => {
    const doc = docOf(
      staticText({ rotate: 45 }),
      line({ rotate: -30.5 }),
      rect(),
    );
    const result = lowerIr(doc, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const [text, ln, rc] = result.document.pages[0] ?? [];
    expect(text).toMatchObject({ rotate: 45 });
    expect(ln).toMatchObject({ rotate: -30.5 });
    expect(rc).toMatchObject({ rotate: 0 });
  });

  it("propagates a flex child's rotate to its placed element", () => {
    const doc = docOf(
      flex({ children: [boundTextChild("k", { rotate: 90 })] }),
    );
    const result = lowerIr(doc, { k: "v" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.document.pages[0]?.[0]).toMatchObject({
      sourceId: "c1",
      rotate: 90,
    });
  });

  it("propagates pageNumber's rotate to every page", () => {
    const doc = docOf(
      pageNumber({ rotate: 15 }),
      table({ maxY: 100, headerHeight: 10, rowHeight: 10, continuationY: 0 }),
    );
    const result = lowerIr(doc, { items: rowsOf(10) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    for (const page of result.document.pages) {
      expect(page.find((el) => el.sourceId === "pn1")).toMatchObject({
        rotate: 15,
      });
    }
  });

  it("gives every table-expanded element rotate 0", () => {
    const doc = docOf(table({ stripeColor: "#eeeeee" }));
    const result = lowerIr(doc, { items: rowsOf(3) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const expanded = (result.document.pages[0] ?? []).filter(
      (el) => el.sourceId === "items",
    );
    expect(expanded.length).toBeGreaterThan(0);
    expect(expanded.every((el) => el.rotate === 0)).toBe(true);
  });
});

describe("lowerIr — table stripeColor", () => {
  function rectsOf(page: readonly LoweredElement[]) {
    return page.filter(
      (el): el is Extract<LoweredElement, { type: "rect" }> =>
        el.type === "rect",
    );
  }

  it("shades only odd row indices (display rows 2, 4, …) and none when stripeColor is absent", () => {
    const doc = docOf(
      table({
        maxY: 100,
        headerHeight: 10,
        rowHeight: 10,
        stripeColor: "#f0f0f0",
      }),
    );
    const result = lowerIr(doc, { items: rowsOf(4) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const stripes = rectsOf(result.document.pages[0] ?? []).filter(
      (el) => el.fillColor === "#f0f0f0",
    );
    expect(stripes.map((s) => s.y)).toEqual([0 + 10 + 1 * 10, 0 + 10 + 3 * 10]);

    const withoutStripe = docOf(
      table({ maxY: 100, headerHeight: 10, rowHeight: 10 }),
    );
    const withoutResult = lowerIr(withoutStripe, { items: rowsOf(4) });
    expect(withoutResult.ok).toBe(true);
    if (!withoutResult.ok) throw new Error("expected success");
    expect(
      rectsOf(withoutResult.document.pages[0] ?? []).some(
        (el) => el.fillColor !== null,
      ),
    ).toBe(false);
  });

  it("draws the stripe fill before the frame, grid lines and cell text", () => {
    const doc = docOf(
      table({
        maxY: 100,
        headerHeight: 10,
        rowHeight: 10,
        stripeColor: "#f0f0f0",
      }),
    );
    const result = lowerIr(doc, { items: rowsOf(2) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const types = (result.document.pages[0] ?? []).map((el) =>
      el.type === "line" ? `line:${el.orientation}` : el.type,
    );
    expect(types).toEqual([
      "rect", // stripe (row index 1)
      "rect", // frame
      "line:horizontal",
      "line:horizontal",
      "line:vertical",
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
    ]);
  });

  it("shades minRows-padded empty rows the same as bound rows", () => {
    const doc = docOf(
      table({
        maxY: 100,
        headerHeight: 10,
        rowHeight: 10,
        minRows: 4,
        stripeColor: "#f0f0f0",
      }),
    );
    const result = lowerIr(doc, { items: rowsOf(1) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const stripes = rectsOf(result.document.pages[0] ?? []).filter(
      (el) => el.fillColor === "#f0f0f0",
    );
    expect(stripes).toHaveLength(2);
  });

  it("keeps the stripe parity continuous across a page split (chunk-crossing row numbering)", () => {
    // kFirst = floor((100-0-10)/10) = 9 → chunk 1 has rows t=0..8 (9 rows, odd: 1,3,5,7 → 4 stripes)
    // continuation starts at t=9 (even) for row 0 of chunk 2
    const doc = docOf(
      table({
        maxY: 100,
        headerHeight: 10,
        rowHeight: 10,
        continuationY: 0,
        stripeColor: "#f0f0f0",
      }),
    );
    const result = lowerIr(doc, { items: rowsOf(10) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const page1Stripes = rectsOf(result.document.pages[0] ?? []).filter(
      (el) => el.fillColor === "#f0f0f0",
    );
    const page2Stripes = rectsOf(result.document.pages[1] ?? []).filter(
      (el) => el.fillColor === "#f0f0f0",
    );
    // t=9 (10th row, continuation chunk row 0) is odd → shaded despite being the chunk's first row
    expect(page1Stripes).toHaveLength(4);
    expect(page2Stripes).toHaveLength(1);
    expect(page2Stripes[0]?.y).toBe(0 + 10 + 0 * 10);
  });
});

describe("lowerIr — table frame/grid attributes", () => {
  function frame(page: readonly LoweredElement[]) {
    const el = page.find(
      (el): el is Extract<LoweredElement, { type: "rect" }> =>
        el.type === "rect",
    );
    if (!el) throw new Error("expected a frame rect");
    return el;
  }

  function gridLines(page: readonly LoweredElement[]) {
    return page.filter(
      (el): el is Extract<LoweredElement, { type: "line" }> =>
        el.type === "line",
    );
  }

  it("uses the spec defaults (0.4mm frame, 0.25mm grid, solid) when omitted", () => {
    const doc = docOf(table({ maxY: 100, headerHeight: 10, rowHeight: 10 }));
    const result = lowerIr(doc, { items: rowsOf(1) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const page = result.document.pages[0] ?? [];
    expect(frame(page)).toMatchObject({
      borderWidth: 0.4,
      borderStyle: "solid",
    });
    for (const line of gridLines(page)) {
      expect(line).toMatchObject({ thickness: 0.25, strokeStyle: "solid" });
    }
  });

  it("applies explicit frameWidth/gridWidth/frameStyle/gridStyle to the frame and grid lines", () => {
    const doc = docOf(
      table({
        maxY: 100,
        headerHeight: 10,
        rowHeight: 10,
        frameWidth: 1,
        gridWidth: 0.6,
        frameStyle: "dashed",
        gridStyle: "dotted",
      }),
    );
    const result = lowerIr(doc, { items: rowsOf(1) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const page = result.document.pages[0] ?? [];
    expect(frame(page)).toMatchObject({
      borderWidth: 1,
      borderStyle: "dashed",
    });
    for (const line of gridLines(page)) {
      expect(line).toMatchObject({ thickness: 0.6, strokeStyle: "dotted" });
    }
  });
});
