import type { ChangeEvent, ReactNode } from "react";
import { useId } from "react";
import { useMessages } from "../../i18n/context";
import type { Messages } from "../../i18n/messages";
import { IMAGE_PLACEHOLDER_SRC } from "../../state/constants";
import { errorMessageFor } from "../../state/error-index";
import { setImageSrc } from "../../state/properties";
import type { ElementFormProps } from "./ElementProperties";
import { commitReplace } from "./ElementProperties";
import { NumberField } from "./fields";

function srcSummary(
  src: string,
  labels: Pick<Messages["properties"]["image"], "unset" | "configured">,
): string {
  if (src === IMAGE_PLACEHOLDER_SRC) {
    return labels.unset;
  }
  const semi = src.indexOf(";");
  return semi > 5 ? src.slice(5, semi) : labels.configured;
}

export function ImageProperties(props: ElementFormProps): ReactNode {
  const { store, view, errors, liveBox } = props;
  const fileId = useId();
  const el = view.element;
  const m = useMessages();
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
      // Another attribute of the same element may be edited before the read completes, so replace only the src on the latest document instead of using the el captured at render time
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
      <section className="dr-sect">
        <div className="dr-sect-h">{m.properties.image.section}</div>
        <div className="dr-frow">
          <span className="dr-frow-label">{m.properties.image.current}</span>
          <span className="dr-field-static">
            {srcSummary(el.src, m.properties.image)}
          </span>
        </div>
        <div className="dr-frow">
          <label htmlFor={fileId}>{m.properties.image.file}</label>
          <input
            id={fileId}
            type="file"
            accept="image/png,image/jpeg"
            className="dr-file"
            onChange={onFile}
          />
        </div>
        {errorMessageFor(errors, "src") !== undefined && (
          <div className="dr-frow">
            <span />
            <span className="dr-ferr">{errorMessageFor(errors, "src")}</span>
          </div>
        )}
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
    </>
  );
}
