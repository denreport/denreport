import type { ReactNode } from "react";
import { errorMessageFor } from "../../state/error-index";
import { ALIGN_OPTIONS } from "./align-options";
import type { ElementFormProps } from "./ElementProperties";
import { commitReplace } from "./ElementProperties";
import { NumberField, SegmentField, TextAreaField } from "./fields";

export function TextProperties(props: ElementFormProps): ReactNode {
  const { store, view, errors, liveBox } = props;
  const el = view.element;
  if (el.type !== "text") {
    return null;
  }
  const w = liveBox === null ? el.w : liveBox.w;
  const h = liveBox === null ? el.h : liveBox.h;
  return (
    <>
      <section className="apx-sect">
        <div className="apx-sect-h">内容</div>
        <TextAreaField
          label="テキスト"
          value={el.text}
          onCommit={(text) => commitReplace(store, el.id, { ...el, text })}
        />
      </section>
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
        <div className="apx-sect-h">文字</div>
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
        <SegmentField
          label="整列"
          value={el.align}
          options={ALIGN_OPTIONS}
          onCommit={(align) => commitReplace(store, el.id, { ...el, align })}
        />
        <NumberField
          label="行間"
          value={el.lineHeight}
          precision={0.01}
          error={errorMessageFor(errors, "lineHeight")}
          onCommit={(lineHeight) =>
            commitReplace(store, el.id, { ...el, lineHeight })
          }
        />
      </section>
    </>
  );
}
