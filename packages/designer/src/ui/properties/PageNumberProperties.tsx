import type { ReactNode } from "react";
import { useMessages } from "../../i18n/context";
import { errorMessageFor } from "../../state/error-index";
import { alignOptions } from "./align-options";
import type { ElementFormProps } from "./ElementProperties";
import { commitReplace, withOptionalAttr } from "./ElementProperties";
import { ColorField, NumberField, SegmentField, TextField } from "./fields";

export function PageNumberProperties(props: ElementFormProps): ReactNode {
  const { store, view, errors, liveBox } = props;
  const el = view.element;
  const m = useMessages();
  if (el.type !== "pageNumber") {
    return null;
  }
  const w = liveBox === null ? el.w : liveBox.w;
  const h = liveBox === null ? el.h : liveBox.h;
  return (
    <>
      <section className="apx-sect">
        <div className="apx-sect-h">{m.properties.pageNumber.format}</div>
        <TextField
          label={m.properties.pageNumber.format}
          value={el.format}
          mono
          hint={m.properties.pageNumber.formatHint}
          onCommit={(format) => commitReplace(store, el.id, { ...el, format })}
        />
      </section>
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
        <div className="apx-sect-h">{m.properties.character.section}</div>
        <NumberField
          label={m.properties.character.fontSize}
          value={el.fontSize}
          unit="pt"
          precision={0.1}
          error={errorMessageFor(errors, "fontSize")}
          onCommit={(fontSize) =>
            commitReplace(store, el.id, { ...el, fontSize })
          }
        />
        <SegmentField
          label={m.properties.character.align}
          value={el.align}
          options={alignOptions(m.properties.align)}
          onCommit={(align) => commitReplace(store, el.id, { ...el, align })}
        />
        <NumberField
          label={m.properties.character.lineHeight}
          value={el.lineHeight}
          precision={0.01}
          error={errorMessageFor(errors, "lineHeight")}
          onCommit={(lineHeight) =>
            commitReplace(store, el.id, { ...el, lineHeight })
          }
        />
        <ColorField
          label={m.properties.character.color}
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
      </section>
    </>
  );
}
