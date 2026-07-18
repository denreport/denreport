import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteElements } from "../../state/elements";
import { visibleInContext } from "../../state/geometry";
import type { LayerNode } from "../../state/layers";
import { buildLayerTree } from "../../state/layers";
import type { EditorStore } from "../../state/store";
import { useEditorState } from "../useEditorState";
import { LayerRow } from "./LayerRow";

/** targetIds のいずれかを子孫に持つ flex ノードの id を集める（折りたたみ解除の対象） */
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
  /** 行クリック時、選択・文脈切替の後に呼ぶ（ValidationDrawer と同じ契約） */
  readonly onReveal: (id: string) => void;
}): ReactNode {
  const { store, onReveal } = props;
  const state = useEditorState(store);
  const tree = useMemo(() => buildLayerTree(state.document), [state.document]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const bodyRef = useRef<HTMLDivElement>(null);
  const selection = useMemo(() => new Set(state.selection), [state.selection]);

  // 折りたたみは「折りたたみ中の flex id」の集合。要素の追加・削除・undo で不在 id が残っても無害
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

  // キャンバス選択に追随して、選択要素を隠している祖先 flex の折りたたみを解く
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: 折りたたみ解除で行が DOM に現れた後に scrollIntoView するため collapsed の変化にも追随する
  useEffect(() => {
    const first = state.selection[0];
    if (first === undefined) {
      return;
    }
    const row = bodyRef.current?.querySelector(
      `[data-apx-layer-id="${first}"]`,
    );
    // jsdom は scrollIntoView を実装しないため、実 DOM でのみ呼ぶ
    if (
      row instanceof HTMLElement &&
      typeof row.scrollIntoView === "function"
    ) {
      row.scrollIntoView({ block: "nearest" });
    }
  }, [state.selection, collapsed]);

  return (
    <nav className="apx-layers" aria-label="レイヤー">
      <div className="apx-panel-caption">レイヤー</div>
      <div className="apx-layers-body" ref={bodyRef}>
        {tree.length === 0 ? (
          <div className="apx-layers-empty">要素がありません</div>
        ) : (
          <ul className="apx-layer-list">
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
