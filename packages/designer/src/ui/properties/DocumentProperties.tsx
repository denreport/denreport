import type { IrDocument } from "@denreport/core";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { errorMessageFor } from "../../state/error-index";
import { resolveFont } from "../../state/fonts";
import {
  type PaperPresetId,
  paperPresetIdForSize,
  paperPresetsForLanguage,
} from "../../state/paper-presets";
import { setDocType, setFontName, setPage } from "../../state/properties";
import type { EditorStore } from "../../state/store";
import { FontSelectorDialog } from "../fonts/FontSelectorDialog";
import { EMBEDDED_FONT_NAME } from "../fonts/font-registration";
import { isLocalFontAccessSupported } from "../fonts/local-fonts";
import { useEditorState } from "../useEditorState";
import { FootnotesSection } from "./FootnotesSection";
import { NumberField, SelectField, TextField } from "./fields";

/** どのプリセットとも寸法が一致しないときの select 表示値 */
const CUSTOM_PAPER_PRESET = "custom";

export function DocumentProperties(props: {
  readonly store: EditorStore;
}): ReactNode {
  const { store } = props;
  const state = useEditorState(store);
  const [fontDialogOpen, setFontDialogOpen] = useState(false);
  const docTypeCheckId = useId();
  const pageErrors = state.validationErrors.filter((error) =>
    error.path.startsWith("page."),
  );
  const footnoteErrors = state.validationErrors.filter((error) =>
    error.path.startsWith("footnotes."),
  );
  const fontError = state.validationErrors.find(
    (error) => error.path === "font.name",
  )?.message;
  const resolution = resolveFont(
    state.document.font.name,
    state.fontRegistry,
    EMBEDDED_FONT_NAME,
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
          value={state.document.font.name}
          mono
          error={fontError}
          onCommit={(name) =>
            commitDoc((document) => setFontName(document, name))
          }
        />
        <p className="apx-sect-note">
          {resolution.kind === "registered" &&
            `実データ: ${resolution.font.displayName}`}
          {resolution.kind === "embedded" && "実データ: 同梱フォント"}
          {resolution.kind === "missing" &&
            "実データ未選択（同梱フォントで代替されます）"}
        </p>
        {isLocalFontAccessSupported(window) ? (
          <button
            type="button"
            className="apx-btn apx-btn-secondary"
            onClick={() => setFontDialogOpen(true)}
          >
            PC のフォントから選択…
          </button>
        ) : (
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
      {fontDialogOpen && (
        <FontSelectorDialog
          currentName={state.document.font.name}
          onSelect={(font) => {
            store.registerFont(font);
            commitDoc((document) => setFontName(document, font.name));
            setFontDialogOpen(false);
          }}
          onSelectEmbedded={() => {
            commitDoc((document) => setFontName(document, EMBEDDED_FONT_NAME));
            setFontDialogOpen(false);
          }}
          onClose={() => setFontDialogOpen(false)}
        />
      )}
    </>
  );
}
