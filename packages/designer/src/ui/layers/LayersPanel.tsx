import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMessages } from "../../i18n/context";
import { deleteElements } from "../../state/elements";
import { visibleInContext } from "../../state/geometry";
import type { LayerNode } from "../../state/layers";
import { buildLayerTree } from "../../state/layers";
import type { EditorStore } from "../../state/store";
import { useEditorState } from "../useEditorState";
import { LayerRow } from "./LayerRow";

/** Collects the ids of flex nodes that have any of targetIds among their descendants (candidates for uncollapsing) */
function collectFlexAncestors(
  nodes: readonly LayerNode[],
  targetIds: ReadonlySet<string>,
): readonly string[] {
  const result: string[] = [];

  function visit(list: readonly LayerNode[]): boolean {
    let containsTarget = false;
    for (const node of list) {
      const childContains =
        node.children !== null ? visit(node.children) : false;
      if (childContains) {
        result.push(node.id);
      }
      if (childContains || targetIds.has(node.id)) {
        containsTarget = true;
      }
    }
    return containsTarget;
  }

  visit(nodes);
  return result;
}

export function LayersPanel(props: {
  readonly store: EditorStore;
  /** Called after selection/context switching on row click (same contract as ValidationDrawer) */
  readonly onReveal: (id: string) => void;
}): ReactNode {
  const { store, onReveal } = props;
  const state = useEditorState(store);
  const m = useMessages();
  const tree = useMemo(() => buildLayerTree(state.document), [state.document]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const bodyRef = useRef<HTMLDivElement>(null);
  const selection = useMemo(() => new Set(state.selection), [state.selection]);

  // Collapsed state is a set of "currently collapsed flex ids". Stale ids left behind by element add/delete/undo are harmless
  const onToggle = useCallback((flexId: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(flexId)) {
        next.delete(flexId);
      } else {
        next.add(flexId);
      }
      return next;
    });
  }, []);

  const onSelect = useCallback(
    (node: LayerNode): void => {
      const current = store.getState();
      if (!visibleInContext(node.pages, current.view.pageContext)) {
        const pages = node.pages;
        if (pages !== null && pages !== "all") {
          store.setView({ pageContext: pages });
        }
      }
      store.setSelection([node.id]);
      onReveal(node.id);
    },
    [store, onReveal],
  );

  const onDelete = useCallback(
    (id: string): void => {
      const current = store.getState();
      const nextSelection = current.selection.filter((sid) => sid !== id);
      store.commit(deleteElements(current.document, [id]), nextSelection);
    },
    [store],
  );

  // Follows canvas selection, uncollapsing ancestor flex nodes that hide the selected element
  useEffect(() => {
    const targets = new Set(state.selection);
    if (targets.size === 0) {
      return;
    }
    const ancestors = collectFlexAncestors(tree, targets);
    if (ancestors.length === 0) {
      return;
    }
    setCollapsed((prev) => {
      if (ancestors.every((id) => !prev.has(id))) {
        return prev;
      }
      const next = new Set(prev);
      for (const id of ancestors) {
        next.delete(id);
      }
      return next;
    });
  }, [state.selection, tree]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: also follows changes to collapsed, since scrollIntoView must run after the row appears in the DOM once uncollapsed
  useEffect(() => {
    const first = state.selection[0];
    if (first === undefined) {
      return;
    }
    const row = bodyRef.current?.querySelector(`[data-dr-layer-id="${first}"]`);
    // jsdom does not implement scrollIntoView, so only call it on a real DOM
    if (
      row instanceof HTMLElement &&
      typeof row.scrollIntoView === "function"
    ) {
      row.scrollIntoView({ block: "nearest" });
    }
  }, [state.selection, collapsed]);

  return (
    <nav className="dr-layers" aria-label={m.layers.ariaLabel}>
      <div className="dr-panel-caption">{m.layers.caption}</div>
      <div className="dr-layers-body" ref={bodyRef}>
        {tree.length === 0 ? (
          <div className="dr-layers-empty">{m.layers.empty}</div>
        ) : (
          <ul className="dr-layer-list">
            {tree.map((node) => (
              <LayerRow
                key={node.id}
                node={node}
                depth={0}
                selection={selection}
                collapsed={collapsed}
                pageContext={state.view.pageContext}
                onToggle={onToggle}
                onSelect={onSelect}
                onDelete={onDelete}
              />
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
