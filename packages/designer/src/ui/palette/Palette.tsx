import type { IrElementType } from "@denreport/core";
import type { ReactNode } from "react";
import { useMessages } from "../../i18n/context";
import type { CanvasInteraction } from "../canvas/useCanvasInteraction";
import { ELEMENT_TYPE_ICON } from "../element-meta";

const PALETTE_ORDER: readonly IrElementType[] = [
  "text",
  "line",
  "rect",
  "ellipse",
  "table",
  "image",
  "barcode",
  "flex",
  "pageNumber",
];

export function Palette(props: {
  readonly beginPlacement: CanvasInteraction["beginPlacement"];
  readonly onQuickAdd: (type: IrElementType) => void;
}): ReactNode {
  const m = useMessages();
  return (
    <nav className="apx-palette" aria-label="要素パレット">
      <div className="apx-panel-caption">要素</div>
      <ul className="apx-pal-list">
        {PALETTE_ORDER.map((type) => {
          return (
            <li key={type}>
              <button
                type="button"
                className="apx-pal-item"
                onPointerDown={(e) => props.beginPlacement(type, e.nativeEvent)}
                onClick={() => props.onQuickAdd(type)}
              >
                <span className="apx-pal-icon" aria-hidden="true">
                  {ELEMENT_TYPE_ICON[type]}
                </span>
                {m.elementTypes[type]}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="apx-pal-hint">クリックで中央に追加 / ドラッグで配置</div>
    </nav>
  );
}
