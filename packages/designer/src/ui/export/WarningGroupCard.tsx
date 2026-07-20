import type { ReactNode } from "react";
import { useMessages } from "../../i18n/context.js";
import type { CompatWarningGroup } from "../../state/export-warnings.js";

/** Card display for one compat-finding group (level + userMessage). Shared by the export
    dialog and the validation pane */
export function WarningGroupCard(props: {
  readonly group: CompatWarningGroup;
  readonly onJump: (id: string) => void;
}): ReactNode {
  const { group, onJump } = props;
  const m = useMessages();
  return (
    <div className={`dr-warn-card is-${group.level}`}>
      <p className="dr-warn-note">
        <b className="dr-warn-mark" aria-hidden="true">
          !
        </b>
        <span className="dr-warn-level">
          {m.export.compatLevel[group.level]}
        </span>
        <span>{group.userMessage}</span>
        <span className="dr-warn-count">
          {m.export.findingCount(group.findingCount)}
        </span>
      </p>
      <div className="dr-warn-chips">
        {group.elementIds.map((id) => (
          <button
            key={id}
            type="button"
            className="dr-chip"
            onClick={() => onJump(id)}
          >
            {id}
          </button>
        ))}
      </div>
    </div>
  );
}
