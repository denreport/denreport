import type { CompatTargetId, IrDocument, IrError } from "@denreport/core";
import { IR_VERSION, parseIr } from "@denreport/core";
import { createElement } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import type { ElementGroup } from "../state/groups";
import { embedGroups } from "../state/groups";
import type { SampleScenarioSet } from "../state/sample-scenarios";
import {
  parseSampleDataStorage,
  serializeSampleDataStorage,
} from "../state/sample-scenarios";
import { EditorStore } from "../state/store";
import { DesignerRoot } from "../ui/DesignerRoot";
import { triggerDownload } from "./download";

export type DesignerTheme = "light" | "dark" | "auto";

export const SAVE_FILE_NAME = "report-template.json";

/** React ツリーから Designer の機能（テーマ・保存・読込）に触る唯一の経路 */
export interface DesignerChrome {
  /** 現在の解決済みテーマ（"auto" は解決後の値になる）。トグルの表示状態に使う */
  readonly resolvedTheme: "light" | "dark";
  /** resolvedTheme の反転を明示テーマとして設定する（"auto" 追従からは抜ける） */
  readonly toggleTheme: () => void;
  /** 保存ボタンの動作: onSaveRequest リスナーがあれば通知、なければ saveIr + ダウンロード */
  readonly requestSave: () => void;
  /** 「開く」の読込。契約は公開 loadIr と同一（成功時は履歴クリア・onChange 発火） */
  readonly importIr: (json: string) => LoadIrResult;
}

export interface DesignerOptions {
  /** IR v1 の JSON 文字列。省略時は白紙文書（A4 縦・同梱フォント組・elements: []） */
  readonly initialIr?: string;
  /** サンプルデータのシナリオ一式の直列化文字列（getSampleData の返り値。封筒形式）
      またはレガシー生 JSON。省略時は既定1件（空 json）。
      不正な JSON も受理する（編集の常態。initialIr と異なり throw しない） */
  readonly initialSampleData?: string;
  /** 選択中の書き出しターゲット（getExportTarget の返り値）。省略時は "pdfme" */
  readonly initialExportTarget?: CompatTargetId;
  /** 省略時 "auto"（prefers-color-scheme 追従） */
  readonly theme?: DesignerTheme;
}

export type LoadIrResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly IrError[] };

const BLANK_DOCUMENT: IrDocument = {
  version: IR_VERSION,
  page: { width: 210, height: 297 },
  font: { regular: "NotoSansJP", bold: "NotoSansJPBold" },
  elements: [],
};

function parseInitialIr(json: string): IrDocument {
  const result = parseIr(json);
  if (!result.ok) {
    const detail = result.errors
      .map((e) => `${e.rule} ${e.path}: ${e.message}`)
      .join("\n");
    throw new Error(`initialIr が不正な IR です:\n${detail}`);
  }
  return result.document;
}

export class Designer {
  private readonly store: EditorStore;
  private readonly rootEl: HTMLElement;
  private readonly reactRoot: Root;
  private readonly unsubscribeStore: () => void;
  private readonly changeListeners = new Set<() => void>();
  private readonly saveRequestListeners = new Set<() => void>();
  private readonly sampleDataListeners = new Set<() => void>();
  private readonly exportTargetListeners = new Set<() => void>();
  private readonly mediaQuery: MediaQueryList;
  private readonly onMediaChange: () => void;
  private lastDocument: IrDocument;
  private lastGroups: readonly ElementGroup[];
  private lastSampleScenarios: SampleScenarioSet;
  private lastExportTarget: CompatTargetId;
  private theme: DesignerTheme;
  private destroyed = false;

  /** container の内容を占有してデザイナーを描画する。寸法はホストが container で制御する */
  constructor(container: HTMLElement, options?: DesignerOptions) {
    const initialDocument =
      options?.initialIr === undefined
        ? BLANK_DOCUMENT
        : parseInitialIr(options.initialIr);

    this.store = new EditorStore(
      initialDocument,
      options?.initialSampleData,
      options?.initialExportTarget,
    );
    this.lastDocument = initialDocument;
    this.lastGroups = this.store.getState().groups;
    this.lastSampleScenarios = this.store.getState().sampleScenarios;
    this.lastExportTarget = this.store.getState().selectedExportTarget;
    // 選択・ズーム等の変更ではホストに通知しないため、参照比較で通知対象を絞る。
    // group/ungroup は document を変えず groups だけを差し替えるため、両方を見る
    this.unsubscribeStore = this.store.subscribe(() => {
      const state = this.store.getState();
      const documentChanged = state.document !== this.lastDocument;
      const groupsChanged = state.groups !== this.lastGroups;
      if (documentChanged || groupsChanged) {
        this.lastDocument = state.document;
        this.lastGroups = state.groups;
        for (const listener of [...this.changeListeners]) {
          listener();
        }
      }
      if (state.sampleScenarios !== this.lastSampleScenarios) {
        this.lastSampleScenarios = state.sampleScenarios;
        for (const listener of [...this.sampleDataListeners]) {
          listener();
        }
      }
      if (state.selectedExportTarget !== this.lastExportTarget) {
        this.lastExportTarget = state.selectedExportTarget;
        for (const listener of [...this.exportTargetListeners]) {
          listener();
        }
      }
    });

    container.replaceChildren();
    this.rootEl = container.ownerDocument.createElement("div");
    this.rootEl.className = "apx-designer";
    container.append(this.rootEl);

    this.theme = options?.theme ?? "auto";
    this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.onMediaChange = () => {
      if (this.theme === "auto") {
        this.applyResolvedTheme();
      }
    };
    this.mediaQuery.addEventListener("change", this.onMediaChange);

    this.reactRoot = createRoot(this.rootEl);
    this.applyResolvedTheme();
  }

