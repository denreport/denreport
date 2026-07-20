import type { IrDocument, IrTableCellSpan } from "@denreport/core";
import type { ReactNode } from "react";
import { useMessages } from "../../i18n/context";
import { errorMessageFor } from "../../state/error-index";
import {
  addTableCellSpan,
  removeTableCellSpan,
  updateTableCellSpan,
} from "../../state/properties";
import type { ElementFormProps } from "./ElementProperties";
import { useDraftValue } from "./useDraftValue";

function IntCell(props: {
  readonly ariaLabel: string;
  readonly value: number;
  readonly min: number;
  readonly onCommit: (value: number) => void;
  readonly invalid?: boolean | undefined;
}): ReactNode {
  const { ariaLabel, value, min, onCommit, invalid } = props;
  const handlers = useDraftValue(String(value), (raw) => {
    const parsed = Number(raw.trim());
    if (!Number.isInteger(parsed) || parsed < min) {
      return;
    }
    if (parsed !== value) {
      onCommit(parsed);
    }
  });
  return (
    <span
      className={`apx-field apx-col-w${invalid === true ? " is-error" : ""}`}
    >
      <input
        aria-label={ariaLabel}
        className="apx-num"
        inputMode="numeric"
        value={handlers.draft}
        onChange={(e) => handlers.onChange(e.currentTarget.value)}
        onBlur={handlers.onBlur}
        onKeyDown={handlers.onKeyDown}
      />
    </span>
  );
}

function spanErrorFor(
  errors: ElementFormProps["errors"],
  index: number,
): string | undefined {
  for (const suffix of ["", ".row", ".key", ".rowSpan", ".colSpan"]) {
    const message = errorMessageFor(errors, `cellSpans[${index}]${suffix}`);
    if (message !== undefined) return message;
  }
  return undefined;
}

export function CellSpansEditor(props: ElementFormProps): ReactNode {
  const { store, view, errors } = props;
  const m = useMessages();
  const c = m.propertiesBulk.cellSpans;
  const el = view.element;
  if (el.type !== "table") {
    return null;
  }
  const spans = el.cellSpans ?? [];

  const commitDoc = (op: (document: IrDocument) => IrDocument): void => {
    const document = store.getState().document;
    const updated = op(document);
    if (updated !== document) {
      store.commit(updated);
    }
  };
  const commitPatch = (index: number, patch: Partial<IrTableCellSpan>): void =>
    commitDoc((doc) => updateTableCellSpan(doc, el.id, index, patch));

  return (
    <section className="apx-sect">
      <div className="apx-sect-h">
        {c.heading}
        <span className="apx-mono">{spans.length}</span>
      </div>
      {spans.map((span, i) => {
        const error = spanErrorFor(errors, i);
        const isHeader = span.row === "header";
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: merges have no stable id, so index is used to identify them
          <div key={i} className="apx-col-card">
            <div className="apx-col-row">
              <span className="apx-field">
                <select
                  aria-label={c.targetLabel(i + 1)}
                  value={isHeader ? "header" : "body"}
                  onChange={(e) =>
                    commitPatch(i, {
                      row: e.currentTarget.value === "header" ? "header" : 0,
                    })
                  }
                >
                  <option value="body">{c.body}</option>
                  <option value="header">{c.header}</option>
                </select>
              </span>
              {!isHeader && (
                <IntCell
                  ariaLabel={c.rowLabel(i + 1)}
                  value={typeof span.row === "number" ? span.row : 0}
                  min={0}
                  invalid={error !== undefined}
                  onCommit={(row) => commitPatch(i, { row })}
                />
              )}
              <button
                type="button"
                className="apx-col-btn apx-col-del"
                aria-label={c.deleteLabel(i + 1)}
                onClick={() =>
                  commitDoc((doc) => removeTableCellSpan(doc, el.id, i))
                }
              >
                ×
              </button>
            </div>
            <div className="apx-col-row">
              <span className="apx-field">
                <select
                  aria-label={c.columnLabel(i + 1)}
                  className="apx-mono"
                  value={span.key}
                  onChange={(e) =>
                    commitPatch(i, { key: e.currentTarget.value })
                  }
                >
                  {el.columns.map((column) => (
                    <option key={column.key} value={column.key}>
                      {column.key}
                    </option>
                  ))}
                  {el.columns.every((column) => column.key !== span.key) && (
                    <option value={span.key}>{span.key}</option>
                  )}
                </select>
              </span>
              {!isHeader && (
                <IntCell
                  ariaLabel={c.rowSpanLabel(i + 1)}
                  value={span.rowSpan ?? 1}
                  min={1}
                  invalid={error !== undefined}
                  onCommit={(rowSpan) => commitPatch(i, { rowSpan })}
                />
              )}
              <IntCell
                ariaLabel={c.colSpanLabel(i + 1)}
                value={span.colSpan ?? 1}
                min={1}
                invalid={error !== undefined}
                onCommit={(colSpan) => commitPatch(i, { colSpan })}
              />
            </div>
            {error !== undefined && <div className="apx-col-err">{error}</div>}
          </div>
        );
      })}
      <button
        type="button"
        className="apx-add-col"
        onClick={() => commitDoc((doc) => addTableCellSpan(doc, el.id))}
      >
        {c.addSpan}
      </button>
      <p className="apx-sect-note">{c.note}</p>
    </section>
  );
}
