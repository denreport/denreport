import type { CSSProperties, ReactNode } from "react";
import { useMessages } from "../../i18n/context";
import { visibleInContext } from "../../state/geometry";
import type { LayerNode } from "../../state/layers";
import { layerLabel } from "../../state/layers";
import type { PageContext } from "../../state/types";
import { ELEMENT_TYPE_ICON } from "../element-meta";

export function LayerRow(props: {
  readonly node: LayerNode;
  readonly depth: number;
  readonly selection: ReadonlySet<string>;
  readonly collapsed: ReadonlySet<string>;
  readonly pageContext: PageContext;
  readonly onToggle: (flexId: string) => void;
  readonly onSelect: (node: LayerNode) => void;
  readonly onDelete: (id: string) => void;
}): ReactNode {
  const {
    node,
    depth,
    selection,
    collapsed,
    pageContext,
    onToggle,
    onSelect,
    onDelete,
  } = props;
  const m = useMessages();
  const isFlex = node.children !== null;
  const isCollapsed = isFlex && collapsed.has(node.id);
  const icon = ELEMENT_TYPE_ICON[node.element.type];

  const classes = ["apx-layer-row"];
  if (selection.has(node.id)) {
    classes.push("is-selected");
  }
  if (!visibleInContext(node.pages, pageContext)) {
    classes.push("is-otherpage");
  }

  return (
    <li>
      <div
        className={classes.join(" ")}
        style={{ "--depth": depth } as CSSProperties}
        data-apx-layer-id={node.id}
      >
        {isFlex ? (
          <button
            type="button"
            className="apx-layer-caret"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "展開" : "折りたたむ"}
            onClick={() => onToggle(node.id)}
          >
            {isCollapsed ? "▸" : "▾"}
          </button>
        ) : (
          <span className="apx-layer-caret-spacer" aria-hidden="true" />
        )}
        <button
          type="button"
          className="apx-layer-main"
          title={node.id}
          onClick={() => onSelect(node)}
        >
          <span className="apx-layer-icon" aria-hidden="true">
            {icon}
          </span>
          <span className="apx-layer-label">
            {layerLabel(
              node.element,
              m.elementTypes,
              m.defaults.imagePlaceholder,
            )}
          </span>
        </button>
        <button
          type="button"
          className="apx-layer-del"
          aria-label="削除"
          onClick={() => onDelete(node.id)}
        >
          ×
        </button>
      </div>
      {isFlex && !isCollapsed && node.children !== null && (
        <ul className="apx-layer-children">
          {node.children.map((child) => (
            <LayerRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selection={selection}
              collapsed={collapsed}
              pageContext={pageContext}
              onToggle={onToggle}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
