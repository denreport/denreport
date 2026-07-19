import type { IrDocument, IrError, IrPages } from "@denreport/core";
import type { ReactNode } from "react";
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

const PAGES_OPTIONS: readonly {
  readonly value: IrPages;
  readonly label: string;
}[] = [
  { value: "first", label: "1ページ目" },
  { value: "rest", label: "継続" },
  { value: "last", label: "最終" },
  { value: "all", label: "全" },
];

/** 権限拒否・非対応ブラウザでも操作を継続できるよう、失敗は無視する */
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

  const commitDoc = (op: (document: IrDocument) => IrDocument): void => {
    const current = store.getState().document;
    const updated = op(current);
    if (updated !== current) {
      store.commit(updated);
    }
  };

  if (footnotes === undefined) {
    return (
      <section className="apx-sect">
        <div className="apx-sect-h">脚注</div>
        <button
          type="button"
          className="apx-btn apx-btn-secondary"
          onClick={() =>
            commitDoc((doc) => setFootnotes(doc, defaultFootnotes(doc.page)))
          }
        >
          脚注を使う
        </button>
      </section>
    );
  }

  return (
    <section className="apx-sect">
      <div className="apx-sect-h">脚注</div>
      <NumberField
        label="x"
        value={footnotes.x}
        unit="mm"
        precision={0.1}
        error={errorMessageFor(errors, "x")}
        onCommit={(x) =>
          commitDoc((doc) => setFootnotes(doc, { ...footnotes, x }))
        }
      />
      <NumberField
        label="幅"
        value={footnotes.w}
        unit="mm"
        precision={0.1}
        error={errorMessageFor(errors, "w")}
        onCommit={(w) =>
          commitDoc((doc) => setFootnotes(doc, { ...footnotes, w }))
        }
      />
      <NumberField
        label="下端からの距離"
        value={footnotes.bottom}
        unit="mm"
        precision={0.1}
        error={errorMessageFor(errors, "bottom")}
        onCommit={(bottom) =>
          commitDoc((doc) => setFootnotes(doc, { ...footnotes, bottom }))
        }
      />
      <NumberField
        label="文字サイズ"
        value={footnotes.fontSize}
        unit="pt"
        precision={0.1}
        error={errorMessageFor(errors, "fontSize")}
        onCommit={(fontSize) =>
          commitDoc((doc) => setFootnotes(doc, { ...footnotes, fontSize }))
        }
      />
      <NumberField
        label="行間"
        value={footnotes.lineHeight}
        precision={0.01}
        error={errorMessageFor(errors, "lineHeight")}
        onCommit={(lineHeight) =>
          commitDoc((doc) => setFootnotes(doc, { ...footnotes, lineHeight }))
        }
      />
      <SegmentField
        label="ページ"
        value={footnotes.pages}
        options={PAGES_OPTIONS}
        onCommit={(pages) =>
          commitDoc((doc) => setFootnotes(doc, { ...footnotes, pages }))
        }
      />
      <p className="apx-sect-note">
        テキスト要素の本文に {"{#id}"}
        と書くと、対応する id
        の注記をここに表示します。番号はマークの出現順に自動採番されます。
      </p>
      <div className="apx-sect-h">
        注記<span className="apx-mono">{footnotes.notes.length}</span>
      </div>
      {footnotes.notes.map((note, i) => {
        const textError = errorMessageFor(errors, `notes[${i}].text`);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: 注記に安定 id がなく、id 編集中の重複は編集の常態のため index で識別する
          <div key={i} className="apx-col-card">
            <div className="apx-sect-h">
              注記{i + 1}
              <button
                type="button"
                className="apx-col-btn apx-col-del"
                aria-label={`注記${i + 1}を削除`}
                onClick={() => commitDoc((doc) => removeFootnoteNote(doc, i))}
              >
                ×
              </button>
            </div>
            <TextField
              label="id"
              value={note.id}
              mono
              error={errorMessageFor(errors, `notes[${i}].id`)}
              onCommit={(id) =>
                commitDoc((doc) => updateFootnoteNote(doc, i, { id }))
              }
            />
            <div className="apx-copy-row">
              <button
                type="button"
                className="apx-copy-btn"
                onClick={() => copyToClipboard(note.id)}
              >
                id をコピー
              </button>
              <button
                type="button"
                className="apx-copy-btn"
                onClick={() => copyToClipboard(`{#${note.id}}`)}
              >
                {"{#id} をコピー"}
              </button>
            </div>
            <TextAreaField
              label="本文"
              value={note.text}
              onCommit={(text) =>
                commitDoc((doc) => updateFootnoteNote(doc, i, { text }))
              }
            />
            {textError !== undefined && (
              <div className="apx-col-err">{textError}</div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        className="apx-add-col"
        onClick={() => commitDoc((doc) => addFootnoteNote(doc))}
      >
        ＋ 注記を追加
      </button>
      <button
        type="button"
        className="apx-btn apx-btn-secondary"
        onClick={() => commitDoc((doc) => setFootnotes(doc, undefined))}
      >
        脚注を削除
      </button>
    </section>
  );
}
