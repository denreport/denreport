import type { IrFontSlot } from "@denreport/core";
import {
  EMBEDDED_BOLD_FONT_NAME,
  EMBEDDED_BOLD_FONT_URL,
  EMBEDDED_FONT_URL,
  readCharWidths,
} from "@denreport/targets";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FontResolution } from "../../state/fonts";
import { resolveFontSet } from "../../state/fonts";
import { buildPreview, generateSampleData } from "../../state/preview";
import {
  activeSampleJson,
  addScenario,
  duplicateActiveScenario,
  removeScenario,
  renameScenario,
  selectScenario,
  updateActiveJson,
} from "../../state/sample-scenarios";
import type { EditorStore } from "../../state/store";
import { FONT_SLOT_LABELS } from "../fonts/FontSelectorDialog";
import { EMBEDDED_FONT_NAME } from "../fonts/font-registration";
import { useEditorState } from "../useEditorState";
import { PreviewPage } from "./PreviewPage";
import type { PreviewFont, PreviewFontSet } from "./preview-font";
import { loadPreviewFont, registerPreviewFace } from "./preview-font";
import { SampleDataEditor } from "./SampleDataEditor";
import { ScenarioBar } from "./ScenarioBar";

type FontState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly fonts: PreviewFontSet }
  | { readonly kind: "failed" };

const EMBEDDED_NAMES: ReadonlySet<string> = new Set([
  EMBEDDED_FONT_NAME,
  EMBEDDED_BOLD_FONT_NAME,
]);

// ホストページの同名フォントと衝突しないよう、論理フォント名ではなく apx- 接頭辞の一意名で登録する
const EMBEDDED_PREVIEW_FONTS: Readonly<
  Record<string, { readonly url: URL; readonly family: string }>
> = {
  [EMBEDDED_FONT_NAME]: {
    url: EMBEDDED_FONT_URL,
    family: "apx-embedded-notosansjp",
  },
  [EMBEDDED_BOLD_FONT_NAME]: {
    url: EMBEDDED_BOLD_FONT_URL,
    family: "apx-embedded-notosansjp-bold",
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
      throw new Error("フォントの字幅を読み取れません");
    }
    const family = await registerPreviewFace(doc, font.name, font.data);
    return { family, ascentPerEm: font.ascentPerEm, charWidths };
  }
  const embedded =
    resolution.kind === "embedded"
      ? EMBEDDED_PREVIEW_FONTS[resolution.name]
      : undefined;
  // missing（および未知の同梱名）は同梱 regular で代替表示する
  const fallback = EMBEDDED_PREVIEW_FONTS[EMBEDDED_FONT_NAME] as {
    readonly url: URL;
    readonly family: string;
  };
  const target = embedded ?? fallback;
  return loadPreviewFont(doc, target.url, target.family);
}

function parseErrorOf(sampleData: string): string | undefined {
  if (sampleData.trim() === "") {
    return undefined;
  }
  try {
    JSON.parse(sampleData);
    return undefined;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return `JSON として解釈できません: ${detail}`;
  }
}

/** プレビューの全面オーバーレイ。左: ページ列（縦スクロール）、右: サンプルデータ欄 */
export function PreviewDialog(props: {
  readonly store: EditorStore;
  readonly onClose: () => void;
}): ReactNode {
  const { store, onClose } = props;
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: resolutionKey が解決結果の変化を代表する
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
        : buildPreview(state.document, activeJson),
    [hasValidationErrors, state.document, activeJson],
  );

  const bannerMessages: string[] = [];
  if (fontState.kind === "failed") {
    bannerMessages.push(
      "同梱フォントを読み込めなかったため、システムフォントで表示しています",
    );
  }
  for (const [slot, resolution] of resolutions) {
    if (resolution.kind === "missing") {
      bannerMessages.push(
        `${FONT_SLOT_LABELS[slot]}フォント「${resolution.name}」の実データが未選択のため、同梱フォントで表示しています。文書設定の「PC のフォントから選択」で選び直せます`,
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
      className="apx-preview"
      role="dialog"
      aria-modal="true"
      aria-label="プレビュー"
    >
      <header className="apx-preview-bar">
        <span className="apx-preview-title">プレビュー</span>
        {preview?.ok === true && (
          <span className="apx-preview-count">
            {preview.document.pageCount} ページ
          </span>
        )}
        <span className="apx-toolbar-spacer" />
        <button
          type="button"
          className="apx-btn apx-btn-secondary"
          onClick={onClose}
        >
          閉じる
        </button>
      </header>
      <div className="apx-preview-body">
        <div className="apx-preview-pages">
          {bannerMessages.length > 0 && (
            <div className="apx-preview-warnings" role="status">
              <ul>
                {bannerMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}
          {hasValidationErrors ? (
            <div className="apx-preview-error">
              <p>
                検証エラーが {state.validationErrors.length}{" "}
                件あります。検証エラーを解消してください。
              </p>
            </div>
          ) : preview !== undefined && !preview.ok ? (
            <div className="apx-preview-error">
              <p>プレビューを表示できません。</p>
              <ul className="apx-dialog-errors">
                {preview.errors.map((error, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: 同一 rule / path のエラーが並び得るため index で識別する
                  <li key={i}>
                    <span className="apx-verr-rule">{error.rule}</span>
                    <span className="apx-verr-path">{error.path}</span>
                    <span>{error.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : preview !== undefined && fontState.kind === "loading" ? (
            <div className="apx-preview-loading">
              フォントを読み込んでいます…
            </div>
          ) : preview !== undefined ? (
            preview.document.pages.map((elements, pageIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: ページは展開結果の並びそのもの
              <figure className="apx-preview-sheet" key={pageIndex}>
                <figcaption className="apx-preview-pageno">
                  {pageIndex + 1} / {preview.document.pageCount}
                </figcaption>
                <div className="apx-preview-page">
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
        <aside className="apx-preview-side">
          <ScenarioBar
            scenarios={state.sampleScenarios}
            onSelect={(id) =>
              store.setSampleScenarios(
                selectScenario(state.sampleScenarios, id),
              )
            }
            onAdd={() =>
              store.setSampleScenarios(addScenario(state.sampleScenarios))
            }
            onDuplicate={() =>
              store.setSampleScenarios(
                duplicateActiveScenario(state.sampleScenarios),
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
            parseError={parseErrorOf(activeJson)}
          />
        </aside>
      </div>
      {confirmingRemove && (
        <div className="apx-dialog-scrim">
          <div
            className="apx-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="シナリオの削除"
          >
            <div className="apx-dialog-h">シナリオの削除</div>
            <div className="apx-dialog-b">
              <p>現在のシナリオを削除します。続行しますか？</p>
            </div>
            <div className="apx-dialog-f">
              <button
                type="button"
                className="apx-btn apx-btn-secondary"
                onClick={() => setConfirmingRemove(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="apx-btn apx-btn-primary"
                onClick={confirmRemove}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmingGenerate && (
        <div className="apx-dialog-scrim">
          <div
            className="apx-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="サンプルデータの上書き"
          >
            <div className="apx-dialog-h">サンプルデータの上書き</div>
            <div className="apx-dialog-b">
              <p>
                現在のサンプルデータを生成した内容で置き換えます。続行しますか？
              </p>
            </div>
            <div className="apx-dialog-f">
              <button
                type="button"
                className="apx-btn apx-btn-secondary"
                onClick={() => setConfirmingGenerate(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="apx-btn apx-btn-primary"
                onClick={applyGenerated}
              >
                置き換える
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
