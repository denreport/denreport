import type { IrDocument, IrFontSlot } from "@denreport/core";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { errorMessageFor } from "../../state/error-index";
import type { FontResolution } from "../../state/fonts";
import { resolveFontSet } from "../../state/fonts";
import {
  type PaperPresetId,
  paperPresetIdForSize,
  paperPresetsForLanguage,
} from "../../state/paper-presets";
import {
  setDocType,
  setFontRegular,
  setFontSlot,
  setPage,
} from "../../state/properties";
import type { EditorStore } from "../../state/store";
import {
  FONT_SLOT_LABELS,
  FontSelectorDialog,
} from "../fonts/FontSelectorDialog";
import {
  EMBEDDED_BOLD_FONT_NAME,
  EMBEDDED_FONT_NAME,
} from "../fonts/font-registration";
import { isLocalFontAccessSupported } from "../fonts/local-fonts";
import { useEditorState } from "../useEditorState";
import { FootnotesSection } from "./FootnotesSection";
import { NumberField, SelectField, TextField } from "./fields";

/** どのプリセットとも寸法が一致しないときの select 表示値 */
const CUSTOM_PAPER_PRESET = "custom";

const FONT_SLOTS: readonly IrFontSlot[] = [
  "regular",
  "bold",
  "italic",
  "boldItalic",
];

const EMBEDDED_NAMES: ReadonlySet<string> = new Set([
  EMBEDDED_FONT_NAME,
  EMBEDDED_BOLD_FONT_NAME,
]);

function resolutionNote(resolution: FontResolution | undefined): string {
  if (resolution === undefined) {
    return "未設定（標準フォントで代替されます）";
  }
  switch (resolution.kind) {
    case "registered":
      return `実データ: ${resolution.font.displayName}`;
    case "embedded":
      return "実データ: 同梱フォント";
    case "missing":
      return "実データ未選択（同梱フォントで代替されます）";
  }
}

