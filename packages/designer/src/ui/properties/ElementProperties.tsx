import type { IrElement, IrError, IrFlexChild, IrPages } from "@denreport/core";
import { applicableStyleAttrs } from "@denreport/core";
import type { ReactNode } from "react";
import { useId } from "react";
import { useMessages } from "../../i18n/context";
import { rotateElement } from "../../state/elements";
import type { MmBox, PlacedElementView } from "../../state/geometry";
import { replaceElement } from "../../state/properties";
import type { EditorStore } from "../../state/store";
import { applyStyle, clearStyle } from "../../state/styles";
import { BarcodeProperties } from "./BarcodeProperties";
import { EllipseProperties } from "./EllipseProperties";
import { FlexProperties } from "./FlexProperties";
import { NumberField, SegmentField, TextField } from "./fields";
import { ImageProperties } from "./ImageProperties";
import { LineProperties } from "./LineProperties";
import { PageNumberProperties } from "./PageNumberProperties";
import { RectProperties } from "./RectProperties";
import { TableProperties } from "./TableProperties";
import { TextProperties } from "./TextProperties";

export interface ElementFormProps {
  readonly store: EditorStore;
  readonly view: PlacedElementView;
  readonly errors: readonly IrError[];
  /** Live box of the one element being dragged. null if nothing is being dragged. */
  readonly liveBox: MmBox | null;
}

/** Committing one attribute = one commit. No history entry is added on no-op (unknown id, etc.) */
export function commitReplace(
  store: EditorStore,
  id: string,
  next: IrElement | IrFlexChild,
): void {
  const document = store.getState().document;
  const updated = replaceElement(document, id, next);
  if (updated !== document) {
    store.commit(updated);
  }
}

/** Removes the attribute if value is undefined (reverting to the default), otherwise sets it */
export function withOptionalAttr<T extends object, K extends keyof T>(
  base: T,
  key: K,
  value: T[K] | undefined,
): T {
  if (value === undefined) {
    const rest = { ...base };
    delete rest[key];
    return rest;
  }
  return { ...base, [key]: value };
}

function styleOf(el: IrElement | IrFlexChild): string | undefined {
  return el.type === "image" ||
    el.type === "flex" ||
    el.type === "ellipse" ||
    el.type === "barcode"
    ? undefined
    : el.style;
}

function formFor(props: ElementFormProps): ReactNode {
  switch (props.view.element.type) {
    case "text":
      return <TextProperties {...props} />;
    case "line":
      return <LineProperties {...props} />;
    case "rect":
      return <RectProperties {...props} />;
    case "ellipse":
      return <EllipseProperties {...props} />;
    case "table":
      return <TableProperties {...props} />;
    case "image":
      return <ImageProperties {...props} />;
    case "flex":
      return <FlexProperties {...props} />;
    case "pageNumber":
      return <PageNumberProperties {...props} />;
    case "barcode":
      return <BarcodeProperties {...props} />;
  }
}

export function ElementProperties(props: ElementFormProps): ReactNode {
  const { store, view } = props;
  const m = useMessages();
  const el = view.element;
  const styleSelectId = useId();
  const pagesOptions: readonly {
    readonly value: IrPages;
    readonly label: string;
  }[] = [
    { value: "first", label: m.properties.element.pagesFirst },
    { value: "rest", label: m.properties.element.pagesRest },
    { value: "last", label: m.properties.element.pagesLast },
    { value: "all", label: m.properties.element.pagesAll },
  ];
  return (
    <>
      <div className="apx-props-head">
        <div className="apx-props-head-top">
          <span className="apx-type-badge">{m.elementTypes[el.type]}</span>
          <span className="apx-props-id">{el.id}</span>
        </div>
        <TextField
          label={m.properties.element.name}
          value={el.name ?? ""}
          onCommit={(raw) => {
            const trimmed = raw.trim();
            if (trimmed === (el.name ?? "")) {
              return;
            }
            commitReplace(
              store,
              el.id,
              withOptionalAttr(
                el,
                "name",
                trimmed === "" ? undefined : trimmed,
              ),
            );
          }}
        />
      </div>
      {view.parentFlexId !== null && (
        <p className="apx-sect apx-sect-note">
          {m.properties.element.flexChildNote}
        </p>
      )}
      {view.parentFlexId === null && "pages" in el && (
        <section className="apx-sect">
          <SegmentField
            label={m.properties.element.pages}
            value={el.pages}
            options={pagesOptions}
            onCommit={(pages) => commitReplace(store, el.id, { ...el, pages })}
          />
        </section>
      )}
      {el.type !== "table" && el.type !== "flex" && (
        <section className="apx-sect">
          <NumberField
            label={m.properties.element.rotate}
            value={el.rotate ?? 0}
            unit="°"
            precision={0.1}
            onCommit={(value) => {
              const document = store.getState().document;
              const updated = rotateElement(document, el.id, value);
              if (updated !== document) {
                store.commit(updated);
              }
            }}
          />
        </section>
      )}
      {applicableStyleAttrs(el.type).length > 0 && (
        <section className="apx-sect">
          <div className="apx-frow">
            <label htmlFor={styleSelectId}>{m.properties.element.style}</label>
            <span className="apx-field">
              <select
                id={styleSelectId}
                value={styleOf(el) ?? ""}
                onChange={(e) => {
                  const name = e.currentTarget.value;
                  const document = store.getState().document;
                  const updated =
                    name === ""
                      ? clearStyle(document, el.id)
                      : applyStyle(document, el.id, name);
                  if (updated !== document) {
                    store.commit(updated);
                  }
                }}
              >
                <option value="">{m.properties.element.noStyle}</option>
                {(store.getState().document.styles ?? []).map((style) => (
                  <option key={style.name} value={style.name}>
                    {style.name}
                  </option>
                ))}
              </select>
            </span>
          </div>
        </section>
      )}
      {formFor(props)}
    </>
  );
}
