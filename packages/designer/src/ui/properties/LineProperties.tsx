import type { ReactNode } from "react";
import { useMessages } from "../../i18n/context";
import { errorMessageFor } from "../../state/error-index";
import type { ElementFormProps } from "./ElementProperties";
import { commitReplace, withOptionalAttr } from "./ElementProperties";
import {
  ColorField,
  NumberField,
  SegmentField,
  SelectField,
  strokeStyleOptions,
} from "./fields";

export function LineProperties(props: ElementFormProps): ReactNode {
  const { store, view, errors, liveBox } = props;
  const el = view.element;
  const m = useMessages();
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
          <div className="apx-sect-h">{m.properties.placement}</div>
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
        <div className="apx-sect-h">{m.properties.line.shape}</div>
        <SegmentField
          label={m.properties.line.orientation}
          value={el.orientation}
          options={[
            {
              value: "horizontal",
              label: m.properties.line.orientationHorizontal,
            },
            { value: "vertical", label: m.properties.line.orientationVertical },
          ]}
          onCommit={(orientation) =>
            commitReplace(store, el.id, { ...el, orientation })
          }
        />
        <NumberField
          label={m.properties.line.length}
          value={length}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "length")}
          onCommit={(length) => commitReplace(store, el.id, { ...el, length })}
        />
        <NumberField
          label={m.properties.line.thickness}
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
        <div className="apx-sect-h">{m.properties.line.style}</div>
        <ColorField
          label={m.properties.line.color}
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
          label={m.properties.fields.strokeStyleLabel}
          value={el.strokeStyle ?? "solid"}
          options={strokeStyleOptions(m.properties.fields.strokeStyle)}
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
