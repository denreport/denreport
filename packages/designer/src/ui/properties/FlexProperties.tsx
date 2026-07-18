import type { IrDocument, IrFlexAlign } from "@denreport/core";
import type { ReactNode } from "react";
import { useId } from "react";
import { errorMessageFor } from "../../state/error-index";
import { flexMainContentSize } from "../../state/geometry";
import { setFlexDirection, setFlexMainSize } from "../../state/properties";
import type { ElementFormProps } from "./ElementProperties";
import { commitReplace } from "./ElementProperties";
import { NumberField, SegmentField } from "./fields";

const FLEX_ALIGN_OPTIONS: readonly {
  readonly value: IrFlexAlign;
  readonly label: string;
}[] = [
  { value: "start", label: "先頭" },
  { value: "center", label: "中央" },
  { value: "end", label: "末尾" },
];

export function FlexProperties(props: ElementFormProps): ReactNode {
  const { store, view, errors, liveBox } = props;
  const checkId = useId();
  const el = view.element;
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
        <div className="apx-sect-h">レイアウト</div>
        <SegmentField
          label="方向"
          value={el.direction}
          options={[
            { value: "column", label: "縦" },
            { value: "row", label: "横" },
          ]}
          onCommit={(direction) =>
            commitDoc((document) =>
              setFlexDirection(document, el.id, direction),
            )
          }
        />
        <NumberField
          label="間隔"
          value={el.gap}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "gap")}
          onCommit={(gap) => commitReplace(store, el.id, { ...el, gap })}
        />
        <SegmentField
          label="主軸配置"
          value={el.justifyContent}
          options={FLEX_ALIGN_OPTIONS}
          onCommit={(justifyContent) =>
            commitReplace(store, el.id, { ...el, justifyContent })
          }
        />
        <SegmentField
          label="交差軸配置"
          value={el.alignItems}
          options={FLEX_ALIGN_OPTIONS}
          onCommit={(alignItems) =>
            commitReplace(store, el.id, { ...el, alignItems })
          }
        />
      </section>
      <section className="apx-sect">
        <div className="apx-sect-h">寸法</div>
        <div className="apx-frow">
          <span className="apx-frow-label">
            主軸寸法（{el.direction === "row" ? "w" : "h"}）
          </span>
          <label className="apx-check" htmlFor={checkId}>
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
            明示する
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
          <div className="apx-frow">
            <span />
            <span className="apx-field-static">
              導出 = {content.toFixed(1)} mm
            </span>
          </div>
        )}
        <div className="apx-frow">
          <span className="apx-frow-label">交差軸</span>
          <span className="apx-field-static">導出 = {cross.toFixed(1)} mm</span>
        </div>
      </section>
    </>
  );
}
