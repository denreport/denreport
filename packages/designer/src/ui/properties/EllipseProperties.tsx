import type { ReactNode } from "react";
import { useMessages } from "../../i18n/context";
import { errorMessageFor } from "../../state/error-index";
import type { ElementFormProps } from "./ElementProperties";
import { commitReplace, withOptionalAttr } from "./ElementProperties";
import { ColorField, NumberField } from "./fields";

export function EllipseProperties(props: ElementFormProps): ReactNode {
  const { store, view, errors, liveBox } = props;
  const el = view.element;
  const m = useMessages();
  if (el.type !== "ellipse") {
    return null;
  }
  const w = liveBox === null ? el.w : liveBox.w;
  const h = liveBox === null ? el.h : liveBox.h;
  return (
    <>
      <section className="apx-sect">
        <div className="apx-sect-h">{m.properties.placement}</div>
        {"x" in el && (
          <>
            <NumberField
              label="x"
              value={liveBox === null ? el.x : liveBox.x}
              unit="mm"
              precision={0.1}
              error={errorMessageFor(errors, "x")}
              onCommit={(x) => commitReplace(store, el.id, { ...el, x })}
            />
            <NumberField
              label="y"
              value={liveBox === null ? el.y : liveBox.y}
              unit="mm"
              precision={0.1}
              error={errorMessageFor(errors, "y")}
              onCommit={(y) => commitReplace(store, el.id, { ...el, y })}
            />
          </>
        )}
        <NumberField
          label="w"
          value={w}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "w")}
          onCommit={(w) => commitReplace(store, el.id, { ...el, w })}
        />
        <NumberField
          label="h"
          value={h}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "h")}
          onCommit={(h) => commitReplace(store, el.id, { ...el, h })}
        />
      </section>
      <section className="apx-sect">
        <div className="apx-sect-h">{m.properties.border.section}</div>
        <NumberField
          label={m.properties.border.width}
          value={el.borderWidth}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "borderWidth")}
          onCommit={(borderWidth) =>
            commitReplace(store, el.id, { ...el, borderWidth })
          }
        />
        <ColorField
          label={m.properties.border.color}
          value={el.borderColor ?? null}
          onCommit={(borderColor) =>
            commitReplace(
              store,
              el.id,
              withOptionalAttr(
                el,
                "borderColor",
                borderColor === null || borderColor === "#000000"
                  ? undefined
                  : borderColor,
              ),
            )
          }
        />
      </section>
      <section className="apx-sect">
        <div className="apx-sect-h">{m.properties.fill.section}</div>
        <ColorField
          label={m.properties.fill.color}
          value={el.fillColor ?? null}
          allowNone
          onCommit={(fillColor) =>
            commitReplace(
              store,
              el.id,
              withOptionalAttr(el, "fillColor", fillColor ?? undefined),
            )
          }
        />
      </section>
    </>
  );
}
