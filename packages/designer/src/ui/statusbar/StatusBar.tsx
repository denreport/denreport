import type { ReactNode } from "react";
import { useMemo } from "react";
import { ELEMENT_TYPE_LABEL } from "../../state/element-labels";
import { layoutDocument } from "../../state/geometry";
import type { EditorStore } from "../../state/store";
import type { MmPoint } from "../canvas/interaction";
import { useEditorState } from "../useEditorState";

function fmt(value: number): string {
  return value.toFixed(1);
}

export function StatusBar(props: {
  readonly store: EditorStore;
  readonly cursorMm: MmPoint | null;
}): ReactNode {
  const state = useEditorState(props.store);
  const layout = useMemo(
    () => layoutDocument(state.document, state.view.pageContext),
    [state.document, state.view.pageContext],
  );

  let selectionSummary: ReactNode = null;
  if (state.selection.length === 1) {
    const id = state.selection[0];
    const view = layout.find((v) => v.id === id);
    if (view !== undefined) {
      selectionSummary = (
        <span>
          選択: <span className="apx-mono">{view.id}</span>（
          {ELEMENT_TYPE_LABEL[view.element.type]}）{" "}
          <span className="apx-mono">
            {fmt(view.box.x)}, {fmt(view.box.y)} / {fmt(view.box.w)}×
            {fmt(view.box.h)} mm
          </span>
        </span>
      );
    }
  } else if (state.selection.length > 1) {
    selectionSummary = <span>選択: {state.selection.length}個</span>;
  }

  return (
    <footer className="apx-statusbar">
      <span className="apx-mono apx-statusbar-cursor">
        {props.cursorMm !== null
          ? `x ${fmt(props.cursorMm.x)}  y ${fmt(props.cursorMm.y)}`
          : ""}
      </span>
      {selectionSummary}
      <span className="apx-statusbar-spacer" />
      <span className="apx-statusbar-saved">
        {state.dirty ? "未保存の変更あり" : "保存済み"}
      </span>
      <span className="apx-mono apx-statusbar-version">
        IR v{state.document.version}
      </span>
    </footer>
  );
}
