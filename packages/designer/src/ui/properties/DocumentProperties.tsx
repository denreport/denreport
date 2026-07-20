import type { IrDocument, IrFontSlot } from "@denreport/core";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { useMessages } from "../../i18n/context";
import type { Messages } from "../../i18n/messages";
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
import { FontSelectorDialog } from "../fonts/FontSelectorDialog";
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

function resolutionNote(
  resolution: FontResolution | undefined,
  d: Messages["propertiesBulk"]["document"],
): string {
  if (resolution === undefined) {
    return d.unsetFallback;
  }
  switch (resolution.kind) {
    case "registered":
      return d.resolutionRegistered(resolution.font.displayName);
    case "embedded":
      return d.resolutionEmbedded;
    case "missing":
      return d.resolutionMissing;
  }
}

export function DocumentProperties(props: {
  readonly store: EditorStore;
}): ReactNode {
  const { store } = props;
  const m = useMessages();
  const state = useEditorState(store);
  const d = m.propertiesBulk.document;
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
        <span className="apx-props-id">{d.heading}</span>
      </div>
      <section className="apx-sect">
        <div className="apx-sect-h">{d.paperSection}</div>
        <SelectField<PaperPresetId | typeof CUSTOM_PAPER_PRESET>
          label={d.size}
          value={paperPresetId}
          options={[
            ...paperPresets.map((preset) => ({
              value: preset.id,
              label: m.paperPresets[preset.id],
            })),
            { value: CUSTOM_PAPER_PRESET, label: d.custom },
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
          label={d.width}
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
          label={d.height}
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
        <div className="apx-sect-h">{d.fontSection}</div>
        <TextField
          label={d.fontName}
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
                    {m.fonts.slotLabels[slot]}
                  </span>
                  <span className="apx-field">{name ?? d.unset}</span>
                </div>
              )}
              {slotError !== undefined && (
                <p className="apx-ferr" role="alert">
                  {slotError}
                </p>
              )}
              <p className="apx-sect-note">
                {m.fonts.slotLabels[slot]}:{" "}
                {slot === "regular" || name !== undefined
                  ? resolutionNote(resolutions.get(slot), d)
                  : d.unsetFallback}
              </p>
              {isLocalFontAccessSupported(window) && (
                <button
                  type="button"
                  className="apx-btn apx-btn-secondary"
                  onClick={() => setFontDialogSlot(slot)}
                >
                  {d.selectFont(m.fonts.slotLabels[slot])}
                </button>
              )}
            </div>
          );
        })}
        {!isLocalFontAccessSupported(window) && (
          <p className="apx-sect-note">{d.localFontUnsupported}</p>
        )}
      </section>
      <section className="apx-sect">
        <div className="apx-sect-h">{d.qualifiedInvoiceSection}</div>
        <div className="apx-frow">
          <span className="apx-frow-label">
            {d.qualifiedInvoiceCheck}
            <span className="apx-nowrap">{d.checkSuffix}</span>
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
            {d.enable}
          </label>
        </div>
      </section>
      <FootnotesSection
        store={store}
        document={state.document}
        errors={footnoteErrors}
      />
      <p className="apx-props-empty">{d.selectPrompt}</p>
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
