import type {
  IrDocument,
  IrNamedStyle,
  IrStyleAttrs,
  StyleAttrKey,
} from "@denreport/core";
import { applicableStyleAttrs } from "@denreport/core";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useMessages } from "../../i18n/context.js";
import type { Messages } from "../../i18n/messages/index.js";
import { layoutDocument } from "../../state/geometry.js";
import type { EditorStore } from "../../state/store.js";
import {
  removeStyle,
  renameStyle,
  styleFromElement,
  upsertStyle,
} from "../../state/styles.js";
import { Dialog } from "../dialog/Dialog.js";
import { alignOptions } from "../properties/align-options.js";
import { NumberField, SegmentField, TextField } from "../properties/fields.js";
import { useEditorState } from "../useEditorState.js";

type StylesMessages = Messages["styles"];
type AlignOptions = ReturnType<typeof alignOptions>;

const STYLE_ATTR_KEYS: readonly StyleAttrKey[] = [
  "fontSize",
  "align",
  "lineHeight",
  "fontWeight",
  "fontStyle",
  "underline",
  "borderWidth",
  "thickness",
];

const ATTR_DEFAULTS: IrStyleAttrs = {
  fontSize: 10,
  align: "left",
  lineHeight: 1.25,
  fontWeight: "bold",
  fontStyle: "italic",
  underline: true,
  borderWidth: 0.3,
  thickness: 0.3,
};

function attrSummary(
  attrs: IrStyleAttrs,
  m: StylesMessages,
  alignOpts: AlignOptions,
): string {
  const parts: string[] = [];
  if (attrs.fontSize !== undefined) parts.push(`${attrs.fontSize}pt`);
  if (attrs.align !== undefined) {
    parts.push(alignOpts.find((o) => o.value === attrs.align)?.label ?? "");
  }
  if (attrs.lineHeight !== undefined) {
    parts.push(m.summary.lineHeight(attrs.lineHeight));
  }
  if (attrs.fontWeight !== undefined) {
    parts.push(
      attrs.fontWeight === "bold"
        ? m.summary.fontWeightBold
        : m.summary.fontWeightNormal,
    );
  }
  if (attrs.fontStyle !== undefined) {
    parts.push(
      attrs.fontStyle === "italic"
        ? m.summary.fontStyleItalic
        : m.summary.fontStyleNormal,
    );
  }
  if (attrs.underline !== undefined) {
    parts.push(
      attrs.underline ? m.summary.underlineOn : m.summary.underlineOff,
    );
  }
  if (attrs.borderWidth !== undefined) {
    parts.push(m.summary.borderWidth(attrs.borderWidth));
  }
  if (attrs.thickness !== undefined) {
    parts.push(m.summary.thickness(attrs.thickness));
  }
  return parts.length > 0 ? parts.join(" / ") : m.summary.empty;
}

/** Returns an unused m.nameFor(n) (n is the smallest unused number starting from 1) */
function nextStyleName(
  styles: readonly IrNamedStyle[],
  m: StylesMessages,
): string {
  const used = new Set(styles.map((s) => s.name));
  let n = 1;
  while (used.has(m.nameFor(n))) {
    n += 1;
  }
  return m.nameFor(n);
}

