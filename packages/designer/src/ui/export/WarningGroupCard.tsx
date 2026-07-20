import type { ReactNode } from "react";
import { useMessages } from "../../i18n/context";
import type { CompatWarningGroup } from "../../state/export-warnings";

/** Card display for one compat-finding group (level + userMessage). Shared by the export
    dialog and the validation pane */
export function WarningGroupCard(props: {
  readonly group: CompatWarningGroup;
  readonly onJump: (id: string) => void;
}): ReactNode {
  const { group, onJump } = props;
  const m = useMessages();
  return (
    <div className={`apx-warn-card is-${group.level}`}>
      <p className="apx-warn-note">
        <b className="apx-warn-mark" aria-hidden="true">
          !
        </b>
        <span className="apx-warn-level">
          {m.export.compatLevel[group.level]}
        </span>
        <span>{group.userMessage}</span>
        <span className="apx-warn-count">
          {m.export.findingCount(group.findingCount)}
        </span>
      </p>
      <div className="apx-warn-chips">
        {group.elementIds.map((id) => (
          <button
            key={id}
            type="button"
            className="apx-chip"
            onClick={() => onJump(id)}
          >
            {id}
          </button>
        ))}
      </div>
    </div>
  );
}
