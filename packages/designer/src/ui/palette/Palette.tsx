import type { IrElementType } from "@denreport/core";
import type { ReactNode } from "react";
import { useMessages } from "../../i18n/context";
import type { CanvasInteraction } from "../canvas/useCanvasInteraction";
import { ELEMENT_TYPE_META } from "../element-meta";

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
    <nav className="apx-palette" aria-label={m.palette.ariaLabel}>
      <div className="apx-panel-caption">{m.palette.caption}</div>
      <ul className="apx-pal-list">
        {PALETTE_ORDER.map((type) => {
          const meta = ELEMENT_TYPE_META[type];
          return (
            <li key={type}>
              <button
                type="button"
                className="apx-pal-item"
                onPointerDown={(e) => props.beginPlacement(type, e.nativeEvent)}
                onClick={() => props.onQuickAdd(type)}
              >
                <span className="apx-pal-icon" aria-hidden="true">
                  {meta.icon}
                </span>
                {meta.label}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="apx-pal-hint">{m.palette.hint}</div>
    </nav>
  );
}
