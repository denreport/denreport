import type {
  IrDocument,
  IrFootnoteNote,
  IrFootnotes,
  IrPage,
} from "@denreport/core";

export function defaultFootnotes(page: IrPage): IrFootnotes {
  return {
    x: 15,
    w: page.width - 30,
    bottom: 10,
    fontSize: 8,
    lineHeight: 1.25,
    pages: "all",
    notes: [],
  };
}

/** footnotes が undefined ならキーごと除去する */
export function setFootnotes(
  document: IrDocument,
  footnotes: IrFootnotes | undefined,
): IrDocument {
  if (footnotes === undefined) {
    const { footnotes: _footnotes, ...rest } = document;
    return rest;
  }
  return { ...document, footnotes };
}

/** id は footnotes 内で未使用の最小 n の "note<n>"、本文は空文字列 */
export function addFootnoteNote(document: IrDocument): IrDocument {
  const { footnotes } = document;
  if (footnotes === undefined) {
    return document;
  }
  const ids = new Set(footnotes.notes.map((note) => note.id));
  let n = 1;
  while (ids.has(`note${n}`)) {
    n += 1;
  }
  const note: IrFootnoteNote = { id: `note${n}`, text: "" };
  return {
    ...document,
    footnotes: { ...footnotes, notes: [...footnotes.notes, note] },
  };
}

export function updateFootnoteNote(
  document: IrDocument,
  index: number,
  patch: Partial<IrFootnoteNote>,
): IrDocument {
  const { footnotes } = document;
  if (footnotes === undefined) {
    return document;
  }
  const current = footnotes.notes[index];
  if (current === undefined) {
    return document;
  }
  const next = { ...current, ...patch };
  if (next.id === current.id && next.text === current.text) {
    return document;
  }
  const notes = [...footnotes.notes];
  notes[index] = next;
  return { ...document, footnotes: { ...footnotes, notes } };
}

export function removeFootnoteNote(
  document: IrDocument,
  index: number,
): IrDocument {
  const { footnotes } = document;
  if (footnotes === undefined || footnotes.notes[index] === undefined) {
    return document;
  }
  const notes = footnotes.notes.filter((_, i) => i !== index);
  return { ...document, footnotes: { ...footnotes, notes } };
}