function StyleCard(props: {
  readonly style: IrNamedStyle;
  readonly commitDoc: (op: (document: IrDocument) => IrDocument) => void;
  readonly m: StylesMessages;
  readonly alignOpts: AlignOptions;
}): ReactNode {
  const { style, commitDoc, m, alignOpts } = props;

  const setAttrs = (attrs: IrStyleAttrs): void => {
    commitDoc((document) => upsertStyle(document, { ...style, attrs }));
  };

  const toggleAttr = (key: StyleAttrKey, included: boolean): void => {
    if (included) {
      setAttrs({ ...style.attrs, [key]: ATTR_DEFAULTS[key] });
      return;
    }
    const { [key]: _removed, ...rest } = style.attrs;
    setAttrs(rest);
  };

  const onRename = (raw: string): void => {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === style.name) {
      return;
    }
    commitDoc((document) => renameStyle(document, style.name, trimmed));
  };

  return (
    <li className="dr-col-card">
      <div className="dr-col-row">
        <TextField label={m.nameLabel} value={style.name} onCommit={onRename} />
        <button
          type="button"
          className="dr-col-btn dr-col-del"
          aria-label={m.deleteAriaLabel(style.name)}
          onClick={() =>
            commitDoc((document) => removeStyle(document, style.name))
          }
        >
          ×
        </button>
      </div>
      <p className="dr-sect-note">{attrSummary(style.attrs, m, alignOpts)}</p>
      {STYLE_ATTR_KEYS.map((key) => {
        const included = style.attrs[key] !== undefined;
        return (
          <div key={key} className="dr-col-row">
            <label className="dr-frow-label">
              <input
                type="checkbox"
                checked={included}
                onChange={(e) => toggleAttr(key, e.currentTarget.checked)}
              />
              {m.attrLabels[key]}
            </label>
            {included && key === "align" && (
              <SegmentField
                label={m.attrLabels.align}
                value={style.attrs.align ?? "left"}
                options={alignOpts}
                onCommit={(align) => setAttrs({ ...style.attrs, align })}
              />
            )}
            {included && key === "fontWeight" && (
              <SegmentField
                label={m.attrLabels.fontWeight}
                value={style.attrs.fontWeight ?? "bold"}
                options={[
                  { value: "normal", label: m.fontWeightOptions.normal },
                  { value: "bold", label: m.fontWeightOptions.bold },
                ]}
                onCommit={(fontWeight) =>
                  setAttrs({ ...style.attrs, fontWeight })
                }
              />
            )}
            {included && key === "fontStyle" && (
              <SegmentField
                label={m.attrLabels.fontStyle}
                value={style.attrs.fontStyle ?? "italic"}
                options={[
                  { value: "normal", label: m.fontStyleOptions.normal },
                  { value: "italic", label: m.fontStyleOptions.italic },
                ]}
                onCommit={(fontStyle) =>
                  setAttrs({ ...style.attrs, fontStyle })
                }
              />
            )}
            {included && key === "underline" && (
              <SegmentField
                label={m.attrLabels.underline}
                value={(style.attrs.underline ?? true) ? "on" : "off"}
                options={[
                  { value: "on", label: m.underlineOptions.on },
                  { value: "off", label: m.underlineOptions.off },
                ]}
                onCommit={(value) =>
                  setAttrs({ ...style.attrs, underline: value === "on" })
                }
              />
            )}
            {included &&
              key !== "align" &&
              key !== "fontWeight" &&
              key !== "fontStyle" &&
              key !== "underline" && (
                <NumberField
                  label={m.attrLabels[key]}
                  value={
                    (style.attrs[key] as number | undefined) ??
                    (ATTR_DEFAULTS[key] as number | undefined) ??
                    0
                  }
                  unit={
                    key === "fontSize"
                      ? "pt"
                      : key === "lineHeight"
                        ? undefined
                        : "mm"
                  }
                  precision={key === "lineHeight" ? 0.01 : 0.1}
                  onCommit={(value) =>
                    setAttrs({ ...style.attrs, [key]: value })
                  }
                />
              )}
          </div>
        );
      })}
    </li>
  );
}

export function StylesDialog(props: {
  readonly store: EditorStore;
  readonly onClose: () => void;
}): ReactNode {
  const { store, onClose } = props;
  const state = useEditorState(store);
  const messages = useMessages();
  const m = messages.styles;
  const alignOpts = alignOptions(messages.properties.align);
  const styles = state.document.styles ?? [];

  const layout = useMemo(
    () => layoutDocument(state.document, state.view.pageContext),
    [state.document, state.view.pageContext],
  );
  const singleSelected =
    state.selection.length === 1
      ? (layout.find((view) => view.id === state.selection[0])?.element ?? null)
      : null;
  const canCreateFromSelection =
    singleSelected !== null &&
    applicableStyleAttrs(singleSelected.type).length > 0;

  const commitDoc = (op: (document: IrDocument) => IrDocument): void => {
    const document = store.getState().document;
    const updated = op(document);
    if (updated !== document) {
      store.commit(updated);
    }
  };

  const onCreate = (): void => {
    const name = nextStyleName(styles, m);
    commitDoc((document) =>
      upsertStyle(document, { name, attrs: { fontSize: 10 } }),
    );
  };

  const onCreateFromSelection = (): void => {
    if (singleSelected === null) {
      return;
    }
    const style = styleFromElement(singleSelected, nextStyleName(styles, m));
    if (style === null) {
      return;
    }
    commitDoc((document) => upsertStyle(document, style));
  };

  return (
    <Dialog
      title={m.title}
      onClose={onClose}
      wide
      footer={
        <button
          type="button"
          className="dr-btn dr-btn-secondary"
          onClick={onClose}
        >
          {messages.dialog.close}
        </button>
      }
    >
      <div className="dr-col-row">
        <button
          type="button"
          className="dr-btn dr-btn-secondary"
          onClick={onCreate}
        >
          {m.addNew}
        </button>
        <button
          type="button"
          className="dr-btn dr-btn-secondary"
          disabled={!canCreateFromSelection}
          onClick={onCreateFromSelection}
        >
          {m.addFromSelection}
        </button>
      </div>
      {styles.length === 0 ? (
        <p className="dr-props-empty">{m.empty}</p>
      ) : (
        <ul className="dr-col-list">
          {styles.map((style) => (
            <StyleCard
              key={style.name}
              style={style}
              commitDoc={commitDoc}
              m={m}
              alignOpts={alignOpts}
            />
          ))}
        </ul>
      )}
    </Dialog>
  );
}
