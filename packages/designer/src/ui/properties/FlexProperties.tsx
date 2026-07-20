import type { IrDocument, IrFlexAlign } from "@denreport/core";
import type { ReactNode } from "react";
import { useId } from "react";
import { useMessages } from "../../i18n/context.js";
import { errorMessageFor } from "../../state/error-index.js";
import { flexMainContentSize } from "../../state/geometry.js";
import { setFlexDirection, setFlexMainSize } from "../../state/properties.js";
import type { ElementFormProps } from "./ElementProperties.js";
import { commitReplace } from "./ElementProperties.js";
import { NumberField, SegmentField } from "./fields.js";

export function FlexProperties(props: ElementFormProps): ReactNode {
  const { store, view, errors, liveBox } = props;
  const checkId = useId();
  const el = view.element;
  const m = useMessages();
  const flexAlignOptions: readonly {
    readonly value: IrFlexAlign;
    readonly label: string;
  }[] = [
    { value: "start", label: m.properties.flex.alignStart },
    { value: "center", label: m.properties.flex.alignCenter },
    { value: "end", label: m.properties.flex.alignEnd },
  ];
  if (el.type !== "flex") {
    return null;
  }
  const content = flexMainContentSize(el);
  const explicitMain = el.direction === "row" ? el.w : el.h;
  const cross = el.direction === "row" ? view.box.h : view.box.w;

  const commitDoc = (op: (document: IrDocument) => IrDocument): void => {
    const document = store.getState().document;
    const updated = op(document);
    if (updated !== document) {
      store.commit(updated);
    }
  };

  return (
    <>
      {"x" in el && (
        <section className="dr-sect">
          <div className="dr-sect-h">{m.properties.placement}</div>
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
      <section className="dr-sect">
        <div className="dr-sect-h">{m.properties.flex.layout}</div>
        <SegmentField
          label={m.properties.flex.direction}
          value={el.direction}
          options={[
            { value: "column", label: m.properties.flex.directionColumn },
            { value: "row", label: m.properties.flex.directionRow },
          ]}
          onCommit={(direction) =>
            commitDoc((document) =>
              setFlexDirection(document, el.id, direction),
            )
          }
        />
        <NumberField
          label={m.properties.flex.gap}
          value={el.gap}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "gap")}
          onCommit={(gap) => commitReplace(store, el.id, { ...el, gap })}
        />
        <SegmentField
          label={m.properties.flex.mainAxisAlign}
          value={el.justifyContent}
          options={flexAlignOptions}
          onCommit={(justifyContent) =>
            commitReplace(store, el.id, { ...el, justifyContent })
          }
        />
        <SegmentField
          label={m.properties.flex.crossAxisAlign}
          value={el.alignItems}
          options={flexAlignOptions}
          onCommit={(alignItems) =>
            commitReplace(store, el.id, { ...el, alignItems })
          }
        />
      </section>
      <section className="dr-sect">
        <div className="dr-sect-h">{m.properties.flex.dimension}</div>
        <div className="dr-frow">
          <span className="dr-frow-label">
            {m.properties.flex.mainSize(el.direction === "row" ? "w" : "h")}
          </span>
          <label className="dr-check" htmlFor={checkId}>
            <input
              id={checkId}
              type="checkbox"
              checked={explicitMain !== undefined}
              onChange={(e) =>
                commitDoc((document) =>
                  setFlexMainSize(
                    document,
                    el.id,
                    e.currentTarget.checked
                      ? flexMainContentSize(el)
                      : undefined,
                  ),
                )
              }
            />
            {m.properties.flex.explicit}
          </label>
        </div>
        {explicitMain !== undefined ? (
          <NumberField
            label={el.direction === "row" ? "w" : "h"}
            value={explicitMain}
            unit="mm"
            precision={0.1}
            error={errorMessageFor(errors, el.direction === "row" ? "w" : "h")}
            onCommit={(main) =>
              commitDoc((document) => setFlexMainSize(document, el.id, main))
            }
          />
        ) : (
          <div className="dr-frow">
            <span />
            <span className="dr-field-static">
              {m.properties.flex.derived(content.toFixed(1))}
            </span>
          </div>
        )}
        <div className="dr-frow">
          <span className="dr-frow-label">{m.properties.flex.crossAxis}</span>
          <span className="dr-field-static">
            {m.properties.flex.derived(cross.toFixed(1))}
          </span>
        </div>
      </section>
    </>
  );
}
