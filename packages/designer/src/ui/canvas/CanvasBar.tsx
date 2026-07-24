import type { ReactNode } from "react";
import { useMessages } from "../../i18n/context.js";
import {
  ENVELOPE_PRESETS,
  type EnvelopePresetId,
} from "../../state/envelope-presets.js";
import type { EditorStore } from "../../state/store.js";
import type { PageContext } from "../../state/types.js";
import { useEditorState } from "../useEditorState.js";
import { AlignmentButtons } from "./AlignmentButtons.js";
import { zoomStepIn, zoomStepOut } from "./zoom.js";

export function CanvasBar(props: { readonly store: EditorStore }): ReactNode {
  const { store } = props;
  const m = useMessages();
  const state = useEditorState(store);
  const { view } = state;
  const lower = zoomStepOut(view.zoom);
  const higher = zoomStepIn(view.zoom);
  const page = state.document.page;
  const envelopeEnabled = page.width === 210 && page.height === 297;
  const contexts: readonly {
    readonly value: PageContext;
    readonly label: string;
  }[] = [
    { value: "first", label: m.canvas.pageContextFirst },
    { value: "rest", label: m.canvas.pageContextRest },
    { value: "last", label: m.canvas.pageContextLast },
  ];
  return (
    <div className="dr-canvasbar">
      <span className="dr-canvasbar-label">{m.canvas.editPage}</span>
      <fieldset className="dr-seg" aria-label={m.canvas.pageContext}>
        {contexts.map((c) => (
          <button
            key={c.value}
            type="button"
            className={c.value === view.pageContext ? "is-active" : undefined}
            onClick={() => store.setView({ pageContext: c.value })}
          >
            {c.label}
          </button>
        ))}
      </fieldset>
      <span className="dr-toolbar-spacer" />
      <AlignmentButtons store={store} />
      <button
        type="button"
        className={`dr-tbtn${view.snapEnabled ? " is-on" : ""}`}
        aria-pressed={view.snapEnabled}
        onClick={() => store.setView({ snapEnabled: !view.snapEnabled })}
      >
        {m.canvas.snap}
      </button>
      <button
        type="button"
        className={`dr-tbtn${view.gridVisible ? " is-on" : ""}`}
        aria-pressed={view.gridVisible}
        onClick={() => store.setView({ gridVisible: !view.gridVisible })}
      >
        {m.canvas.grid}
      </button>
      <span className="dr-field">
        <select
          aria-label={m.canvas.envelopeGuide}
          disabled={!envelopeEnabled}
          value={state.envelopePresetId ?? ""}
          onChange={(e) =>
            store.setEnvelopePreset(
              e.currentTarget.value === ""
                ? null
                : (e.currentTarget.value as EnvelopePresetId),
            )
          }
        >
          <option value="">{m.canvas.envelopeNone}</option>
          {ENVELOPE_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {m.envelopePresets[preset.id]}
            </option>
          ))}
        </select>
      </span>
      <span className="dr-toolbar-sep" />
      <button
        type="button"
        className="dr-tbtn"
        aria-label={m.canvas.zoomOut}
        disabled={lower === null}
        onClick={() => lower !== null && store.setView({ zoom: lower })}
      >
        −
      </button>
      <span className="dr-zoom-value dr-mono">
        {Math.round(view.zoom * 100)}%
      </span>
      <button
        type="button"
        className="dr-tbtn"
        aria-label={m.canvas.zoomIn}
        disabled={higher === null}
        onClick={() => higher !== null && store.setView({ zoom: higher })}
      >
        +
      </button>
    </div>
  );
}
