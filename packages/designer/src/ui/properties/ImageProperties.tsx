import type { ChangeEvent, ReactNode } from "react";
import { useId } from "react";
import { IMAGE_PLACEHOLDER_SRC } from "../../state/constants";
import { errorMessageFor } from "../../state/error-index";
import { setImageSrc } from "../../state/properties";
import type { ElementFormProps } from "./ElementProperties";
import { commitReplace } from "./ElementProperties";
import { NumberField } from "./fields";

function srcSummary(src: string): string {
  if (src === IMAGE_PLACEHOLDER_SRC) {
    return "未設定";
  }
  const semi = src.indexOf(";");
  return semi > 5 ? src.slice(5, semi) : "設定済み";
}

export function ImageProperties(props: ElementFormProps): ReactNode {
  const { store, view, errors, liveBox } = props;
  const fileId = useId();
  const el = view.element;
  if (el.type !== "image") {
    return null;
  }
  const w = liveBox === null ? el.w : liveBox.w;
  const h = liveBox === null ? el.h : liveBox.h;

  const onFile = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.currentTarget.files?.[0];
    if (file === undefined) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        return;
      }
      // 読込完了までの間に同じ要素の別属性が編集され得るため、レンダー時の el を使わず最新文書の src だけを差し替える
      const document = store.getState().document;
      const updated = setImageSrc(document, el.id, reader.result);
      if (updated !== document) {
        store.commit(updated);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <section className="apx-sect">
        <div className="apx-sect-h">画像</div>
        <div className="apx-frow">
          <span className="apx-frow-label">現在</span>
          <span className="apx-field-static">{srcSummary(el.src)}</span>
        </div>
        <div className="apx-frow">
          <label htmlFor={fileId}>ファイル</label>
          <input
            id={fileId}
            type="file"
            accept="image/png,image/jpeg"
            className="apx-file"
            onChange={onFile}
          />
        </div>
        {errorMessageFor(errors, "src") !== undefined && (
          <div className="apx-frow">
            <span />
            <span className="apx-ferr">{errorMessageFor(errors, "src")}</span>
          </div>
        )}
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
    </>
  );
}
