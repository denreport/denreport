import type { ReactNode } from "react";
import type { CompatWarningGroup } from "../../state/export-warnings";

const COMPAT_LEVEL_LABELS: Readonly<
  Record<CompatWarningGroup["level"], string>
> = {
  approximated: "近似",
  unsupported: "非対応",
};

/** 互換性判定1グループ（level + userMessage）のカード表示。書き出しダイアログと検証ペインで共有する */
export function WarningGroupCard(props: {
  readonly group: CompatWarningGroup;
  readonly onJump: (id: string) => void;
}): ReactNode {
  const { group, onJump } = props;
  return (
    <div className={`apx-warn-card is-${group.level}`}>
      <p className="apx-warn-note">
        <b className="apx-warn-mark" aria-hidden="true">
          !
        </b>
        <span className="apx-warn-level">
          {COMPAT_LEVEL_LABELS[group.level]}
        </span>
        <span>{group.userMessage}</span>
        <span className="apx-warn-count">{group.findingCount} 箇所</span>
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
