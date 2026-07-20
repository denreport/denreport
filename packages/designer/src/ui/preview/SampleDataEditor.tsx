import type { ReactNode } from "react";
import { useId } from "react";
import { useMessages } from "../../i18n/context";
import { useDraftValue } from "../properties/useDraftValue";

/** Direct JSON editing of sample data. Commits on blur (Enter in the textarea inserts
    a newline); invalid JSON does not block committing (the storage format is a string) */
export function SampleDataEditor(props: {
  readonly value: string;
  readonly onCommit: (json: string) => void;
  readonly onGenerate: () => void;
  readonly parseError: string | undefined;
}): ReactNode {
  const { value, onCommit, onGenerate, parseError } = props;
  const m = useMessages().sampleData;
  const handlers = useDraftValue(value, (raw) => {
    if (raw !== value) {
      onCommit(raw);
    }
  });
  const id = useId();
  return (
    <div className="dr-sample">
      <label className="dr-sect-h" htmlFor={id}>
        {m.label}
      </label>
      <span
        className={`dr-field dr-field-multi dr-sample-field${
          parseError !== undefined ? " is-error" : ""
        }`}
      >
        <textarea
          id={id}
          className="dr-mono"
          rows={18}
          value={handlers.draft}
          onChange={(e) => handlers.onChange(e.currentTarget.value)}
          onBlur={handlers.onBlur}
          onKeyDown={handlers.onKeyDown}
        />
      </span>
      {parseError !== undefined && (
        <p className="dr-sample-err">{parseError}</p>
      )}
      <button
        type="button"
        className="dr-btn dr-btn-secondary"
        onClick={onGenerate}
      >
        {m.generate}
      </button>
    </div>
  );
}
