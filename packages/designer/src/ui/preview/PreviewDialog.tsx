import { readCharWidths } from "@denreport/targets";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { resolveFont } from "../../state/fonts";
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
import { EMBEDDED_FONT_NAME } from "../fonts/font-registration";
import { useEditorState } from "../useEditorState";
import { PreviewPage } from "./PreviewPage";
import type { PreviewFont } from "./preview-font";
import { loadPreviewFont, registerPreviewFace } from "./preview-font";
import { SampleDataEditor } from "./SampleDataEditor";
import { ScenarioBar } from "./ScenarioBar";

type FontState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly font: PreviewFont }
  | { readonly kind: "failed" };

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

  const resolution = resolveFont(
    state.document.font.name,
    state.fontRegistry,
    EMBEDDED_FONT_NAME,
  );
  const resolutionKey =
    resolution.kind === "registered" ? resolution.font.name : resolution.kind;

  // biome-ignore lint/correctness/useExhaustiveDependencies: resolutionKey が解決結果の変化を代表する
  useEffect(() => {
    const doc = rootRef.current?.ownerDocument;
    if (doc === undefined) {
      return;
    }
    let cancelled = false;
    if (resolution.kind === "registered") {
      const font = resolution.font;
      const charWidths = readCharWidths(font.data);
      if (charWidths === null) {
        setFontState({ kind: "failed" });
      } else {
        registerPreviewFace(doc, font.name, font.data).then(
          (family) => {
            if (!cancelled) {
              setFontState({
                kind: "ready",
                font: { family, ascentPerEm: font.ascentPerEm, charWidths },
              });
            }
          },
          () => {
            if (!cancelled) {
              setFontState({ kind: "failed" });
            }
          },
        );
      }
    } else {
      loadPreviewFont(doc).then(
        (font) => {
          if (!cancelled) {
            setFontState({ kind: "ready", font });
          }
        },
        () => {
          if (!cancelled) {
            setFontState({ kind: "failed" });
          }
        },
      );
    }
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
  if (resolution.kind === "missing") {
    bannerMessages.push(
      `フォント「${resolution.name}」の実データが未選択のため、同梱フォントで表示しています。文書設定の「PC のフォントから選択」で選び直せます`,
    );
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
                    font={fontState.kind === "ready" ? fontState.font : null}
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
