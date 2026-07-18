import type { ReactNode } from "react";
import { errorMessageFor } from "../../state/error-index";
import type { ElementFormProps } from "./ElementProperties";
import { commitReplace, withOptionalAttr } from "./ElementProperties";
import {
  ColorField,
  NumberField,
  SegmentField,
  SelectField,
  STROKE_STYLE_OPTIONS,
} from "./fields";

export function LineProperties(props: ElementFormProps): ReactNode {
  const { store, view, errors, liveBox } = props;
  const el = view.element;
  if (el.type !== "line") {
    return null;
  }
  const length =
    liveBox === null
      ? el.length
      : el.orientation === "horizontal"
        ? liveBox.w
        : liveBox.h;
  return (
    <>
      {"x" in el && (
        <section className="apx-sect">
          <div className="apx-sect-h">配置</div>
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
        </section>
      )}
      <section className="apx-sect">
        <div className="apx-sect-h">形状</div>
        <SegmentField
          label="向き"
          value={el.orientation}
          options={[
            { value: "horizontal", label: "水平" },
            { value: "vertical", label: "垂直" },
          ]}
          onCommit={(orientation) =>
            commitReplace(store, el.id, { ...el, orientation })
          }
        />
        <NumberField
          label="長さ"
          value={length}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "length")}
          onCommit={(length) => commitReplace(store, el.id, { ...el, length })}
        />
        <NumberField
          label="太さ"
          value={el.thickness}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "thickness")}
          onCommit={(thickness) =>
            commitReplace(store, el.id, { ...el, thickness })
          }
        />
      </section>
      <section className="apx-sect">
        <div className="apx-sect-h">スタイル</div>
        <ColorField
          label="色"
          value={el.color ?? null}
          onCommit={(color) =>
            commitReplace(
              store,
              el.id,
              withOptionalAttr(
                el,
                "color",
                color === null || color === "#000000" ? undefined : color,
              ),
            )
          }
        />
        <SelectField
          label="線種"
          value={el.strokeStyle ?? "solid"}
          options={STROKE_STYLE_OPTIONS}
          onCommit={(strokeStyle) =>
            commitReplace(
              store,
              el.id,
              withOptionalAttr(
                el,
                "strokeStyle",
                strokeStyle === "solid" ? undefined : strokeStyle,
              ),
            )
          }
        />
      </section>
    </>
  );
}
