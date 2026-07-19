import { describe, expect, it } from "vitest";
import { resolveFontSlot } from "../src/ir/font";
import type { IrFont, IrFontStyle, IrFontWeight } from "../src/ir/types";

const FULL: IrFont = {
  regular: "R",
  bold: "B",
  italic: "I",
  boldItalic: "BI",
};

const REQUESTS: readonly (readonly [IrFontWeight, IrFontStyle])[] = [
  ["normal", "normal"],
  ["bold", "normal"],
  ["normal", "italic"],
  ["bold", "italic"],
];

describe("resolveFontSlot", () => {
  it("picks the exact slot when all four are defined", () => {
    expect(resolveFontSlot(FULL, "normal", "normal")).toBe("regular");
    expect(resolveFontSlot(FULL, "bold", "normal")).toBe("bold");
    expect(resolveFontSlot(FULL, "normal", "italic")).toBe("italic");
    expect(resolveFontSlot(FULL, "bold", "italic")).toBe("boldItalic");
  });

  it("resolves every request to regular when only regular is defined", () => {
    const font: IrFont = { regular: "R" };
    for (const [weight, style] of REQUESTS) {
      expect(resolveFontSlot(font, weight, style)).toBe("regular");
    }
  });

  it("degrades (bold, italic) preferring italic over bold", () => {
    expect(
      resolveFontSlot(
        { regular: "R", bold: "B", italic: "I" },
        "bold",
        "italic",
      ),
    ).toBe("italic");
    expect(resolveFontSlot({ regular: "R", bold: "B" }, "bold", "italic")).toBe(
      "bold",
    );
    expect(resolveFontSlot({ regular: "R" }, "bold", "italic")).toBe("regular");
  });

  it("degrades (bold, normal) to regular without borrowing italic slots", () => {
    const font: IrFont = { regular: "R", italic: "I", boldItalic: "BI" };
    expect(resolveFontSlot(font, "bold", "normal")).toBe("regular");
  });

  it("degrades (normal, italic) to regular without borrowing bold slots", () => {
    const font: IrFont = { regular: "R", bold: "B", boldItalic: "BI" };
    expect(resolveFontSlot(font, "normal", "italic")).toBe("regular");
  });

  it("never resolves (normal, normal) to a non-regular slot", () => {
    expect(resolveFontSlot(FULL, "normal", "normal")).toBe("regular");
  });
});
