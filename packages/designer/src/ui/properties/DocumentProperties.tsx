import type { IrDocument, IrFontSlot } from "@denreport/core";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { useLocale, useMessages } from "../../i18n/context.js";
import type { Messages } from "../../i18n/messages/index.js";
import { errorMessageFor } from "../../state/error-index.js";
import type { FontResolution } from "../../state/fonts.js";
import { resolveFontSet } from "../../state/fonts.js";
import {
  type PaperPresetId,
  paperPresetIdForSize,
  paperPresetsForLanguage,
} from "../../state/paper-presets.js";
import {
  setDocType,
  setFontRegular,
  setFontSlot,
  setPage,
} from "../../state/properties.js";
import type { EditorStore } from "../../state/store.js";
import { FontSelectorDialog } from "../fonts/FontSelectorDialog.js";
import {
  EMBEDDED_BOLD_FONT_NAME,
  EMBEDDED_FONT_NAME,
} from "../fonts/font-registration.js";
import { isLocalFontAccessSupported } from "../fonts/local-fonts.js";
import { useEditorState } from "../useEditorState.js";
import { FootnotesSection } from "./FootnotesSection.js";
import { NumberField, SelectField, TextField } from "./fields.js";

/** Select display value when the dimensions don't match any preset */
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
  const locale = useLocale();
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
  const paperPresets = paperPresetsForLanguage(locale);
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
      <div className="dr-props-head">
        <span className="dr-props-id">{d.heading}</span>
      </div>
      <section className="dr-sect">
        <div className="dr-sect-h">{d.paperSection}</div>
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
      <section className="dr-sect">
        <div className="dr-sect-h">{d.fontSection}</div>
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
                <div className="dr-frow">
                  <span className="dr-frow-label">
                    {m.fonts.slotLabels[slot]}
                  </span>
                  <span className="dr-field">{name ?? d.unset}</span>
                </div>
              )}
              {slotError !== undefined && (
                <p className="dr-ferr" role="alert">
                  {slotError}
                </p>
              )}
              <p className="dr-sect-note">
                {m.fonts.slotLabels[slot]}:{" "}
                {slot === "regular" || name !== undefined
                  ? resolutionNote(resolutions.get(slot), d)
                  : d.unsetFallback}
              </p>
              {isLocalFontAccessSupported(window) && (
                <button
                  type="button"
                  className="dr-btn dr-btn-secondary"
                  onClick={() => setFontDialogSlot(slot)}
                >
                  {d.selectFont(m.fonts.slotLabels[slot])}
                </button>
              )}
            </div>
          );
        })}
        {!isLocalFontAccessSupported(window) && (
          <p className="dr-sect-note">{d.localFontUnsupported}</p>
        )}
      </section>
      <section className="dr-sect">
        <div className="dr-sect-h">{d.qualifiedInvoiceSection}</div>
        <div className="dr-frow">
          <span className="dr-frow-label">
            {d.qualifiedInvoiceCheck}
            <span className="dr-nowrap">{d.checkSuffix}</span>
          </span>
          <label className="dr-check" htmlFor={docTypeCheckId}>
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
      <p className="dr-props-empty">{d.selectPrompt}</p>
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
