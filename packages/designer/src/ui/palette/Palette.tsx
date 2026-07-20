import type { IrElementType } from "@denreport/core";
import type { ReactNode } from "react";
import { useMessages } from "../../i18n/context";
import type { CanvasInteraction } from "../canvas/useCanvasInteraction";
import { elementTypeIcon } from "../element-meta";

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
    <nav className="dr-palette" aria-label={m.palette.ariaLabel}>
      <div className="dr-panel-caption">{m.palette.caption}</div>
      <ul className="dr-pal-list">
        {PALETTE_ORDER.map((type) => {
          return (
            <li key={type}>
              <button
                type="button"
                className="dr-pal-item"
                onPointerDown={(e) => props.beginPlacement(type, e.nativeEvent)}
                onClick={() => props.onQuickAdd(type)}
              >
                <span className="dr-pal-icon" aria-hidden="true">
                  {elementTypeIcon(type, m)}
                </span>
                {m.elementTypes[type]}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="dr-pal-hint">{m.palette.hint}</div>
    </nav>
  );
}
