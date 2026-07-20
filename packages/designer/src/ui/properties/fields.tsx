import type { IrStrokeStyle } from "@denreport/core";
import type { ReactNode } from "react";
import { useId } from "react";
import { useMessages } from "../../i18n/context.js";
import type { Messages } from "../../i18n/messages/index.js";
import { useDraftValue } from "./useDraftValue.js";

export type StrokeStyleLabels = Messages["properties"]["fields"]["strokeStyle"];

/** Options shared by line.strokeStyle and rect.borderStyle (display order is solid → dotted → dashed → dashdot → dashdotdot) */
export function strokeStyleOptions(
  labels: StrokeStyleLabels,
): readonly { readonly value: IrStrokeStyle; readonly label: string }[] {
  return [
    { value: "solid", label: labels.solid },
    { value: "dotted", label: labels.dotted },
    { value: "dashed", label: labels.dashed },
    { value: "dashdot", label: labels.dashdot },
    { value: "dashdotdot", label: labels.dashdotdot },
  ];
}

export interface NumberFieldProps {
  readonly label: string;
  /** null: values are mixed across a multi-selection (shown as empty + "mixed" placeholder) */
  readonly value: number | null;
  /** Just displays the unit suffix (no conversion) */
  readonly unit?: "mm" | "pt" | "°" | undefined;
  /** Quantization step: mm / pt = 0.1, lineHeight = 0.01, integer = 1 */
  readonly precision: number;
  /** Only receives quantized values. Not called for non-numeric or empty input. Same-value suppression only applies when value isn't mixed */
  readonly onCommit: (value: number) => void;
  readonly error?: string | undefined;
}

// Must use ceil (not round): when precision isn't a power of 10 (e.g. 0.05),
// too few decimal places causes the quantized value to drift on a blur with no actual change
function decimalsOf(precision: number): number {
  return Math.max(0, Math.ceil(Math.log10(1 / precision)));
}

function quantize(value: number, precision: number): number {
  const inverse = Math.round(1 / precision);
  return Math.round(value * inverse) / inverse;
}

export function NumberField(props: NumberFieldProps): ReactNode {
  const { label, value, unit, precision, onCommit, error } = props;
  const m = useMessages();
  const handlers = useDraftValue(
    value === null ? "" : value.toFixed(decimalsOf(precision)),
    (raw) => {
      const trimmed = raw.trim();
      if (trimmed === "") {
        return;
      }
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        return;
      }
      const next = quantize(parsed, precision);
      if (value === null || next !== value) {
        onCommit(next);
      }
    },
  );
  const id = useId();
  return (
    <div className="dr-frow">
      <label htmlFor={id}>{label}</label>
      <span className={`dr-field${error !== undefined ? " is-error" : ""}`}>
        <input
          id={id}
          className="dr-num"
          inputMode="decimal"
          placeholder={value === null ? m.properties.fields.mixed : undefined}
          value={handlers.draft}
          onChange={(e) => handlers.onChange(e.currentTarget.value)}
          onBlur={handlers.onBlur}
          onKeyDown={handlers.onKeyDown}
        />
        {unit !== undefined && <span className="dr-unit">{unit}</span>}
      </span>
      {error !== undefined && <span className="dr-ferr">{error}</span>}
    </div>
  );
}

