import type {
  IrAlign,
  IrDocument,
  IrNamedStyle,
  IrStyleAttrs,
  StyleAttrKey,
} from "@denreport/core";
import { applicableStyleAttrs } from "@denreport/core";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { layoutDocument } from "../../state/geometry";
import type { EditorStore } from "../../state/store";
import {
  removeStyle,
  renameStyle,
  styleFromElement,
  upsertStyle,
} from "../../state/styles";
import { Dialog } from "../dialog/Dialog";
import { NumberField, SegmentField, TextField } from "../properties/fields";
import { useEditorState } from "../useEditorState";

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

const ATTR_LABELS: Readonly<Record<StyleAttrKey, string>> = {
  fontSize: "文字サイズ",
  align: "整列",
  lineHeight: "行間",
  fontWeight: "太字",
  fontStyle: "斜体",
  underline: "下線",
  borderWidth: "枠線幅",
  thickness: "太さ",
};

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

const ALIGN_OPTIONS: readonly {
  readonly value: IrAlign;
  readonly label: string;
}[] = [
  { value: "left", label: "左" },
  { value: "center", label: "中央" },
  { value: "right", label: "右" },
];

function attrSummary(attrs: IrStyleAttrs): string {
  const parts: string[] = [];
  if (attrs.fontSize !== undefined) parts.push(`${attrs.fontSize}pt`);
  if (attrs.align !== undefined) {
    parts.push(ALIGN_OPTIONS.find((o) => o.value === attrs.align)?.label ?? "");
  }
  if (attrs.lineHeight !== undefined) parts.push(`行間${attrs.lineHeight}`);
  if (attrs.fontWeight !== undefined) {
    parts.push(attrs.fontWeight === "bold" ? "太字" : "標準太さ");
  }
  if (attrs.fontStyle !== undefined) {
    parts.push(attrs.fontStyle === "italic" ? "斜体" : "正体");
  }
  if (attrs.underline !== undefined) {
    parts.push(attrs.underline ? "下線" : "下線なし");
  }
  if (attrs.borderWidth !== undefined) parts.push(`枠線${attrs.borderWidth}mm`);
  if (attrs.thickness !== undefined) parts.push(`太さ${attrs.thickness}mm`);
  return parts.length > 0 ? parts.join(" / ") : "（属性なし）";
}

/** 未使用の "スタイル<n>"（n は1から最小空き）を返す */
function nextStyleName(styles: readonly IrNamedStyle[]): string {
  const used = new Set(styles.map((s) => s.name));
  let n = 1;
  while (used.has(`スタイル${n}`)) {
    n += 1;
  }
  return `スタイル${n}`;
}

function StyleCard(props: {
  readonly style: IrNamedStyle;
  readonly commitDoc: (op: (document: IrDocument) => IrDocument) => void;
}): ReactNode {
  const { style, commitDoc } = props;

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
    <li className="apx-col-card">
      <div className="apx-col-row">
        <TextField label="名前" value={style.name} onCommit={onRename} />
        <button
          type="button"
          className="apx-col-btn apx-col-del"
          aria-label={`スタイル "${style.name}" を削除`}
          onClick={() =>
            commitDoc((document) => removeStyle(document, style.name))
          }
        >
          ×
        </button>
      </div>
      <p className="apx-sect-note">{attrSummary(style.attrs)}</p>
      {STYLE_ATTR_KEYS.map((key) => {
        const included = style.attrs[key] !== undefined;
        return (
          <div key={key} className="apx-col-row">
            <label className="apx-frow-label">
              <input
                type="checkbox"
                checked={included}
                onChange={(e) => toggleAttr(key, e.currentTarget.checked)}
              />
              {ATTR_LABELS[key]}
            </label>
            {included && key === "align" && (
              <SegmentField
                label={ATTR_LABELS.align}
                value={style.attrs.align ?? "left"}
                options={ALIGN_OPTIONS}
                onCommit={(align) => setAttrs({ ...style.attrs, align })}
              />
            )}
            {included && key === "fontWeight" && (
              <SegmentField
                label={ATTR_LABELS.fontWeight}
                value={style.attrs.fontWeight ?? "bold"}
                options={[
                  { value: "normal", label: "標準" },
                  { value: "bold", label: "太字" },
                ]}
                onCommit={(fontWeight) =>
                  setAttrs({ ...style.attrs, fontWeight })
                }
              />
            )}
            {included && key === "fontStyle" && (
              <SegmentField
                label={ATTR_LABELS.fontStyle}
                value={style.attrs.fontStyle ?? "italic"}
                options={[
                  { value: "normal", label: "正体" },
                  { value: "italic", label: "斜体" },
                ]}
                onCommit={(fontStyle) =>
                  setAttrs({ ...style.attrs, fontStyle })
                }
              />
            )}
            {included && key === "underline" && (
              <SegmentField
                label={ATTR_LABELS.underline}
                value={(style.attrs.underline ?? true) ? "on" : "off"}
                options={[
                  { value: "on", label: "あり" },
                  { value: "off", label: "なし" },
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
                  label={ATTR_LABELS[key]}
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
    const name = nextStyleName(styles);
    commitDoc((document) =>
      upsertStyle(document, { name, attrs: { fontSize: 10 } }),
    );
  };

  const onCreateFromSelection = (): void => {
    if (singleSelected === null) {
      return;
    }
    const style = styleFromElement(singleSelected, nextStyleName(styles));
    if (style === null) {
      return;
    }
    commitDoc((document) => upsertStyle(document, style));
  };

  return (
    <Dialog
      title="スタイル"
      onClose={onClose}
      wide
      footer={
        <button
          type="button"
          className="apx-btn apx-btn-secondary"
          onClick={onClose}
        >
          閉じる
        </button>
      }
    >
      <div className="apx-col-row">
        <button
          type="button"
          className="apx-btn apx-btn-secondary"
          onClick={onCreate}
        >
          ＋ 新しいスタイル
        </button>
        <button
          type="button"
          className="apx-btn apx-btn-secondary"
          disabled={!canCreateFromSelection}
          onClick={onCreateFromSelection}
        >
          選択要素から作成
        </button>
      </div>
      {styles.length === 0 ? (
        <p className="apx-props-empty">スタイルはまだありません。</p>
      ) : (
        <ul className="apx-col-list">
          {styles.map((style) => (
            <StyleCard key={style.name} style={style} commitDoc={commitDoc} />
          ))}
        </ul>
      )}
    </Dialog>
  );
}
