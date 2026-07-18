import type { IrDocument, IrFootnotes } from "@denreport/core";
import { describe, expect, it } from "vitest";
import {
  addFootnoteNote,
  defaultFootnotes,
  removeFootnoteNote,
  setFootnotes,
  updateFootnoteNote,
} from "./footnotes";

function docOf(footnotes?: IrFootnotes): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { name: "NotoSansJP" },
    elements: [],
    ...(footnotes !== undefined ? { footnotes } : {}),
  };
}

function footnotesOf(overrides: Partial<IrFootnotes> = {}): IrFootnotes {
  return {
    x: 15,
    w: 180,
    bottom: 10,
    fontSize: 8,
    lineHeight: 1.25,
    pages: "all",
    notes: [],
    ...overrides,
  };
}

describe("defaultFootnotes", () => {
  it("derives w from the page width, leaving 15mm margins on each side", () => {
    expect(defaultFootnotes({ width: 210, height: 297 })).toEqual({
      x: 15,
      w: 180,
      bottom: 10,
      fontSize: 8,
      lineHeight: 1.25,
      pages: "all",
      notes: [],
    });
  });
});

describe("setFootnotes", () => {
  it("adds a footnotes key when given a value", () => {
    const document = docOf();
    const footnotes = footnotesOf();
    const next = setFootnotes(document, footnotes);
    expect(next.footnotes).toBe(footnotes);
  });

  it("removes the footnotes key when given undefined", () => {
    const document = docOf(footnotesOf());
    const next = setFootnotes(document, undefined);
    expect(next).not.toHaveProperty("footnotes");
  });

  it("replaces the whole block on a subsequent call", () => {
    const document = docOf(footnotesOf({ x: 15 }));
    const next = setFootnotes(document, footnotesOf({ x: 20 }));
    expect(next.footnotes?.x).toBe(20);
  });
});

describe("addFootnoteNote", () => {
  it("is a no-op when footnotes is undefined", () => {
    const document = docOf();
    expect(addFootnoteNote(document)).toBe(document);
  });

  it("appends a note with an empty body and an auto-numbered id", () => {
    const document = docOf(footnotesOf());
    const next = addFootnoteNote(document);
    expect(next.footnotes?.notes).toEqual([{ id: "note1", text: "" }]);
    const next2 = addFootnoteNote(next);
    expect(next2.footnotes?.notes).toEqual([
      { id: "note1", text: "" },
      { id: "note2", text: "" },
    ]);
  });

  it("reuses the smallest vacant number", () => {
    const document = docOf(
      footnotesOf({
        notes: [
          { id: "note1", text: "a" },
          { id: "note2", text: "b" },
        ],
      }),
    );
    const withoutFirst = docOf(
      footnotesOf({ notes: [{ id: "note2", text: "b" }] }),
    );
    expect(addFootnoteNote(withoutFirst).footnotes?.notes).toEqual([
      { id: "note2", text: "b" },
      { id: "note1", text: "" },
    ]);
    expect(document).toBeDefined();
  });
});

describe("updateFootnoteNote", () => {
  it("is a no-op when footnotes is undefined", () => {
    const document = docOf();
    expect(updateFootnoteNote(document, 0, { text: "x" })).toBe(document);
  });

  it("is a no-op for an out-of-range index", () => {
    const document = docOf(footnotesOf({ notes: [{ id: "a", text: "x" }] }));
    expect(updateFootnoteNote(document, 5, { text: "y" })).toBe(document);
  });

  it("is a no-op when the patch does not change id or text", () => {
    const document = docOf(footnotesOf({ notes: [{ id: "a", text: "x" }] }));
    expect(updateFootnoteNote(document, 0, { id: "a", text: "x" })).toBe(
      document,
    );
  });

  it("patches the note at index and leaves the others unchanged", () => {
    const document = docOf(
      footnotesOf({
        notes: [
          { id: "a", text: "1" },
          { id: "b", text: "2" },
        ],
      }),
    );
    const next = updateFootnoteNote(document, 1, { text: "改" });
    expect(next.footnotes?.notes).toEqual([
      { id: "a", text: "1" },
      { id: "b", text: "改" },
    ]);
  });
});

describe("removeFootnoteNote", () => {
  it("is a no-op when footnotes is undefined", () => {
    const document = docOf();
    expect(removeFootnoteNote(document, 0)).toBe(document);
  });

  it("is a no-op for an out-of-range index", () => {
    const document = docOf(footnotesOf({ notes: [{ id: "a", text: "x" }] }));
    expect(removeFootnoteNote(document, 5)).toBe(document);
  });

  it("removes the note at index", () => {
    const document = docOf(
      footnotesOf({
        notes: [
          { id: "a", text: "1" },
          { id: "b", text: "2" },
        ],
      }),
    );
    const next = removeFootnoteNote(document, 0);
    expect(next.footnotes?.notes).toEqual([{ id: "b", text: "2" }]);
  });
});
