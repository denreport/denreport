import type { ReactNode } from "react";
import { useMemo } from "react";
import { useMessages } from "../../i18n/context";
import { errorsByElement } from "../../state/error-index";
import type { PlacedElementView } from "../../state/geometry";
import { layoutDocument } from "../../state/geometry";
import type { EditorStore } from "../../state/store";
import type { InteractionState } from "../canvas/interaction";
import { liveBoxFor } from "../canvas/interaction";
import { useEditorState } from "../useEditorState";
import { DocumentProperties } from "./DocumentProperties";
import { ElementProperties } from "./ElementProperties";
import { MultiElementProperties } from "./MultiElementProperties";

export function PropertiesPanel(props: {
  readonly store: EditorStore;
  readonly interaction: InteractionState;
}): ReactNode {
  const { store, interaction } = props;
  const m = useMessages();
  const state = useEditorState(store);
  const layout = useMemo(
    () => layoutDocument(state.document, state.view.pageContext),
    [state.document, state.view.pageContext],
  );
  const byId = new Map(layout.map((view) => [view.id, view]));
  // Treated as unselected when the selected id is not in the document (e.g. right after undo)
  const selected = state.selection
    .map((id) => byId.get(id))
    .filter((view): view is PlacedElementView => view !== undefined);
  const single = selected.length === 1 ? selected[0] : undefined;

  let content: ReactNode;
  if (selected.length === 0) {
    content = <DocumentProperties store={store} />;
  } else if (single !== undefined) {
    content = (
      <ElementProperties
        store={store}
        view={single}
        errors={
          errorsByElement(state.document, state.validationErrors).get(
            single.id,
          ) ?? []
        }
        liveBox={liveBoxFor(interaction, single)}
      />
    );
  } else {
    content = <MultiElementProperties store={store} views={selected} />;
  }

  return (
    <aside className="apx-props" aria-label={m.toolbar.propertiesPanel}>
      {content}
    </aside>
  );
}
