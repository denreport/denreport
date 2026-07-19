import type { ReactNode } from "react";
import { useMessages } from "../../i18n/context";
import type { SampleScenarioSet } from "../../state/sample-scenarios";
import { useDraftValue } from "../properties/useDraftValue";

/** シナリオ選択・名称変更・追加/複製/削除の操作列。表示のみで、状態遷移の判断
    （削除確認・純関数の適用）は呼び出し側が行う */
export function ScenarioBar(props: {
  readonly scenarios: SampleScenarioSet;
  readonly onSelect: (id: string) => void;
  readonly onAdd: () => void;
  readonly onDuplicate: () => void;
  readonly onRemove: () => void;
  readonly onRename: (name: string) => void;
}): ReactNode {
  const { scenarios, onSelect, onAdd, onDuplicate, onRemove, onRename } = props;
  const m = useMessages().scenarios;
  const activeName =
    scenarios.items.find((item) => item.id === scenarios.activeId)?.name ?? "";
  const nameHandlers = useDraftValue(activeName, (raw) => {
    if (raw !== activeName) {
      onRename(raw);
    }
  });

  return (
    <div className="apx-scenariobar">
      <span className="apx-field apx-scenariobar-select">
        <select
          aria-label={m.selectAriaLabel}
          value={scenarios.activeId}
          onChange={(e) => onSelect(e.currentTarget.value)}
        >
          {scenarios.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </span>
      <span className="apx-field apx-scenariobar-name">
        <input
          aria-label={m.nameAriaLabel}
          value={nameHandlers.draft}
          onChange={(e) => nameHandlers.onChange(e.currentTarget.value)}
          onBlur={nameHandlers.onBlur}
          onKeyDown={nameHandlers.onKeyDown}
        />
      </span>
      <button
        type="button"
        className="apx-btn apx-btn-secondary"
        onClick={onAdd}
      >
        {m.add}
      </button>
      <button
        type="button"
        className="apx-btn apx-btn-secondary"
        onClick={onDuplicate}
      >
        {m.duplicate}
      </button>
      <button
        type="button"
        className="apx-btn apx-btn-secondary"
        disabled={scenarios.items.length === 1}
        onClick={onRemove}
      >
        {m.remove}
      </button>
    </div>
  );
}
