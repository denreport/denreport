import type { ReactNode } from "react";
import { useMessages } from "../../i18n/context";
import {
  ENVELOPE_PRESETS,
  type EnvelopePresetId,
} from "../../state/envelope-presets";
import type { EditorStore } from "../../state/store";
import type { PageContext } from "../../state/types";
import { useEditorState } from "../useEditorState";
import { AlignmentButtons } from "./AlignmentButtons";
import { zoomStepIn, zoomStepOut } from "./zoom";

const CONTEXTS: readonly {
  readonly value: PageContext;
  readonly label: string;
}[] = [
  { value: "first", label: "1ページ目" },
  { value: "rest", label: "継続ページ" },
  { value: "last", label: "最終ページ" },
];

export function CanvasBar(props: { readonly store: EditorStore }): ReactNode {
  const { store } = props;
  const m = useMessages();
  const state = useEditorState(store);
  const { view } = state;
  const lower = zoomStepOut(view.zoom);
  const higher = zoomStepIn(view.zoom);
  const page = state.document.page;
  const envelopeEnabled = page.width === 210 && page.height === 297;
  return (
    <div className="apx-canvasbar">
      <span className="apx-canvasbar-label">編集ページ</span>
      <fieldset className="apx-seg" aria-label="ページ文脈">
        {CONTEXTS.map((c) => (
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
      <span className="apx-toolbar-spacer" />
      <AlignmentButtons store={store} />
      <button
        type="button"
        className={`apx-tbtn${view.snapEnabled ? " is-on" : ""}`}
        aria-pressed={view.snapEnabled}
        onClick={() => store.setView({ snapEnabled: !view.snapEnabled })}
      >
        スナップ
      </button>
      <button
        type="button"
        className={`apx-tbtn${view.gridVisible ? " is-on" : ""}`}
        aria-pressed={view.gridVisible}
        onClick={() => store.setView({ gridVisible: !view.gridVisible })}
      >
        グリッド
      </button>
      <span className="apx-field">
        <select
          aria-label="封筒窓ガイド"
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
          <option value="">封筒窓: なし</option>
          {ENVELOPE_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {m.envelopePresets[preset.id]}
            </option>
          ))}
        </select>
      </span>
      <span className="apx-toolbar-sep" />
      <button
        type="button"
        className="apx-tbtn"
        aria-label="縮小"
        disabled={lower === null}
        onClick={() => lower !== null && store.setView({ zoom: lower })}
      >
        −
      </button>
      <span className="apx-zoom-value apx-mono">
        {Math.round(view.zoom * 100)}%
      </span>
      <button
        type="button"
        className="apx-tbtn"
        aria-label="拡大"
        disabled={higher === null}
        onClick={() => higher !== null && store.setView({ zoom: higher })}
      >
        ＋
      </button>
    </div>
  );
}