export function DocumentProperties(props: {
  readonly store: EditorStore;
}): ReactNode {
  const { store } = props;
  const state = useEditorState(store);
  const [fontDialogSlot, setFontDialogSlot] = useState<IrFontSlot | null>(null);
  const docTypeCheckId = useId();
  const pageErrors = state.validationErrors.filter((error) =>
    error.path.startsWith("page."),
  );
  const footnoteErrors = state.validationErrors.filter((error) =>
    error.path.startsWith("footnotes."),
  );
  const fontError = state.validationErrors.find(
    (error) => error.path === "font.regular",
  )?.message;
  const resolutions = resolveFontSet(
    state.document.font,
    state.fontRegistry,
    EMBEDDED_NAMES,
  );
  const paperPresets = paperPresetsForLanguage(navigator.language);
  const paperPresetId =
    paperPresetIdForSize(
      paperPresets,
      state.document.page.width,
      state.document.page.height,
    ) ?? CUSTOM_PAPER_PRESET;

  const commitDoc = (op: (document: IrDocument) => IrDocument): void => {
    const document = store.getState().document;
    const updated = op(document);
    if (updated !== document) {
      store.commit(updated);
    }
  };

  return (
    <>
      <div className="apx-props-head">
        <span className="apx-props-id">文書設定</span>
      </div>
      <section className="apx-sect">
        <div className="apx-sect-h">用紙</div>
        <SelectField<PaperPresetId | typeof CUSTOM_PAPER_PRESET>
          label="サイズ"
          value={paperPresetId}
          options={[
            ...paperPresets.map((preset) => ({
              value: preset.id,
              label: preset.label,
            })),
            { value: CUSTOM_PAPER_PRESET, label: "カスタム" },
          ]}
          onCommit={(id) => {
            const preset = paperPresets.find((p) => p.id === id);
            if (preset === undefined) {
              return;
            }
            commitDoc((document) =>
              setPage(document, { width: preset.width, height: preset.height }),
            );
          }}
        />
        <NumberField
          label="幅"
          value={state.document.page.width}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(pageErrors, "width")}
          onCommit={(width) =>
            commitDoc((document) =>
              setPage(document, { ...document.page, width }),
            )
          }
        />
        <NumberField
          label="高さ"
          value={state.document.page.height}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(pageErrors, "height")}
          onCommit={(height) =>
            commitDoc((document) =>
              setPage(document, { ...document.page, height }),
            )
          }
        />
      </section>
      <section className="apx-sect">
        <div className="apx-sect-h">フォント</div>
        <TextField
          label="フォント名"
          value={state.document.font.regular}
          mono
          error={fontError}
          onCommit={(name) =>
            commitDoc((document) => setFontRegular(document, name))
          }
        />
        {FONT_SLOTS.map((slot) => {
          const name = state.document.font[slot];
          const slotError =
            slot === "regular"
              ? undefined
              : state.validationErrors.find(
                  (error) => error.path === `font.${slot}`,
                )?.message;
          return (
            <div key={slot}>
              {slot !== "regular" && (
                <div className="apx-frow">
                  <span className="apx-frow-label">
                    {FONT_SLOT_LABELS[slot]}
                  </span>
                  <span className="apx-field">{name ?? "未設定"}</span>
                </div>
              )}
              {slotError !== undefined && (
                <p className="apx-ferr" role="alert">
                  {slotError}
                </p>
              )}
              <p className="apx-sect-note">
                {FONT_SLOT_LABELS[slot]}:{" "}
                {slot === "regular" || name !== undefined
                  ? resolutionNote(resolutions.get(slot))
                  : "未設定（標準フォントで代替されます）"}
              </p>
              {isLocalFontAccessSupported(window) && (
                <button
                  type="button"
                  className="apx-btn apx-btn-secondary"
                  onClick={() => setFontDialogSlot(slot)}
                >
                  {FONT_SLOT_LABELS[slot]}のフォントを選択…
                </button>
              )}
            </div>
          );
        })}
        {!isLocalFontAccessSupported(window) && (
          <p className="apx-sect-note">
            お使いのブラウザは PC
            内フォントの一覧取得に対応していません（Chromium
            系ブラウザで利用できます）。
          </p>
        )}
      </section>
      <section className="apx-sect">
        <div className="apx-sect-h">適格請求書</div>
        <div className="apx-frow">
          <span className="apx-frow-label">
            記載事項<span className="apx-nowrap">チェック</span>
          </span>
          <label className="apx-check" htmlFor={docTypeCheckId}>
            <input
              id={docTypeCheckId}
              type="checkbox"
              checked={state.document.docType === "qualifiedInvoice"}
              onChange={(e) =>
                commitDoc((document) =>
                  setDocType(document, e.currentTarget.checked),
                )
              }
            />
            有効化
          </label>
        </div>
      </section>
      <FootnotesSection
        store={store}
        document={state.document}
        errors={footnoteErrors}
      />
      <p className="apx-props-empty">要素を選択すると属性を編集できます。</p>
      {fontDialogSlot !== null && (
        <FontSelectorDialog
          slot={fontDialogSlot}
          currentName={state.document.font[fontDialogSlot]}
          onSelect={(font) => {
            store.registerFont(font);
            commitDoc((document) =>
              fontDialogSlot === "regular"
                ? setFontRegular(document, font.name)
                : setFontSlot(document, fontDialogSlot, font.name),
            );
            setFontDialogSlot(null);
          }}
          onSelectEmbedded={(name) => {
            commitDoc((document) =>
              fontDialogSlot === "regular"
                ? setFontRegular(document, name)
                : setFontSlot(document, fontDialogSlot, name),
            );
            setFontDialogSlot(null);
          }}
          onClear={() => {
            if (fontDialogSlot !== "regular") {
              commitDoc((document) =>
                setFontSlot(document, fontDialogSlot, undefined),
              );
            }
            setFontDialogSlot(null);
          }}
          onClose={() => setFontDialogSlot(null)}
        />
      )}
    </>
  );
}
