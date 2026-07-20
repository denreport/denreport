import type { IrAlign, IrDocument } from "@denreport/core";
import type { ReactNode } from "react";
import { ja } from "../../i18n/messages/ja";
import { errorMessageFor } from "../../state/error-index";
import {
  addTableColumn,
  moveTableColumn,
  removeTableColumn,
  updateTableColumn,
} from "../../state/properties";
import { alignOptions } from "./align-options";
import type { ElementFormProps } from "./ElementProperties";
import { useDraftValue } from "./useDraftValue";

// このファイルは useMessages 未導入のため、整列ラベルは ja 固定で解決する
const ALIGN_OPTIONS = alignOptions(ja.properties.align);

function TextCell(props: {
  readonly ariaLabel: string;
  readonly value: string;
  readonly onCommit: (value: string) => void;
  readonly mono?: boolean | undefined;
  readonly invalid?: boolean | undefined;
}): ReactNode {
  const { ariaLabel, value, onCommit, mono, invalid } = props;
  const handlers = useDraftValue(value, (raw) => {
    if (raw !== value) {
      onCommit(raw);
    }
  });
  return (
    <span className={`apx-field${invalid === true ? " is-error" : ""}`}>
      <input
        aria-label={ariaLabel}
        className={mono === true ? "apx-mono" : undefined}
        value={handlers.draft}
        onChange={(e) => handlers.onChange(e.currentTarget.value)}
        onBlur={handlers.onBlur}
        onKeyDown={handlers.onKeyDown}
      />
    </span>
  );
}

function WidthCell(props: {
  readonly ariaLabel: string;
  readonly value: number;
  readonly onCommit: (value: number) => void;
  readonly invalid?: boolean | undefined;
}): ReactNode {
  const { ariaLabel, value, onCommit, invalid } = props;
  const handlers = useDraftValue(value.toFixed(1), (raw) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const next = Math.round(parsed * 10) / 10;
    if (next !== value) {
      onCommit(next);
    }
  });
  return (
    <span
      className={`apx-field apx-col-w${invalid === true ? " is-error" : ""}`}
    >
      <input
        aria-label={ariaLabel}
        className="apx-num"
        inputMode="decimal"
        value={handlers.draft}
        onChange={(e) => handlers.onChange(e.currentTarget.value)}
        onBlur={handlers.onBlur}
        onKeyDown={handlers.onKeyDown}
      />
      <span className="apx-unit">mm</span>
    </span>
  );
}

export function ColumnsEditor(props: ElementFormProps): ReactNode {
  const { store, view, errors } = props;
  const el = view.element;
  if (el.type !== "table") {
    return null;
  }

  const commitDoc = (op: (document: IrDocument) => IrDocument): void => {
    const document = store.getState().document;
    const updated = op(document);
    if (updated !== document) {
      store.commit(updated);
    }
  };

  return (
    <section className="apx-sect">
      <div className="apx-sect-h">
        列<span className="apx-mono">{el.columns.length}</span>
      </div>
      {el.columns.map((col, i) => {
        const keyError = errorMessageFor(errors, `columns[${i}].key`);
        const widthError = errorMessageFor(errors, `columns[${i}].width`);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: 列に安定 id がなく、key の重複は編集の常態のため index で識別する
          <div key={i} className="apx-col-card">
            <div className="apx-col-row">
              <TextCell
                ariaLabel={`列${i + 1} の key`}
                value={col.key}
                mono
                invalid={keyError !== undefined}
                onCommit={(key) =>
                  commitDoc((doc) => updateTableColumn(doc, el.id, i, { key }))
                }
              />
              <button
                type="button"
                className="apx-col-btn"
                aria-label={`列${i + 1} を上へ`}
                disabled={i === 0}
                onClick={() =>
                  commitDoc((doc) => moveTableColumn(doc, el.id, i, -1))
                }
              >
                ↑
              </button>
              <button
                type="button"
                className="apx-col-btn"
                aria-label={`列${i + 1} を下へ`}
                disabled={i === el.columns.length - 1}
                onClick={() =>
                  commitDoc((doc) => moveTableColumn(doc, el.id, i, 1))
                }
              >
                ↓
              </button>
              <button
                type="button"
                className="apx-col-btn apx-col-del"
                aria-label={`列${i + 1} を削除`}
                disabled={el.columns.length === 1}
                onClick={() =>
                  commitDoc((doc) => removeTableColumn(doc, el.id, i))
                }
              >
                ×
              </button>
            </div>
            <div className="apx-col-row">
              <TextCell
                ariaLabel={`列${i + 1} の見出し`}
                value={col.label}
                onCommit={(label) =>
                  commitDoc((doc) =>
                    updateTableColumn(doc, el.id, i, { label }),
                  )
                }
              />
              <WidthCell
                ariaLabel={`列${i + 1} の幅`}
                value={col.width}
                invalid={widthError !== undefined}
                onCommit={(width) =>
                  commitDoc((doc) =>
                    updateTableColumn(doc, el.id, i, { width }),
                  )
                }
              />
              <span className="apx-field apx-col-align">
                <select
                  aria-label={`列${i + 1} の整列`}
                  value={col.align}
                  onChange={(e) =>
                    commitDoc((doc) =>
                      updateTableColumn(doc, el.id, i, {
                        align: e.currentTarget.value as IrAlign,
                      }),
                    )
                  }
                >
                  {ALIGN_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </span>
            </div>
            <div className="apx-col-row">
              <label className="apx-check">
                <input
                  type="checkbox"
                  aria-label={`列${i + 1} の同一値の連続行を結合`}
                  checked={col.mergeSameValue === true}
                  onChange={(e) =>
                    commitDoc((doc) =>
                      updateTableColumn(doc, el.id, i, {
                        mergeSameValue: e.currentTarget.checked,
                      }),
                    )
                  }
                />
                同一値の連続行を結合
              </label>
            </div>
            {keyError !== undefined && (
              <div className="apx-col-err">{keyError}</div>
            )}
            {widthError !== undefined && (
              <div className="apx-col-err">{widthError}</div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        className="apx-add-col"
        onClick={() => commitDoc((doc) => addTableColumn(doc, el.id))}
      >
        ＋ 列を追加
      </button>
    </section>
  );
}