export function TextField(props: {
  readonly label: string;
  readonly value: string;
  readonly onCommit: (value: string) => void;
  /** Identifiers (bind, font.name, key) are shown in mono */
  readonly mono?: boolean | undefined;
  readonly suggestions?: readonly string[] | undefined;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
}): ReactNode {
  const { label, value, onCommit, mono, suggestions, error, hint } = props;
  const handlers = useDraftValue(value, (raw) => {
    if (raw !== value) {
      onCommit(raw);
    }
  });
  const id = useId();
  const listId = `${id}-list`;
  return (
    <div className="dr-frow">
      <label htmlFor={id}>{label}</label>
      <span className={`dr-field${error !== undefined ? " is-error" : ""}`}>
        <input
          id={id}
          className={mono === true ? "dr-mono" : undefined}
          value={handlers.draft}
          list={suggestions !== undefined ? listId : undefined}
          onChange={(e) => handlers.onChange(e.currentTarget.value)}
          onBlur={handlers.onBlur}
          onKeyDown={handlers.onKeyDown}
        />
        {suggestions !== undefined && (
          <datalist id={listId}>
            {suggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        )}
      </span>
      {error !== undefined && <span className="dr-ferr">{error}</span>}
      {hint !== undefined && <span className="dr-fhint">{hint}</span>}
    </div>
  );
}

export function TextAreaField(props: {
  readonly label: string;
  readonly value: string;
  readonly onCommit: (value: string) => void;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
}): ReactNode {
  const { label, value, onCommit, error, hint } = props;
  const handlers = useDraftValue(value, (raw) => {
    if (raw !== value) {
      onCommit(raw);
    }
  });
  const id = useId();
  return (
    <div className="dr-frow">
      <label htmlFor={id}>{label}</label>
      <span
        className={`dr-field dr-field-multi${error !== undefined ? " is-error" : ""}`}
      >
        <textarea
          id={id}
          rows={3}
          value={handlers.draft}
          onChange={(e) => handlers.onChange(e.currentTarget.value)}
          onBlur={handlers.onBlur}
          onKeyDown={handlers.onKeyDown}
        />
      </span>
      {error !== undefined && <span className="dr-ferr">{error}</span>}
      {hint !== undefined && <span className="dr-fhint">{hint}</span>}
    </div>
  );
}

/** For enum attributes / mode switches. Calls onCommit immediately on change */
export function SegmentField<V extends string>(props: {
  readonly label: string;
  /** null: values are mixed across a multi-selection (no button is made is-active) */
  readonly value: V | null;
  readonly options: readonly { readonly value: V; readonly label: string }[];
  readonly onCommit: (value: V) => void;
}): ReactNode {
  return (
    <div className="dr-frow">
      <span className="dr-frow-label">{props.label}</span>
      <fieldset className="dr-seg" aria-label={props.label}>
        {props.options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={option.value === props.value ? "is-active" : undefined}
            onClick={() => {
              if (option.value !== props.value) {
                props.onCommit(option.value);
              }
            }}
          >
            {option.label}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

/** Color editing. When allowNone is set, includes a "none" toggle; none commits null */
export function ColorField(props: {
  readonly label: string;
  readonly value: string | null;
  readonly allowNone?: boolean;
  readonly noneLabel?: string;
  readonly onCommit: (value: string | null) => void;
}): ReactNode {
  const { label, value, allowNone = false, onCommit } = props;
  const m = useMessages();
  const noneLabel = props.noneLabel ?? m.properties.fields.none;
  const id = useId();
  const isNone = value === null;
  const swatch = value ?? "#000000";
  return (
    <div className="dr-frow">
      <label htmlFor={id}>{label}</label>
      <span className="dr-field dr-field-color">
        <input
          id={id}
          type="color"
          className="dr-color-input"
          value={swatch}
          disabled={allowNone && isNone}
          onChange={(e) => onCommit(e.currentTarget.value)}
        />
        {allowNone && (
          <label className="dr-color-none">
            <input
              type="checkbox"
              checked={isNone}
              onChange={(e) =>
                onCommit(e.currentTarget.checked ? null : swatch)
              }
            />
            {noneLabel}
          </label>
        )}
      </span>
    </div>
  );
}

/** Single selection via a native select (SegmentField would overflow its width with 5 options) */
export function SelectField<V extends string>(props: {
  readonly label: string;
  readonly value: V;
  readonly options: readonly { readonly value: V; readonly label: string }[];
  readonly onCommit: (value: V) => void;
}): ReactNode {
  const { label, value, options, onCommit } = props;
  const id = useId();
  return (
    <div className="dr-frow">
      <label htmlFor={id}>{label}</label>
      <span className="dr-field">
        <select
          id={id}
          value={value}
          onChange={(e) => onCommit(e.currentTarget.value as V)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </div>
  );
}
