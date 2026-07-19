import type { ReactNode } from "react";
import { errorMessageFor } from "../../state/error-index";
import { ALIGN_OPTIONS } from "./align-options";
import type { ElementFormProps } from "./ElementProperties";
import { commitReplace, withOptionalAttr } from "./ElementProperties";
import { ColorField, NumberField, SegmentField, TextField } from "./fields";

export function PageNumberProperties(props: ElementFormProps): ReactNode {
  const { store, view, errors, liveBox } = props;
  const el = view.element;
  if (el.type !== "pageNumber") {
    return null;
  }
  const w = liveBox === null ? el.w : liveBox.w;
  const h = liveBox === null ? el.h : liveBox.h;
  return (
    <>
      <section className="apx-sect">
        <div className="apx-sect-h">書式</div>
        <TextField
          label="書式"
          value={el.format}
          mono
          hint="{n} = 現在ページ、{N} = 総ページ数"
          onCommit={(format) => commitReplace(store, el.id, { ...el, format })}
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
        <ColorField
          label="文字色"
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
