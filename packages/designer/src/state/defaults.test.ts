import type { IrDocument, IrElementType } from "@denreport/core";
import { parseIr, validateIr } from "@denreport/core";
import { describe, expect, it } from "vitest";
import {
  createCenteredElement,
  createDefaultElement,
  defaultSizeMm,
  nextElementId,
} from "./defaults";
import { addElement } from "./elements";

const ALL_TYPES: readonly IrElementType[] = [
  "text",
  "line",
  "rect",
  "ellipse",
  "table",
  "image",
  "flex",
  "pageNumber",
  "barcode",
];

function blankDocument(): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { name: "NotoSansJP" },
    elements: [],
  };
}

describe("nextElementId", () => {
  it("白紙文書では <type>1 を返す", () => {
    expect(nextElementId(blankDocument(), "text")).toBe("text1");
    expect(nextElementId(blankDocument(), "pageNumber")).toBe("pageNumber1");
  });

  it("flex 子孫の id とも衝突しない", () => {
    let doc = blankDocument();
    doc = addElement(doc, createDefaultElement(doc, "flex", 10, 10));
    // flex1 と、その text 子 text1 が使用済みになる
    expect(nextElementId(doc, "flex")).toBe("flex2");
    expect(nextElementId(doc, "text")).toBe("text2");
  });

  it("削除済み番号（最小の空き）を再利用する", () => {
    let doc = blankDocument();
    doc = addElement(doc, createDefaultElement(doc, "text", 10, 10));
    doc = addElement(doc, createDefaultElement(doc, "text", 10, 30));
    doc = addElement(doc, createDefaultElement(doc, "text", 10, 50));
    doc = {
      ...doc,
      elements: doc.elements.filter((el) => el.id !== "text2"),
    };
    expect(nextElementId(doc, "text")).toBe("text2");
  });
});

describe("createDefaultElement", () => {
  for (const type of ALL_TYPES) {
    it(`${type}: S 群通過の正規化済み完全形で、白紙 A4 上で M 群違反を作らない`, () => {
      const doc = addElement(
        blankDocument(),
        createDefaultElement(blankDocument(), type, 20, 30),
      );
      const result = parseIr(JSON.stringify(doc));
      expect(result.ok).toBe(true);
      if (result.ok) {
        // 正規化済み = parseIr のデフォルト適用で変化しない
        expect(result.document).toEqual(doc);
        expect(validateIr(result.document)).toEqual([]);
      }
    });
  }

  it("座標は 0.1mm に丸められる", () => {
    const el = createDefaultElement(blankDocument(), "rect", 10.04, 20.06);
    expect(el.type).toBe("rect");
    if (el.type === "rect") {
      expect(el.x).toBe(10);
      expect(el.y).toBe(20.1);
    }
  });

  it("table は文書依存デフォルト（maxY = page.height・continuationY = y）を具体値で持つ", () => {
    const el = createDefaultElement(blankDocument(), "table", 15, 90);
    expect(el.type).toBe("table");
    if (el.type === "table") {
      expect(el.maxY).toBe(297);
      expect(el.continuationY).toBe(90);
      expect(el.minRows).toBe(3);
    }
  });

  it("barcode は既定で qrcode・トークン値 {code} を持つ", () => {
    const el = createDefaultElement(blankDocument(), "barcode", 15, 90);
    expect(el.type).toBe("barcode");
    if (el.type === "barcode") {
      expect(el.symbology).toBe("qrcode");
      expect(el.value).toBe("{code}");
      expect(el.w).toBe(30);
      expect(el.h).toBe(30);
    }
  });

  it("flex は text 子1個つきで生成され、子 id も文書から採番される", () => {
    let doc = blankDocument();
    doc = addElement(doc, createDefaultElement(doc, "text", 10, 10));
    const el = createDefaultElement(doc, "flex", 20, 20);
    expect(el.type).toBe("flex");
    if (el.type === "flex") {
      expect(el.children).toHaveLength(1);
      expect(el.children[0]?.id).toBe("text2");
    }
  });
});

describe("createCenteredElement", () => {
  for (const type of ALL_TYPES) {
    it(`${type}: A4 白紙でページ中央に置かれ M 群違反を作らない`, () => {
      const doc = blankDocument();
      const el = createCenteredElement(doc, type);
      const size = defaultSizeMm(type);
      expect(el.x + size.w / 2).toBeCloseTo(doc.page.width / 2, 1);
      expect(el.y + size.h / 2).toBeCloseTo(doc.page.height / 2, 1);

      const result = parseIr(JSON.stringify(addElement(doc, el)));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(validateIr(result.document)).toEqual([]);
      }
    });
  }

  it("table は列幅の合計を幅として中央寄せする", () => {
    const doc = blankDocument();
    const el = createCenteredElement(doc, "table");
    expect(el.type).toBe("table");
    if (el.type === "table") {
      const totalWidth = el.columns.reduce(
        (sum, column) => sum + column.width,
        0,
      );
      expect(el.x + totalWidth / 2).toBeCloseTo(doc.page.width / 2, 1);
    }
  });

  it("用紙が既定サイズより小さいとき x / y は 0 にクランプされる", () => {
    const tiny: IrDocument = {
      ...blankDocument(),
      page: { width: 1, height: 1 },
    };
    const el = createCenteredElement(tiny, "rect");
    expect(el.x).toBe(0);
    expect(el.y).toBe(0);
  });
});

describe("defaultSizeMm", () => {
  it("全型の初期寸法を返す（line は length×0 相当、table は Σ列幅×(ヘッダ+minRows 行)）", () => {
    expect(defaultSizeMm("text")).toEqual({ w: 40, h: 8 });
    expect(defaultSizeMm("line")).toEqual({ w: 50, h: 0 });
    expect(defaultSizeMm("rect")).toEqual({ w: 40, h: 20 });
    expect(defaultSizeMm("ellipse")).toEqual({ w: 30, h: 20 });
    expect(defaultSizeMm("table")).toEqual({ w: 80, h: 32 });
    expect(defaultSizeMm("image")).toEqual({ w: 30, h: 30 });
    expect(defaultSizeMm("flex")).toEqual({ w: 40, h: 8 });
    expect(defaultSizeMm("pageNumber")).toEqual({ w: 30, h: 6 });
    expect(defaultSizeMm("barcode")).toEqual({ w: 30, h: 30 });
  });
});
