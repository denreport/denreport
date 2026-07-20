import type { ReactNode } from "react";
import { useMessages } from "../../i18n/context";
import { errorMessageFor } from "../../state/error-index";
import { alignOptions } from "./align-options";
import type { ElementFormProps } from "./ElementProperties";
import { commitReplace, withOptionalAttr } from "./ElementProperties";
import { ColorField, NumberField, SegmentField, TextAreaField } from "./fields";

export function TextProperties(props: ElementFormProps): ReactNode {
  const { store, view, errors, liveBox } = props;
  const el = view.element;
  const m = useMessages();
  if (el.type !== "text") {
    return null;
  }
  const w = liveBox === null ? el.w : liveBox.w;
  const h = liveBox === null ? el.h : liveBox.h;
  return (
    <>
      <section className="dr-sect">
        <div className="dr-sect-h">{m.properties.text.content}</div>
        <TextAreaField
          label={m.properties.text.text}
          value={el.text}
          hint={m.properties.text.textHint}
          error={errorMessageFor(errors, "text")}
          onCommit={(text) => commitReplace(store, el.id, { ...el, text })}
        />
      </section>
      <section className="dr-sect">
        <div className="dr-sect-h">{m.properties.placement}</div>
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
      <section className="dr-sect">
        <div className="dr-sect-h">{m.properties.character.section}</div>
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
        <div className="dr-frow">
          <span className="dr-frow-label">{m.properties.text.decoration}</span>
          <fieldset
            className="dr-seg"
            aria-label={m.properties.text.decoration}
          >
            <button
              type="button"
              aria-pressed={el.fontWeight === "bold"}
              className={el.fontWeight === "bold" ? "is-active" : undefined}
              onClick={() =>
                commitReplace(
                  store,
                  el.id,
                  withOptionalAttr(
                    el,
                    "fontWeight",
                    el.fontWeight === "bold" ? undefined : "bold",
                  ),
                )
              }
            >
              {m.properties.text.bold}
            </button>
            <button
              type="button"
              aria-pressed={el.fontStyle === "italic"}
              className={el.fontStyle === "italic" ? "is-active" : undefined}
              onClick={() =>
                commitReplace(
                  store,
                  el.id,
                  withOptionalAttr(
                    el,
                    "fontStyle",
                    el.fontStyle === "italic" ? undefined : "italic",
                  ),
                )
              }
            >
              {m.properties.text.italic}
            </button>
            <button
              type="button"
              aria-pressed={el.underline === true}
              className={el.underline === true ? "is-active" : undefined}
              onClick={() =>
                commitReplace(
                  store,
                  el.id,
                  withOptionalAttr(
                    el,
                    "underline",
                    el.underline === true ? undefined : true,
                  ),
                )
              }
            >
              {m.properties.text.underline}
            </button>
          </fieldset>
        </div>
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
