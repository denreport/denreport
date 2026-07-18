import type { ReactNode } from "react";
import { errorMessageFor } from "../../state/error-index";
import type { ElementFormProps } from "./ElementProperties";
import { commitReplace, withOptionalAttr } from "./ElementProperties";
import {
  ColorField,
  NumberField,
  SelectField,
  STROKE_STYLE_OPTIONS,
} from "./fields";

export function RectProperties(props: ElementFormProps): ReactNode {
  const { store, view, errors, liveBox } = props;
  const el = view.element;
  if (el.type !== "rect") {
    return null;
  }
  const w = liveBox === null ? el.w : liveBox.w;
  const h = liveBox === null ? el.h : liveBox.h;
  return (
    <>
      <section className="apx-sect">
        <div className="apx-sect-h">配置</div>
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
        <div className="apx-sect-h">枠線</div>
        <NumberField
          label="枠線幅"
          value={el.borderWidth}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "borderWidth")}
          onCommit={(borderWidth) =>
            commitReplace(store, el.id, { ...el, borderWidth })
          }
        />
        <ColorField
          label="枠線色"
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
        <SelectField
          label="線種"
          value={el.borderStyle ?? "solid"}
          options={STROKE_STYLE_OPTIONS}
          onCommit={(borderStyle) =>
            commitReplace(
              store,
              el.id,
              withOptionalAttr(
                el,
                "borderStyle",
                borderStyle === "solid" ? undefined : borderStyle,
              ),
            )
          }
        />
        <NumberField
          label="角丸半径"
          value={el.cornerRadius ?? 0}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "cornerRadius")}
          onCommit={(cornerRadius) =>
            commitReplace(
              store,
              el.id,
              withOptionalAttr(
                el,
                "cornerRadius",
                cornerRadius === 0 ? undefined : cornerRadius,
              ),
            )
          }
        />
      </section>
      <section className="apx-sect">
        <div className="apx-sect-h">塗り</div>
        <ColorField
          label="塗り色"
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
