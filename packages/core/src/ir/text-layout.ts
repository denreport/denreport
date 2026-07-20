import { PT_TO_MM } from "./constants";
import type { IrAlign } from "./types";

/**
 * A glyph width function: given a Unicode code point, returns its advance
 * width as a fraction of the font size (em units). Reading the value from an
 * actual font file is the caller's responsibility (see targets' font utilities).
 */
export type CharWidthEm = (codePoint: number) => number;

/** Input to layoutTextLines. */
export interface TextLayoutInput {
  readonly content: string;
  /** Width, in mm, to wrap `content` within. */
  readonly widthMm: number;
  readonly fontSize: number;
  readonly align: IrAlign;
}

/** One wrapped line of text. */
export interface LaidOutLine {
  readonly text: string;
  /** Extra inter-character spacing, in pt, for justified alignment (0 for non-justified lines). */
  readonly charSpacePt: number;
}

/** Characters subject to the line-head prohibition rule (kinsoku) — a concatenated string of 1 character = 1 code point each. Kept in sync with the generated Python's _KINSOKU_HEAD */
export const LINE_HEAD_PROHIBITED = "、。，．）｝］」』】〕〉》｡､｣,.)]}";

function widthOfChars(
  chars: readonly string[],
  fontSize: number,
  charWidthEm: CharWidthEm,
): number {
  let total = 0;
  for (const ch of chars) {
    total += charWidthEm(ch.codePointAt(0) as number) * fontSize;
  }
  return total;
}

function wrapParagraph(
  paragraph: string,
  widthPt: number,
  fontSize: number,
  charWidthEm: CharWidthEm,
): string[] {
  const lines: string[][] = [];
  let line: string[] = [];
  for (const ch of paragraph) {
    const candidate = [...line, ch];
    if (
      line.length > 0 &&
      widthOfChars(candidate, fontSize, charWidthEm) > widthPt
    ) {
      lines.push(line);
      line = [ch];
      // Push-out: if the head of the line we just wrapped is still a prohibited character, repeat as long as the previous line has at least 1 character left
      while (
        LINE_HEAD_PROHIBITED.includes(line[0] as string) &&
        (lines[lines.length - 1]?.length ?? 0) >= 2
      ) {
        const prevLine = lines[lines.length - 1] as string[];
        line = [prevLine[prevLine.length - 1] as string, ...line];
        lines[lines.length - 1] = prevLine.slice(0, -1);
      }
    } else {
      line = candidate;
    }
  }
  lines.push(line);
  return lines.map((chars) => chars.join(""));
}

function justifyCharSpace(
  text: string,
  widthPt: number,
  fontSize: number,
  charWidthEm: CharWidthEm,
): number {
  const chars = [...text];
  if (chars.length < 2) return 0;
  const lineWidthPt = widthOfChars(chars, fontSize, charWidthEm);
  if (!(lineWidthPt < widthPt)) return 0;
  return (widthPt - lineWidthPt) / (chars.length - 1);
}

/**
 * Wraps `input.content` to fit `input.widthMm`, applying Japanese line-head
 * prohibition (kinsoku) rules, and computes per-line character spacing when
 * `input.align` is "justify" so each line fills its width evenly.
 */
export function layoutTextLines(
  input: TextLayoutInput,
  charWidthEm: CharWidthEm,
): readonly LaidOutLine[] {
  const widthPt = input.widthMm / PT_TO_MM;
  const lines = input.content
    .split("\n")
    .flatMap((paragraph) =>
      wrapParagraph(paragraph, widthPt, input.fontSize, charWidthEm),
    );
  if (input.align !== "justify") {
    return lines.map((text) => ({ text, charSpacePt: 0 }));
  }
  return lines.map((text) => ({
    text,
    charSpacePt: justifyCharSpace(text, widthPt, input.fontSize, charWidthEm),
  }));
}