  /** IR JSON を読み込んで現在の文書を置き換える。失敗時は文書を変えず errors を返す。
      成功時は undo/redo 履歴をクリアし、変更通知を発火する */
  loadIr(json: string): LoadIrResult {
    this.assertAlive();
    const result = parseIr(json);
    if (!result.ok) {
      return { ok: false, errors: result.errors };
    }
    this.store.replaceDocument(result.document);
    return { ok: true };
  }

  /** 現在の文書を IR v1 JSON 文字列として返す（正規化済み = 任意属性のデフォルト明示済み）。
      グループ（生存分のみ）を groups キーへ書き込んだうえで直列化する */
  saveIr(): string {
    this.assertAlive();
    const state = this.store.getState();
    const json = JSON.stringify(embedGroups(state.document, state.groups));
    this.store.markSaved();
    return json;
  }

  /** 文書変更（編集の確定・undo/redo・loadIr）またはグループ変更（group/ungroup）で
      呼ばれるリスナーを登録し、解除関数を返す。選択・ズーム・ページ文脈の変更では発火しない */
  onChange(listener: () => void): () => void {
    this.assertAlive();
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  /** ツールバーの「保存」押下で呼ばれるリスナーを登録し、解除関数を返す。
      リスナーが1つ以上登録されているあいだ、保存の既定動作（IR JSON の
      ファイルダウンロード）は行われない */
  onSaveRequest(listener: () => void): () => void {
    this.assertAlive();
    this.saveRequestListeners.add(listener);
    return () => {
      this.saveRequestListeners.delete(listener);
    };
  }

  /** シナリオ一式の直列化文字列（封筒形式）を返す。自動保存・ホスト永続化用 */
  getSampleData(): string {
    this.assertAlive();
    return serializeSampleDataStorage(this.store.getState().sampleScenarios);
  }

  /** シナリオ一式を置き換える。封筒形式・レガシー生 JSON とも受理し throw しない。
      undo 履歴・dirty・onChange には影響せず、onSampleDataChange を発火する */
  setSampleData(json: string): void {
    this.assertAlive();
    this.store.setSampleScenarios(parseSampleDataStorage(json));
  }

  /** サンプルデータ変更（編集 UI・setSampleData）で呼ばれるリスナーを登録し、解除関数を返す。
      文書変更では発火しない（onChange と発火が分かれる） */
  onSampleDataChange(listener: () => void): () => void {
    this.assertAlive();
    this.sampleDataListeners.add(listener);
    return () => {
      this.sampleDataListeners.delete(listener);
    };
  }

  /** 現在選択中の書き出しターゲット。ホスト側の永続化用 */
  getExportTarget(): CompatTargetId {
    this.assertAlive();
    return this.store.getState().selectedExportTarget;
  }

  /** 書き出しターゲットの選択変更（ツールバー・書き出しダイアログ）で呼ばれる
      リスナーを登録し、解除関数を返す */
  onExportTargetChange(listener: () => void): () => void {
    this.assertAlive();
    this.exportTargetListeners.add(listener);
    return () => {
      this.exportTargetListeners.delete(listener);
    };
  }

  /** テーマを切り替える。"auto" は OS 設定に追従する */
  setTheme(theme: DesignerTheme): void {
    this.assertAlive();
    this.theme = theme;
    this.applyResolvedTheme();
  }

  /** React ツリーを破棄し container を空に戻す。冪等。destroy 後の他メソッド呼び出しは throw */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.reactRoot.unmount();
    this.unsubscribeStore();
    this.mediaQuery.removeEventListener("change", this.onMediaChange);
    this.rootEl.remove();
    this.changeListeners.clear();
    this.saveRequestListeners.clear();
    this.sampleDataListeners.clear();
    this.exportTargetListeners.clear();
  }

  private requestSave(): void {
    if (this.saveRequestListeners.size > 0) {
      for (const listener of [...this.saveRequestListeners]) {
        listener();
      }
      return;
    }
    triggerDownload(
      this.rootEl.ownerDocument,
      SAVE_FILE_NAME,
      new Blob([this.saveIr()], { type: "application/json" }),
    );
  }

  private applyResolvedTheme(): void {
    const resolved =
      this.theme === "auto"
        ? this.mediaQuery.matches
          ? "dark"
          : "light"
        : this.theme;
    this.rootEl.dataset.theme = resolved;
    const chrome: DesignerChrome = {
      resolvedTheme: resolved,
      toggleTheme: () => {
        this.setTheme(resolved === "dark" ? "light" : "dark");
      },
      requestSave: () => {
        this.requestSave();
      },
      importIr: (json) => this.loadIr(json),
    };
    this.reactRoot.render(
      createElement(DesignerRoot, { store: this.store, chrome }),
    );
  }

  private assertAlive(): void {
    if (this.destroyed) {
      throw new Error("この Designer は destroy 済みです");
    }
  }
}
