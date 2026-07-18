import type { ReactNode } from "react";
import { useId } from "react";
import { collectBindKeys, sampleDataKeys } from "../../state/bind-keys";
import { STRIPE_DEFAULT_COLOR } from "../../state/constants";
import { errorMessageFor } from "../../state/error-index";
import { activeSampleJson } from "../../state/sample-scenarios";
import { useEditorState } from "../useEditorState";
import { ColumnsEditor } from "./ColumnsEditor";
import type { ElementFormProps } from "./ElementProperties";
import { commitReplace, withOptionalAttr } from "./ElementProperties";
import { ColorField, NumberField, TextField } from "./fields";

export function TableProperties(props: ElementFormProps): ReactNode {
  const { store, view, errors, liveBox } = props;
  const state = useEditorState(store);
  const stripeCheckId = useId();
  const el = view.element;
  if (el.type !== "table") {
    return null;
  }
  const totalWidth = el.columns.reduce((total, col) => total + col.width, 0);
  const x = liveBox === null ? el.x : liveBox.x;
  // rest / last 文脈では移動の縦成分が continuationY に確定するため、y は first 文脈でのみライブ表示する
  const y =
    liveBox !== null && state.view.pageContext === "first" ? liveBox.y : el.y;
  return (
    <>
      <section className="apx-sect">
        <div className="apx-sect-h">配置</div>
        <NumberField
          label="x"
          value={x}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "x")}
          onCommit={(x) => commitReplace(store, el.id, { ...el, x })}
        />
        <NumberField
          label="y（1ページ目）"
          value={y}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "y")}
          onCommit={(y) => commitReplace(store, el.id, { ...el, y })}
        />
        <div className="apx-frow">
          <span className="apx-frow-label">幅（導出）</span>
          <span className="apx-field-static">
            Σ列幅 = {totalWidth.toFixed(1)} mm
          </span>
        </div>
        <p className="apx-sect-note">
          表は常に1ページ目起点で流し込まれるため、ページ指定はありません。
        </p>
      </section>
      <section className="apx-sect">
        <div className="apx-sect-h">データ</div>
        <TextField
          label="バインド"
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
        <div className="apx-sect-h">行</div>
        <NumberField
          label="行高"
          value={el.rowHeight}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "rowHeight")}
          onCommit={(rowHeight) =>
            commitReplace(store, el.id, { ...el, rowHeight })
          }
        />
        <NumberField
          label="ヘッダ高"
          value={el.headerHeight}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "headerHeight")}
          onCommit={(headerHeight) =>
            commitReplace(store, el.id, { ...el, headerHeight })
          }
        />
        <NumberField
          label="最低行数"
          value={el.minRows}
          precision={1}
          error={errorMessageFor(errors, "minRows")}
          onCommit={(minRows) =>
            commitReplace(store, el.id, { ...el, minRows })
          }
        />
        <NumberField
          label="文字サイズ"
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
        <div className="apx-sect-h">ページ分割</div>
        <NumberField
          label="下端（maxY）"
          value={el.maxY}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "maxY")}
          onCommit={(maxY) => commitReplace(store, el.id, { ...el, maxY })}
        />
        <NumberField
          label="継続上端"
          value={el.continuationY}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "continuationY")}
          onCommit={(continuationY) =>
            commitReplace(store, el.id, { ...el, continuationY })
          }
        />
        <p className="apx-sect-note">
          継続上端は2ページ目以降の表上端。継続ページの見えは編集ページの切替で確認できます。
        </p>
      </section>
      <section className="apx-sect">
        <div className="apx-sect-h">明細行の網掛け</div>
        <div className="apx-frow">
          <span className="apx-frow-label">1行おきに背景色を付ける</span>
          <label className="apx-check" htmlFor={stripeCheckId}>
            <input
              id={stripeCheckId}
              type="checkbox"
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
            label="縞の色"
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
    </>
  );
}
