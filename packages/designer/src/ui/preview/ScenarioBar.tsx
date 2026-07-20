import type { ReactNode } from "react";
import { useMessages } from "../../i18n/context";
import type { SampleScenarioSet } from "../../state/sample-scenarios";
import { useDraftValue } from "../properties/useDraftValue";

/** The action row for scenario selection, renaming, and add/duplicate/delete. Display only;
    state-transition decisions (delete confirmation, applying the pure functions) are made by
    the caller */
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
    <div className="dr-scenariobar">
      <span className="dr-field dr-scenariobar-select">
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
      <span className="dr-field dr-scenariobar-name">
        <input
          aria-label={m.nameAriaLabel}
          value={nameHandlers.draft}
          onChange={(e) => nameHandlers.onChange(e.currentTarget.value)}
          onBlur={nameHandlers.onBlur}
          onKeyDown={nameHandlers.onKeyDown}
        />
      </span>
      <button type="button" className="dr-btn dr-btn-secondary" onClick={onAdd}>
        {m.add}
      </button>
      <button
        type="button"
        className="dr-btn dr-btn-secondary"
        onClick={onDuplicate}
      >
        {m.duplicate}
      </button>
      <button
        type="button"
        className="dr-btn dr-btn-secondary"
        disabled={scenarios.items.length === 1}
        onClick={onRemove}
      >
        {m.remove}
      </button>
    </div>
  );
}
