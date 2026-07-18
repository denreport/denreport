import type { ReactNode } from "react";
import { useId } from "react";
import { useDraftValue } from "../properties/useDraftValue";

/** サンプルデータの JSON 直接編集。blur で確定し（textarea の Enter は改行）、
    不正 JSON でも確定は妨げない（保持形式が文字列であるため） */
export function SampleDataEditor(props: {
  readonly value: string;
  readonly onCommit: (json: string) => void;
  readonly onGenerate: () => void;
  readonly parseError: string | undefined;
}): ReactNode {
  const { value, onCommit, onGenerate, parseError } = props;
  const handlers = useDraftValue(value, (raw) => {
    if (raw !== value) {
      onCommit(raw);
    }
  });
  const id = useId();
  return (
    <div className="apx-sample">
      <label className="apx-sect-h" htmlFor={id}>
        サンプルデータ (JSON)
      </label>
      <span
        className={`apx-field apx-field-multi apx-sample-field${
          parseError !== undefined ? " is-error" : ""
        }`}
      >
        <textarea
          id={id}
          className="apx-mono"
          rows={18}
          value={handlers.draft}
          onChange={(e) => handlers.onChange(e.currentTarget.value)}
          onBlur={handlers.onBlur}
          onKeyDown={handlers.onKeyDown}
        />
      </span>
      {parseError !== undefined && (
        <p className="apx-sample-err">{parseError}</p>
      )}
      <button
        type="button"
        className="apx-btn apx-btn-secondary"
        onClick={onGenerate}
      >
        bind キーから生成
      </button>
    </div>
  );
}
