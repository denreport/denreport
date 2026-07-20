import { IDENTIFIER_MAX_LENGTH, PT_TO_MM } from "./constants";
import type { IrDocument, IrFootnoteNote, IrTextElement } from "./types";

const FOOTNOTE_MARK_PATTERN = new RegExp(
  `\\{#([A-Za-z_][A-Za-z0-9_]{0,${IDENTIFIER_MAX_LENGTH - 1}})\\}`,
  "g",
);

/** Returns the ids of {#id} marks within text, in order of appearance, with duplicates */
export function footnoteMarkIds(text: string): readonly string[] {
  return [...text.matchAll(FOOTNOTE_MARK_PATTERN)].map(
    (match) => match[1] as string,
  );
}

/**
 * Replaces every `{#id}` footnote mark in the document's text with its
 * numbered reference (`*1`, `*2`, ...) in first-reference order, and appends
 * a text element rendering the notes block. Returns `document` unchanged if
 * it has no `footnotes`; otherwise the returned document has no `footnotes`
 * key. Assumes `document` is the output of parseIr and already passed
 * validateIr.
 */
export function resolveFootnotes(document: IrDocument): IrDocument {
  const { footnotes, ...rest } = document;
  if (footnotes === undefined) {
    return document;
  }

  const notesById = new Map(footnotes.notes.map((note) => [note.id, note]));
  const numberById = new Map<string, number>();
  let nextNumber = 1;
  const assignNumber = (id: string): number => {
    const existing = numberById.get(id);
    if (existing !== undefined) return existing;
    const n = nextNumber;
    nextNumber += 1;
    numberById.set(id, n);
    return n;
  };

  const elements = document.elements.map((element) => {
    if (element.type !== "text") return element;
    const text = element.text.replace(
      FOOTNOTE_MARK_PATTERN,
      (whole, id: string) =>
        notesById.has(id) ? `*${assignNumber(id)}` : whole,
    );
    return { ...element, text };
  });

  // If there are no references at all, don't add a block (only mark substitution is performed)
  if (numberById.size === 0) {
    return { ...rest, elements };
  }

  // Unreferenced notes (which don't occur in a document that passed validateIr) are numbered last, in definition order
  for (const note of footnotes.notes) {
    assignNumber(note.id);
  }

  const orderedEntries = footnotes.notes
    .map((note) => ({ note, number: numberById.get(note.id) }))
    .filter(
      (entry): entry is { note: IrFootnoteNote; number: number } =>
        entry.number !== undefined,
    )
    .sort((a, b) => a.number - b.number);

  const content = orderedEntries
    .map(({ note, number }) => `*${number} ${note.text}`)
    .join("\n");
  const blockHeight =
    content.split("\n").length *
    footnotes.fontSize *
    footnotes.lineHeight *
    PT_TO_MM;

  const notesElement: IrTextElement = {
    type: "text",
    id: "drFootnotes",
    x: footnotes.x,
    y: document.page.height - footnotes.bottom - blockHeight,
    pages: footnotes.pages,
    w: footnotes.w,
    h: blockHeight,
    text: content,
    fontSize: footnotes.fontSize,
    align: "left",
    lineHeight: footnotes.lineHeight,
  };

  return { ...rest, elements: [...elements, notesElement] };
}
