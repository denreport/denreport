import type { IrDocument, IrError, IrPages } from "@denreport/core";
import type { ReactNode } from "react";
import { useMessages } from "../../i18n/context";
import { errorMessageFor } from "../../state/error-index";
import {
  addFootnoteNote,
  defaultFootnotes,
  removeFootnoteNote,
  setFootnotes,
  updateFootnoteNote,
} from "../../state/footnotes";
import type { EditorStore } from "../../state/store";
import { NumberField, SegmentField, TextAreaField, TextField } from "./fields";

/** Ignores failures so the operation can continue even on permission denial or an unsupported browser */
function copyToClipboard(text: string): void {
  navigator.clipboard?.writeText(text)?.catch(() => {});
}

export function FootnotesSection(props: {
  readonly store: EditorStore;
  readonly document: IrDocument;
  readonly errors: readonly IrError[];
}): ReactNode {
  const { store, document, errors } = props;
  const { footnotes } = document;
  const m = useMessages();
  const f = m.propertiesBulk.footnotes;
  const pagesOptions: readonly { value: IrPages; label: string }[] = [
    { value: "first", label: m.propertiesBulk.pagesOptions.first },
    { value: "rest", label: m.propertiesBulk.pagesOptions.rest },
    { value: "last", label: m.propertiesBulk.pagesOptions.last },
    { value: "all", label: m.propertiesBulk.pagesOptions.all },
  ];

  const commitDoc = (op: (document: IrDocument) => IrDocument): void => {
    const current = store.getState().document;
    const updated = op(current);
    if (updated !== current) {
      store.commit(updated);
    }
  };

  if (footnotes === undefined) {
    return (
      <section className="dr-sect">
        <div className="dr-sect-h">{f.heading}</div>
        <button
          type="button"
          className="dr-btn dr-btn-secondary"
          onClick={() =>
            commitDoc((doc) => setFootnotes(doc, defaultFootnotes(doc.page)))
          }
        >
          {f.use}
        </button>
      </section>
    );
  }

  return (
    <section className="dr-sect">
      <div className="dr-sect-h">{f.heading}</div>
      <NumberField
        label={f.x}
        value={footnotes.x}
        unit="mm"
        precision={0.1}
        error={errorMessageFor(errors, "x")}
        onCommit={(x) =>
          commitDoc((doc) => setFootnotes(doc, { ...footnotes, x }))
        }
      />
      <NumberField
        label={f.width}
        value={footnotes.w}
        unit="mm"
        precision={0.1}
        error={errorMessageFor(errors, "w")}
        onCommit={(w) =>
          commitDoc((doc) => setFootnotes(doc, { ...footnotes, w }))
        }
      />
      <NumberField
        label={f.bottom}
        value={footnotes.bottom}
        unit="mm"
        precision={0.1}
        error={errorMessageFor(errors, "bottom")}
        onCommit={(bottom) =>
          commitDoc((doc) => setFootnotes(doc, { ...footnotes, bottom }))
        }
      />
      <NumberField
        label={f.fontSize}
        value={footnotes.fontSize}
        unit="pt"
        precision={0.1}
        error={errorMessageFor(errors, "fontSize")}
        onCommit={(fontSize) =>
          commitDoc((doc) => setFootnotes(doc, { ...footnotes, fontSize }))
        }
      />
      <NumberField
        label={f.lineHeight}
        value={footnotes.lineHeight}
        precision={0.01}
        error={errorMessageFor(errors, "lineHeight")}
        onCommit={(lineHeight) =>
          commitDoc((doc) => setFootnotes(doc, { ...footnotes, lineHeight }))
        }
      />
      <SegmentField
        label={f.pages}
        value={footnotes.pages}
        options={pagesOptions}
        onCommit={(pages) =>
          commitDoc((doc) => setFootnotes(doc, { ...footnotes, pages }))
        }
      />
      <p className="dr-sect-note">{f.hint}</p>
      <div className="dr-sect-h">
        {f.notesHeading}
        <span className="dr-mono">{footnotes.notes.length}</span>
      </div>
      {footnotes.notes.map((note, i) => {
        const textError = errorMessageFor(errors, `notes[${i}].text`);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: notes have no stable id, and duplicates while editing the id are a normal part of editing, so index is used to identify them
          <div key={i} className="dr-col-card">
            <div className="dr-sect-h">
              {f.noteHeading(i + 1)}
              <button
                type="button"
                className="dr-col-btn dr-col-del"
                aria-label={f.deleteNoteLabel(i + 1)}
                onClick={() => commitDoc((doc) => removeFootnoteNote(doc, i))}
              >
                ×
              </button>
            </div>
            <TextField
              label={f.id}
              value={note.id}
              mono
              error={errorMessageFor(errors, `notes[${i}].id`)}
              onCommit={(id) =>
                commitDoc((doc) => updateFootnoteNote(doc, i, { id }))
              }
            />
            <div className="dr-copy-row">
              <button
                type="button"
                className="dr-copy-btn"
                onClick={() => copyToClipboard(note.id)}
              >
                {f.copyId}
              </button>
              <button
                type="button"
                className="dr-copy-btn"
                onClick={() => copyToClipboard(`{#${note.id}}`)}
              >
                {f.copyIdMark}
              </button>
            </div>
            <TextAreaField
              label={f.body}
              value={note.text}
              onCommit={(text) =>
                commitDoc((doc) => updateFootnoteNote(doc, i, { text }))
              }
            />
            {textError !== undefined && (
              <div className="dr-col-err">{textError}</div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        className="dr-add-col"
        onClick={() => commitDoc((doc) => addFootnoteNote(doc))}
      >
        {f.addNote}
      </button>
      <button
        type="button"
        className="dr-btn dr-btn-secondary"
        onClick={() => commitDoc((doc) => setFootnotes(doc, undefined))}
      >
        {f.remove}
      </button>
    </section>
  );
}
