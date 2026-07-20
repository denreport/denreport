import type { ReactNode } from "react";
import { useMemo } from "react";
import { useMessages } from "../../i18n/context.js";
import { errorsByElement } from "../../state/error-index.js";
import type { PlacedElementView } from "../../state/geometry.js";
import { layoutDocument } from "../../state/geometry.js";
import type { EditorStore } from "../../state/store.js";
import type { InteractionState } from "../canvas/interaction.js";
import { liveBoxFor } from "../canvas/interaction.js";
import { useEditorState } from "../useEditorState.js";
import { DocumentProperties } from "./DocumentProperties.js";
import { ElementProperties } from "./ElementProperties.js";
import { MultiElementProperties } from "./MultiElementProperties.js";

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
    <aside className="dr-props" aria-label={m.toolbar.propertiesPanel}>
      {content}
    </aside>
  );
}
