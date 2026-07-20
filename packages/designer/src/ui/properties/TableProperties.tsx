import { TABLE_FRAME_WIDTH, TABLE_GRID_WIDTH } from "@denreport/core";
import type { ReactNode } from "react";
import { useId } from "react";
import { useMessages } from "../../i18n/context";
import { collectBindKeys, sampleDataKeys } from "../../state/bind-keys";
import { STRIPE_DEFAULT_COLOR } from "../../state/constants";
import { errorMessageFor } from "../../state/error-index";
import { activeSampleJson } from "../../state/sample-scenarios";
import { useEditorState } from "../useEditorState";
import { CellSpansEditor } from "./CellSpansEditor";
import { ColumnsEditor } from "./ColumnsEditor";
import type { ElementFormProps } from "./ElementProperties";
import { commitReplace, withOptionalAttr } from "./ElementProperties";
import {
  ColorField,
  NumberField,
  SelectField,
  strokeStyleOptions,
  TextField,
} from "./fields";

export function TableProperties(props: ElementFormProps): ReactNode {
  const { store, view, errors, liveBox } = props;
  const state = useEditorState(store);
  const m = useMessages();
  const t = m.propertiesBulk.table;
  const strokeStyleOpts = strokeStyleOptions(m.properties.fields.strokeStyle);
  const stripeCheckId = useId();
  const el = view.element;
  if (el.type !== "table") {
    return null;
  }
  const totalWidth = el.columns.reduce((total, col) => total + col.width, 0);
  const x = liveBox === null ? el.x : liveBox.x;
  // In the rest / last context, the vertical component of a move resolves to continuationY, so y is only live-displayed in the first context
  const y =
    liveBox !== null && state.view.pageContext === "first" ? liveBox.y : el.y;
  return (
    <>
      <section className="apx-sect">
        <div className="apx-sect-h">{m.propertiesBulk.sections.placement}</div>
        <NumberField
          label={m.propertiesBulk.fields.x}
          value={x}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "x")}
          onCommit={(x) => commitReplace(store, el.id, { ...el, x })}
        />
        <NumberField
          label={t.y}
          value={y}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "y")}
          onCommit={(y) => commitReplace(store, el.id, { ...el, y })}
        />
        <div className="apx-frow">
          <span className="apx-frow-label">{t.widthDerived}</span>
          <span className="apx-field-static">
            {t.widthFormula(totalWidth.toFixed(1))}
          </span>
        </div>
        <p className="apx-sect-note">{t.pagesNote}</p>
      </section>
      <section className="apx-sect">
        <div className="apx-sect-h">{t.dataSection}</div>
        <TextField
          label={t.bind}
          value={el.bind}
          mono
          suggestions={[
            ...new Set([
              ...collectBindKeys(state.document),
              ...sampleDataKeys(activeSampleJson(state.sampleScenarios)),
            ]),
          ].sort()}
          error={errorMessageFor(errors, "bind")}
          onCommit={(bind) => commitReplace(store, el.id, { ...el, bind })}
        />
      </section>
      <section className="apx-sect">
        <div className="apx-sect-h">{t.rowsSection}</div>
        <NumberField
          label={t.rowHeight}
          value={el.rowHeight}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "rowHeight")}
          onCommit={(rowHeight) =>
            commitReplace(store, el.id, { ...el, rowHeight })
          }
        />
        <NumberField
          label={t.headerHeight}
          value={el.headerHeight}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "headerHeight")}
          onCommit={(headerHeight) =>
            commitReplace(store, el.id, { ...el, headerHeight })
          }
        />
        <NumberField
          label={t.minRows}
          value={el.minRows}
          precision={1}
          error={errorMessageFor(errors, "minRows")}
          onCommit={(minRows) =>
            commitReplace(store, el.id, { ...el, minRows })
          }
        />
        <NumberField
          label={m.propertiesBulk.fields.fontSize}
          value={el.fontSize}
          unit="pt"
          precision={0.1}
          error={errorMessageFor(errors, "fontSize")}
          onCommit={(fontSize) =>
            commitReplace(store, el.id, { ...el, fontSize })
          }
        />
      </section>
      <section className="apx-sect">
        <div className="apx-sect-h">{t.pageBreakSection}</div>
        <NumberField
          label={t.maxY}
          value={el.maxY}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "maxY")}
          onCommit={(maxY) => commitReplace(store, el.id, { ...el, maxY })}
        />
        <NumberField
          label={t.continuationY}
          value={el.continuationY}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "continuationY")}
          onCommit={(continuationY) =>
            commitReplace(store, el.id, { ...el, continuationY })
          }
        />
        <p className="apx-sect-note">{t.continuationNote}</p>
      </section>
      <section className="apx-sect">
        <div className="apx-sect-h">{t.bordersSection}</div>
        {/* The default gridWidth (0.25mm) doesn't land on a 0.1mm step, so use a finer step than the other mm fields */}
        <NumberField
          label={t.frameWidth}
          value={el.frameWidth ?? TABLE_FRAME_WIDTH}
          unit="mm"
          precision={0.05}
          error={errorMessageFor(errors, "frameWidth")}
          onCommit={(frameWidth) =>
            commitReplace(
              store,
              el.id,
              withOptionalAttr(
                el,
                "frameWidth",
                frameWidth === TABLE_FRAME_WIDTH ? undefined : frameWidth,
              ),
            )
          }
        />
        <SelectField
          label={t.frameStyle}
          value={el.frameStyle ?? "solid"}
          options={strokeStyleOpts}
          onCommit={(frameStyle) =>
            commitReplace(
              store,
              el.id,
              withOptionalAttr(
                el,
                "frameStyle",
                frameStyle === "solid" ? undefined : frameStyle,
              ),
            )
          }
        />
        <NumberField
          label={t.gridWidth}
          value={el.gridWidth ?? TABLE_GRID_WIDTH}
          unit="mm"
          precision={0.05}
          error={errorMessageFor(errors, "gridWidth")}
          onCommit={(gridWidth) =>
            commitReplace(
              store,
              el.id,
              withOptionalAttr(
                el,
                "gridWidth",
                gridWidth === TABLE_GRID_WIDTH ? undefined : gridWidth,
              ),
            )
          }
        />
        <SelectField
          label={t.gridStyle}
          value={el.gridStyle ?? "solid"}
          options={strokeStyleOpts}
          onCommit={(gridStyle) =>
            commitReplace(
              store,
              el.id,
              withOptionalAttr(
                el,
                "gridStyle",
                gridStyle === "solid" ? undefined : gridStyle,
              ),
            )
          }
        />
      </section>
      <section className="apx-sect">
        <div className="apx-sect-h">{t.stripeSection}</div>
        <div className="apx-frow">
          <span className="apx-frow-label">{t.stripeToggle}</span>
          <label className="apx-check" htmlFor={stripeCheckId}>
            <input
              id={stripeCheckId}
              type="checkbox"
              aria-label={t.stripeToggle}
              checked={el.stripeColor !== undefined}
              onChange={(e) =>
                commitReplace(
                  store,
                  el.id,
                  withOptionalAttr(
                    el,
                    "stripeColor",
                    e.currentTarget.checked ? STRIPE_DEFAULT_COLOR : undefined,
                  ),
                )
              }
            />
          </label>
        </div>
        {el.stripeColor !== undefined && (
          <ColorField
            label={t.stripeColor}
            value={el.stripeColor}
            onCommit={(stripeColor) =>
              commitReplace(
                store,
                el.id,
                withOptionalAttr(
                  el,
                  "stripeColor",
                  stripeColor ?? STRIPE_DEFAULT_COLOR,
                ),
              )
            }
          />
        )}
      </section>
      <ColumnsEditor {...props} />
      <CellSpansEditor {...props} />
    </>
  );
}
