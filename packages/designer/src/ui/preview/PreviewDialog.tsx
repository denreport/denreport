import type { IrFontSlot } from "@denreport/core";
import {
  EMBEDDED_BOLD_FONT_NAME,
  EMBEDDED_BOLD_FONT_URL,
  EMBEDDED_FONT_URL,
  readCharWidths,
} from "@denreport/targets";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useMessages } from "../../i18n/context.js";
import type { Messages } from "../../i18n/messages/index.js";
import type { FontResolution } from "../../state/fonts.js";
import { resolveFontSet } from "../../state/fonts.js";
import { buildPreview, generateSampleData } from "../../state/preview.js";
import {
  activeSampleJson,
  addScenario,
  duplicateActiveScenario,
  removeScenario,
  renameScenario,
  selectScenario,
  updateActiveJson,
} from "../../state/sample-scenarios.js";
import type { EditorStore } from "../../state/store.js";
import { EMBEDDED_FONT_NAME } from "../fonts/font-registration.js";
import { useEditorState } from "../useEditorState.js";
import { PreviewPage } from "./PreviewPage.js";
import type { PreviewFont, PreviewFontSet } from "./preview-font.js";
import { loadPreviewFont, registerPreviewFace } from "./preview-font.js";
import { SampleDataEditor } from "./SampleDataEditor.js";
import { ScenarioBar } from "./ScenarioBar.js";

type PreviewMessages = Messages["preview"];

type FontState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly fonts: PreviewFontSet }
  | { readonly kind: "failed" };

const EMBEDDED_NAMES: ReadonlySet<string> = new Set([
  EMBEDDED_FONT_NAME,
  EMBEDDED_BOLD_FONT_NAME,
]);

// Register with a unique dr- prefixed name rather than the logical font name, to avoid colliding with a same-named font on the host page
const EMBEDDED_PREVIEW_FONTS: Readonly<
  Record<string, { readonly url: URL; readonly family: string }>
> = {
  [EMBEDDED_FONT_NAME]: {
    url: EMBEDDED_FONT_URL,
    family: "dr-embedded-notosansjp",
  },
  [EMBEDDED_BOLD_FONT_NAME]: {
    url: EMBEDDED_BOLD_FONT_URL,
    family: "dr-embedded-notosansjp-bold",
  },
};

async function loadSlotPreviewFont(
  doc: Document,
  resolution: FontResolution,
): Promise<PreviewFont> {
  if (resolution.kind === "registered") {
    const font = resolution.font;
    const charWidths = readCharWidths(font.data);
    if (charWidths === null) {
      throw new Error("Cannot read the font's char widths");
    }
    const family = await registerPreviewFace(doc, font.name, font.data);
    return { family, ascentPerEm: font.ascentPerEm, charWidths };
  }
  const embedded =
    resolution.kind === "embedded"
      ? EMBEDDED_PREVIEW_FONTS[resolution.name]
      : undefined;
  // missing (and unknown bundled names) fall back to the bundled regular for display
  const fallback = EMBEDDED_PREVIEW_FONTS[EMBEDDED_FONT_NAME] as {
    readonly url: URL;
    readonly family: string;
  };
  const target = embedded ?? fallback;
  return loadPreviewFont(doc, target.url, target.family);
}

function parseErrorOf(
  sampleData: string,
  m: PreviewMessages,
): string | undefined {
  if (sampleData.trim() === "") {
    return undefined;
  }
  try {
    JSON.parse(sampleData);
    return undefined;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return m.jsonParseError(detail);
  }
}

