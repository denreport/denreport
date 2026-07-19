import type { IrStrokeStyle } from "@denreport/core";
import type { ReactNode } from "react";
import { useId } from "react";
import { useMessages } from "../../i18n/context";
import type { Messages } from "../../i18n/messages";
import { useDraftValue } from "./useDraftValue";

export type StrokeStyleLabels = Messages["properties"]["fields"]["strokeStyle"];

/** line.strokeStyle・rect.borderStyle 共通の選択肢（表示順は実線→点線→破線→一点鎖線→二点鎖線） */
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
  /** null: 複数選択で値が混在（空欄 + placeholder「混在」表示） */
  readonly value: number | null;
  /** 単位サフィックスの表示のみ（換算はしない） */
  readonly unit?: "mm" | "pt" | "°" | undefined;
  /** 量子化の刻み: mm / pt = 0.1、lineHeight = 0.01、整数 = 1 */
  readonly precision: number;
  /** 量子化済みの値のみ渡る。非数値・空文字では呼ばれない。同値抑止は value が混在でないときのみ */
  readonly onCommit: (value: number) => void;
  readonly error?: string | undefined;
}

// ceil（round ではなく）でないと precision が10のべき乗でない場合（例: 0.05）に
// 桁数が足りず、値を変更せず blur しただけで quantize 後の値が丸まってずれる
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
    <div className="apx-frow">
      <label htmlFor={id}>{label}</label>
      <span className={`apx-field${error !== undefined ? " is-error" : ""}`}>
        <input
          id={id}
          className="apx-num"
          inputMode="decimal"
          placeholder={value === null ? m.properties.fields.mixed : undefined}
          value={handlers.draft}
          onChange={(e) => handlers.onChange(e.currentTarget.value)}
          onBlur={handlers.onBlur}
          onKeyDown={handlers.onKeyDown}
        />
        {unit !== undefined && <span className="apx-unit">{unit}</span>}
      </span>
      {error !== undefined && <span className="apx-ferr">{error}</span>}
    </div>
  );
}

export function TextField(props: {
  readonly label: string;
  readonly value: string;
  readonly onCommit: (value: string) => void;
  /** 識別子（bind・font.name・key）は mono 表示 */
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
    <div className="apx-frow">
      <label htmlFor={id}>{label}</label>
      <span className={`apx-field${error !== undefined ? " is-error" : ""}`}>
        <input
          id={id}
          className={mono === true ? "apx-mono" : undefined}
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
      {error !== undefined && <span className="apx-ferr">{error}</span>}
      {hint !== undefined && <span className="apx-fhint">{hint}</span>}
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
    <div className="apx-frow">
      <label htmlFor={id}>{label}</label>
      <span
        className={`apx-field apx-field-multi${error !== undefined ? " is-error" : ""}`}
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
      {error !== undefined && <span className="apx-ferr">{error}</span>}
      {hint !== undefined && <span className="apx-fhint">{hint}</span>}
    </div>
  );
}

/** enum 属性・モード切替。変更で即 onCommit する */
export function SegmentField<V extends string>(props: {
  readonly label: string;
  /** null: 複数選択で値が混在（どのボタンも is-active にしない） */
  readonly value: V | null;
  readonly options: readonly { readonly value: V; readonly label: string }[];
  readonly onCommit: (value: V) => void;
}): ReactNode {
  return (
    <div className="apx-frow">
      <span className="apx-frow-label">{props.label}</span>
      <fieldset className="apx-seg" aria-label={props.label}>
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

/** 色の編集。allowNone 時は「なし」トグル付きで、なし = null を commit する */
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
    <div className="apx-frow">
      <label htmlFor={id}>{label}</label>
      <span className="apx-field apx-field-color">
        <input
          id={id}
          type="color"
          className="apx-color-input"
          value={swatch}
          disabled={allowNone && isNone}
          onChange={(e) => onCommit(e.currentTarget.value)}
        />
        {allowNone && (
          <label className="apx-color-none">
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

/** ネイティブ select による単一選択（SegmentField は5択で幅超過するため） */
export function SelectField<V extends string>(props: {
  readonly label: string;
  readonly value: V;
  readonly options: readonly { readonly value: V; readonly label: string }[];
  readonly onCommit: (value: V) => void;
}): ReactNode {
  const { label, value, options, onCommit } = props;
  const id = useId();
  return (
    <div className="apx-frow">
      <label htmlFor={id}>{label}</label>
      <span className="apx-field">
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
