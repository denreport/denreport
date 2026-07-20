import type { ReactNode } from "react";
import { useMessages } from "../../i18n/context";
import type { Messages } from "../../i18n/messages";
import type { AlignKind, DistributeAxis } from "../../state/alignment";
import { alignSelection, distributeSelection } from "../../state/commands";
import type { EditorStore } from "../../state/store";
import { useEditorState } from "../useEditorState";

const ALIGN_BUTTONS: readonly {
  readonly kind: AlignKind;
  readonly icon: ReactNode;
}[] = [
  {
    kind: "left",
    icon: (
      <>
        <path strokeWidth="1.3" d="M2 1.5v13" />
        <rect
          x="2"
          y="4"
          width="8"
          height="2.2"
          fill="currentColor"
          stroke="none"
        />
        <rect
          x="2"
          y="9.8"
          width="5"
          height="2.2"
          fill="currentColor"
          stroke="none"
        />
      </>
    ),
  },
  {
    kind: "hcenter",
    icon: (
      <>
        <path strokeWidth="1.3" d="M8 1.5v13" />
        <rect
          x="4"
          y="4"
          width="8"
          height="2.2"
          fill="currentColor"
          stroke="none"
        />
        <rect
          x="5.5"
          y="9.8"
          width="5"
          height="2.2"
          fill="currentColor"
          stroke="none"
        />
      </>
    ),
  },
  {
    kind: "right",
    icon: (
      <>
        <path strokeWidth="1.3" d="M14 1.5v13" />
        <rect
          x="6"
          y="4"
          width="8"
          height="2.2"
          fill="currentColor"
          stroke="none"
        />
        <rect
          x="9"
          y="9.8"
          width="5"
          height="2.2"
          fill="currentColor"
          stroke="none"
        />
      </>
    ),
  },
  {
    kind: "top",
    icon: (
      <>
        <path strokeWidth="1.3" d="M1.5 2h13" />
        <rect
          x="4"
          y="2"
          width="2.2"
          height="8"
          fill="currentColor"
          stroke="none"
        />
        <rect
          x="9.8"
          y="2"
          width="2.2"
          height="5"
          fill="currentColor"
          stroke="none"
        />
      </>
    ),
  },
  {
    kind: "vcenter",
    icon: (
      <>
        <path strokeWidth="1.3" d="M1.5 8h13" />
        <rect
          x="4"
          y="4"
          width="2.2"
          height="8"
          fill="currentColor"
          stroke="none"
        />
        <rect
          x="9.8"
          y="5.5"
          width="2.2"
          height="5"
          fill="currentColor"
          stroke="none"
        />
      </>
    ),
  },
  {
    kind: "bottom",
    icon: (
      <>
        <path strokeWidth="1.3" d="M1.5 14h13" />
        <rect
          x="4"
          y="6"
          width="2.2"
          height="8"
          fill="currentColor"
          stroke="none"
        />
        <rect
          x="9.8"
          y="9"
          width="2.2"
          height="5"
          fill="currentColor"
          stroke="none"
        />
      </>
    ),
  },
];

const DISTRIBUTE_BUTTONS: readonly {
  readonly axis: DistributeAxis;
  readonly icon: ReactNode;
}[] = [
  {
    axis: "horizontal",
    icon: (
      <>
        <rect
          x="1.5"
          y="4"
          width="2.2"
          height="8"
          fill="currentColor"
          stroke="none"
        />
        <rect
          x="6.9"
          y="4"
          width="2.2"
          height="8"
          fill="currentColor"
          stroke="none"
        />
        <rect
          x="12.3"
          y="4"
          width="2.2"
          height="8"
          fill="currentColor"
          stroke="none"
        />
      </>
    ),
  },
  {
    axis: "vertical",
    icon: (
      <>
        <rect
          x="4"
          y="1.5"
          width="8"
          height="2.2"
          fill="currentColor"
          stroke="none"
        />
        <rect
          x="4"
          y="6.9"
          width="8"
          height="2.2"
          fill="currentColor"
          stroke="none"
        />
        <rect
          x="4"
          y="12.3"
          width="8"
          height="2.2"
          fill="currentColor"
          stroke="none"
        />
      </>
    ),
  },
];

function Icon(props: { readonly children: ReactNode }): ReactNode {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {props.children}
    </svg>
  );
}

function alignLabels(m: Messages): Record<AlignKind, string> {
  return {
    left: m.canvas.alignLeft,
    hcenter: m.canvas.alignHCenter,
    right: m.canvas.alignRight,
    top: m.canvas.alignTop,
    vcenter: m.canvas.alignVCenter,
    bottom: m.canvas.alignBottom,
  };
}

function distributeLabels(m: Messages): Record<DistributeAxis, string> {
  return {
    horizontal: m.canvas.distributeHorizontal,
    vertical: m.canvas.distributeVertical,
  };
}

export function AlignmentButtons(props: {
  readonly store: EditorStore;
}): ReactNode {
  const { store } = props;
  const state = useEditorState(store);
  const m = useMessages();
  const idSet = new Set(state.selection);
  const topLevelCount = state.document.elements.filter((el) =>
    idSet.has(el.id),
  ).length;
  if (topLevelCount < 2) {
    return null;
  }
  const canDistribute = topLevelCount >= 3;
  const alignLabel = alignLabels(m);
  const distributeLabel = distributeLabels(m);
  return (
    <>
      {ALIGN_BUTTONS.map((btn) => (
        <button
          key={btn.kind}
          type="button"
          className="dr-tbtn"
          aria-label={alignLabel[btn.kind]}
          title={alignLabel[btn.kind]}
          onClick={() => alignSelection(store, btn.kind)}
        >
          <Icon>{btn.icon}</Icon>
        </button>
      ))}
      {DISTRIBUTE_BUTTONS.map((btn) => (
        <button
          key={btn.axis}
          type="button"
          className="dr-tbtn"
          aria-label={distributeLabel[btn.axis]}
          title={distributeLabel[btn.axis]}
          disabled={!canDistribute}
          onClick={() => distributeSelection(store, btn.axis)}
        >
          <Icon>{btn.icon}</Icon>
        </button>
      ))}
      <span className="dr-toolbar-sep" />
    </>
  );
}
