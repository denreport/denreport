import { describe, expect, it } from "vitest";
import { PT_TO_MM } from "../src/ir/constants";
import type { CharWidthEm } from "../src/ir/text-layout";
import { LINE_HEAD_PROHIBITED, layoutTextLines } from "../src/ir/text-layout";

const UNIT_WIDTH: CharWidthEm = () => 1;

function widthMmFor(widthPt: number): number {
  return widthPt * PT_TO_MM;
}

function texts(
  content: string,
  widthPt: number,
  align: "left" | "center" | "right" | "justify" = "left",
  fontSize = 1,
  charWidthEm: CharWidthEm = UNIT_WIDTH,
): readonly string[] {
  return layoutTextLines(
    { content, widthMm: widthMmFor(widthPt), fontSize, align },
    charWidthEm,
  ).map((line) => line.text);
}

describe("layoutTextLines", () => {
  it("wraps greedily onto multiple lines when the width is exceeded", () => {
    expect(texts("abcdef", 3.2)).toEqual(["abc", "def"]);
  });

  it("preserves explicit newlines and empty lines", () => {
    expect(texts("ab\n\ncd", 10)).toEqual(["ab", "", "cd"]);
  });

  it("pushes a single prohibited line-head character back to the previous line", () => {
    expect(texts("あい、", 2)).toEqual(["あ", "い、"]);
  });

  it("cuts off the retreat once the previous line would be left empty, allowing consecutive prohibited characters at the head", () => {
    expect(texts("あいた。」", 2)).toEqual(["あい", "た", "。」"]);
  });

  it("leaves a paragraph-initial prohibited character untouched", () => {
    expect(texts("。あ", 1)).toEqual(["。", "あ"]);
  });

  it("places a single character even when it alone exceeds the width", () => {
    expect(texts("あ", 0.5)).toEqual(["あ"]);
  });

  it("counts codepoints, not UTF-16 code units, for surrogate pairs", () => {
    const astral = "𠀀𠀁"; // 2 codepoints, 4 UTF-16 code units
    const lines = layoutTextLines(
      {
        content: astral,
        widthMm: widthMmFor(10),
        fontSize: 1,
        align: "justify",
      },
      UNIT_WIDTH,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]?.text).toBe(astral);
    expect(lines[0]?.charSpacePt).toBe((10 - 2) / (2 - 1));
  });

  it("exposes the fixed line-head prohibited character set", () => {
    expect(LINE_HEAD_PROHIBITED).toContain("。");
    expect(LINE_HEAD_PROHIBITED).toContain("」");
  });

  describe("justify", () => {
    it("leaves non-justify alignments at charSpacePt 0", () => {
      const lines = layoutTextLines(
        { content: "abc", widthMm: widthMmFor(10), fontSize: 1, align: "left" },
        UNIT_WIDTH,
      );
      expect(lines.every((line) => line.charSpacePt === 0)).toBe(true);
    });

    it("distributes the remaining width evenly across the codepoint gaps", () => {
      const lines = layoutTextLines(
        {
          content: "abcd",
          widthMm: widthMmFor(10),
          fontSize: 1,
          align: "justify",
        },
        UNIT_WIDTH,
      );
      expect(lines).toHaveLength(1);
      expect(lines[0]?.charSpacePt).toBe((10 - 4) / (4 - 1));
    });

    it("keeps charSpacePt at 0 for a single-character line (n < 2)", () => {
      const lines = layoutTextLines(
        {
          content: "a",
          widthMm: widthMmFor(10),
          fontSize: 1,
          align: "justify",
        },
        UNIT_WIDTH,
      );
      expect(lines).toEqual([{ text: "a", charSpacePt: 0 }]);
    });

    it("keeps charSpacePt at 0 when the line exactly fills the width", () => {
      const lines = layoutTextLines(
        {
          content: "abcd",
          widthMm: widthMmFor(4),
          fontSize: 1,
          align: "justify",
        },
        UNIT_WIDTH,
      );
      expect(lines).toEqual([{ text: "abcd", charSpacePt: 0 }]);
    });

    it("stretches every wrapped line, including the last one", () => {
      const lines = layoutTextLines(
        {
          content: "abcdef",
          widthMm: widthMmFor(3.5),
          fontSize: 1,
          align: "justify",
        },
        UNIT_WIDTH,
      );
      expect(lines).toEqual([
        { text: "abc", charSpacePt: (3.5 - 3) / (3 - 1) },
        { text: "def", charSpacePt: (3.5 - 3) / (3 - 1) },
      ]);
    });
  });
});