/** Full-screen preview overlay. Left: page list (vertical scroll), right: sample data pane */
export function PreviewDialog(props: {
  readonly store: EditorStore;
  readonly onClose: () => void;
}): ReactNode {
  const { store, onClose } = props;
  const m = useMessages();
  const locale = useLocale();
  const state = useEditorState(store);
  const activeJson = activeSampleJson(state.sampleScenarios);
  const rootRef = useRef<HTMLDivElement>(null);
  const [fontState, setFontState] = useState<FontState>({ kind: "loading" });
  const [confirmingGenerate, setConfirmingGenerate] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const resolutions = resolveFontSet(
    state.document.font,
    state.fontRegistry,
    EMBEDDED_NAMES,
  );
  const resolutionKey = [...resolutions.entries()]
    .map(([slot, resolution]) =>
      resolution.kind === "registered"
        ? `${slot}:registered:${resolution.font.name}`
        : `${slot}:${resolution.kind}:${resolution.name}`,
    )
    .join(",");

  // biome-ignore lint/correctness/useExhaustiveDependencies: resolutionKey represents changes to the resolution result
  useEffect(() => {
    const doc = rootRef.current?.ownerDocument;
    if (doc === undefined) {
      return;
    }
    let cancelled = false;
    const entries = [...resolutions.entries()];
    Promise.all(
      entries.map(([slot, resolution]) =>
        loadSlotPreviewFont(doc, resolution).then(
          (font) => [slot, font] as const,
        ),
      ),
    ).then(
      (loaded) => {
        if (cancelled) {
          return;
        }
        const bySlot = new Map<IrFontSlot, PreviewFont>(loaded);
        const regular = bySlot.get("regular");
        if (regular === undefined) {
          setFontState({ kind: "failed" });
          return;
        }
        const bold = bySlot.get("bold");
        const italic = bySlot.get("italic");
        const boldItalic = bySlot.get("boldItalic");
        setFontState({
          kind: "ready",
          fonts: {
            regular,
            ...(bold !== undefined ? { bold } : {}),
            ...(italic !== undefined ? { italic } : {}),
            ...(boldItalic !== undefined ? { boldItalic } : {}),
          },
        });
      },
      () => {
        if (!cancelled) {
          setFontState({ kind: "failed" });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [resolutionKey]);

  const hasValidationErrors = state.validationErrors.length > 0;
  const preview = useMemo(
    () =>
      hasValidationErrors
        ? undefined
        : buildPreview(state.document, activeJson, locale),
    [hasValidationErrors, state.document, activeJson, locale],
  );

  const bannerMessages: string[] = [];
  if (fontState.kind === "failed") {
    bannerMessages.push(m.preview.fontLoadFailed);
  }
  for (const [slot, resolution] of resolutions) {
    if (resolution.kind === "missing") {
      bannerMessages.push(
        m.preview.fontMissing(m.fonts.slotLabels[slot], resolution.name),
      );
    }
  }
  if (preview?.ok === true) {
    bannerMessages.push(...preview.warnings.map((warning) => warning.message));
  }

  const applyGenerated = (): void => {
    const current = store.getState();
    store.setSampleScenarios(
      updateActiveJson(
        current.sampleScenarios,
        generateSampleData(current.document),
      ),
    );
    setConfirmingGenerate(false);
  };
  const onGenerate = (): void => {
    if (activeJson.trim() === "") {
      applyGenerated();
    } else {
      setConfirmingGenerate(true);
    }
  };
  const confirmRemove = (): void => {
    store.setSampleScenarios(
      removeScenario(state.sampleScenarios, state.sampleScenarios.activeId),
    );
    setConfirmingRemove(false);
  };

  return (
    <div
      ref={rootRef}
      className="dr-preview"
      role="dialog"
      aria-modal="true"
      aria-label={m.preview.title}
    >
      <header className="dr-preview-bar">
        <span className="dr-preview-title">{m.preview.title}</span>
        {preview?.ok === true && (
          <span className="dr-preview-count">
            {m.preview.pageCount(preview.document.pageCount)}
          </span>
        )}
        <span className="dr-toolbar-spacer" />
        <button
          type="button"
          className="dr-btn dr-btn-secondary"
          onClick={onClose}
        >
          {m.preview.close}
        </button>
      </header>
      <div className="dr-preview-body">
        <div className="dr-preview-pages">
          {bannerMessages.length > 0 && (
            <div className="dr-preview-warnings" role="status">
              <ul>
                {bannerMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}
          {hasValidationErrors ? (
            <div className="dr-preview-error">
              <p>
                {m.preview.validationErrorsNote(state.validationErrors.length)}
              </p>
            </div>
          ) : preview !== undefined && !preview.ok ? (
            <div className="dr-preview-error">
              <p>{m.preview.cannotDisplay}</p>
              <ul className="dr-dialog-errors">
                {preview.errors.map((error, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: errors with the same rule / path can appear side by side, so identify by index
                  <li key={i}>
                    <span className="dr-verr-rule">{error.rule}</span>
                    <span className="dr-verr-path">{error.path}</span>
                    <span>{error.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : preview !== undefined && fontState.kind === "loading" ? (
            <div className="dr-preview-loading">{m.preview.loadingFont}</div>
          ) : preview !== undefined ? (
            preview.document.pages.map((elements, pageIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the page order is exactly the order of the rendered output
              <figure className="dr-preview-sheet" key={pageIndex}>
                <figcaption className="dr-preview-pageno">
                  {pageIndex + 1} / {preview.document.pageCount}
                </figcaption>
                <div className="dr-preview-page">
                  <PreviewPage
                    elements={elements}
                    page={preview.document.page}
                    fonts={fontState.kind === "ready" ? fontState.fonts : null}
                  />
                </div>
              </figure>
            ))
          ) : null}
        </div>
        <aside className="dr-preview-side">
          <ScenarioBar
            scenarios={state.sampleScenarios}
            onSelect={(id) =>
              store.setSampleScenarios(
                selectScenario(state.sampleScenarios, id),
              )
            }
            onAdd={() =>
              store.setSampleScenarios(
                addScenario(state.sampleScenarios, m.scenarioNames),
              )
            }
            onDuplicate={() =>
              store.setSampleScenarios(
                duplicateActiveScenario(state.sampleScenarios, m.scenarioNames),
              )
            }
            onRemove={() => setConfirmingRemove(true)}
            onRename={(name) =>
              store.setSampleScenarios(
                renameScenario(
                  state.sampleScenarios,
                  state.sampleScenarios.activeId,
                  name,
                ),
              )
            }
          />
          <SampleDataEditor
            value={activeJson}
            onCommit={(json) =>
              store.setSampleScenarios(
                updateActiveJson(state.sampleScenarios, json),
              )
            }
            onGenerate={onGenerate}
            parseError={parseErrorOf(activeJson, m.preview)}
          />
        </aside>
      </div>
      {confirmingRemove && (
        <div className="dr-dialog-scrim">
          <div
            className="dr-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={m.preview.removeScenario.ariaLabel}
          >
            <div className="dr-dialog-h">
              {m.preview.removeScenario.heading}
            </div>
            <div className="dr-dialog-b">
              <p>{m.preview.removeScenario.body}</p>
            </div>
            <div className="dr-dialog-f">
              <button
                type="button"
                className="dr-btn dr-btn-secondary"
                onClick={() => setConfirmingRemove(false)}
              >
                {m.preview.removeScenario.cancel}
              </button>
              <button
                type="button"
                className="dr-btn dr-btn-primary"
                onClick={confirmRemove}
              >
                {m.preview.removeScenario.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmingGenerate && (
        <div className="dr-dialog-scrim">
          <div
            className="dr-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={m.preview.regenerateSample.ariaLabel}
          >
            <div className="dr-dialog-h">
              {m.preview.regenerateSample.heading}
            </div>
            <div className="dr-dialog-b">
              <p>{m.preview.regenerateSample.body}</p>
            </div>
            <div className="dr-dialog-f">
              <button
                type="button"
                className="dr-btn dr-btn-secondary"
                onClick={() => setConfirmingGenerate(false)}
              >
                {m.preview.regenerateSample.cancel}
              </button>
              <button
                type="button"
                className="dr-btn dr-btn-primary"
                onClick={applyGenerated}
              >
                {m.preview.regenerateSample.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
