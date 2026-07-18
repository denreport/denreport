import type { IrDocument } from "@denreport/core";
import { checkQualifiedInvoice, validateIr } from "@denreport/core";
import type { ClipboardState } from "./clipboard";
import type { EnvelopePresetId } from "./envelope-presets";
import type { RegisteredFont } from "./fonts";
import type { ElementGroup } from "./groups";
import type { CustomGuide } from "./guides";
import type { HistoryEntry } from "./history";
import { History } from "./history";
import type { SampleScenarioSet } from "./sample-scenarios";
import { parseSampleDataStorage } from "./sample-scenarios";
import type { EditorState, EditorViewState } from "./types";

const INITIAL_VIEW: EditorViewState = {
  zoom: 1,
  pageContext: "first",
  snapEnabled: true,
  gridVisible: true,
  canvasMode: "select",
};

/** 編集状態の保持・更新・購読。React には依存しない */
export class EditorStore {
  #state: EditorState;
  readonly #history = new History();
  readonly #listeners = new Set<() => void>();
  #clipboard: ClipboardState | null = null;

  constructor(initialDocument: IrDocument, initialSampleData?: string) {
    this.#state = {
      document: initialDocument,
      selection: [],
      view: INITIAL_VIEW,
      validationErrors: validateIr(initialDocument),
      validationWarnings: checkQualifiedInvoice(initialDocument),
      dirty: false,
      sampleScenarios: parseSampleDataStorage(initialSampleData ?? ""),
      fontRegistry: new Map(),
      customGuides: [],
      envelopePresetId: null,
      groups: [],
    };
  }

  getState(): EditorState {
    return this.#state;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** 文書更新の唯一の入口。履歴に1エントリ積み、検証を再計算し、dirty にする */
  commit(document: IrDocument, selection?: readonly string[]): void {
    this.#history.push({
      document: this.#state.document,
      selection: this.#state.selection,
    });
    this.#setState({
      ...this.#state,
      document,
      selection: selection ?? this.#state.selection,
      validationErrors: validateIr(document),
      validationWarnings: checkQualifiedInvoice(document),
      dirty: true,
    });
  }

  /** 履歴をクリアして文書を置き換える。選択も外れ、dirty は下りる。
      グループは文書ごとに再利用される id との偶発一致を避けるため空にリセットする */
  replaceDocument(document: IrDocument): void {
    this.#history.clear();
    this.#setState({
      ...this.#state,
      document,
      selection: [],
      validationErrors: validateIr(document),
      validationWarnings: checkQualifiedInvoice(document),
      dirty: false,
      groups: [],
    });
  }

  setSelection(ids: readonly string[]): void {
    this.#setState({ ...this.#state, selection: ids });
  }

  setView(view: Partial<EditorViewState>): void {
    this.#setState({
      ...this.#state,
      view: { ...this.#state.view, ...view },
    });
  }

  /** 履歴に積まず、dirty を変えない状態変更（setView と同格）。購読者には通知する。
      シナリオ操作（切替・追加・複製・削除・改名・json 編集）の唯一の入口 */
  setSampleScenarios(set: SampleScenarioSet): void {
    this.#setState({ ...this.#state, sampleScenarios: set });
  }

  /** 履歴に積まず、dirty を変えない状態変更（setSampleData と同格）。購読者には通知する */
  setCustomGuides(guides: readonly CustomGuide[]): void {
    this.#setState({ ...this.#state, customGuides: guides });
  }

  /** 履歴に積まず、dirty を変えない状態変更（setSampleData と同格）。購読者には通知する */
  setEnvelopePreset(id: EnvelopePresetId | null): void {
    this.#setState({ ...this.#state, envelopePresetId: id });
  }

  /** 履歴に積まず、dirty を変えない状態変更（setSampleData と同格）。購読者には通知する */
  setGroups(groups: readonly ElementGroup[]): void {
    this.#setState({ ...this.#state, groups });
  }

  markSaved(): void {
    this.#setState({ ...this.#state, dirty: false });
  }

  getClipboard(): ClipboardState | null {
    return this.#clipboard;
  }

  /** 履歴外・購読者への通知もしない（クリップボードを読む UI がないため） */
  setClipboard(clipboard: ClipboardState): void {
    this.#clipboard = clipboard;
  }

  /** レジストリに font.name キーで追加（同名は上書き）。履歴に積まず dirty を変えない。
      購読者には通知する。replaceDocument（IR 読込）でもレジストリは維持する */
  registerFont(font: RegisteredFont): void {
    const fontRegistry = new Map(this.#state.fontRegistry);
    fontRegistry.set(font.name, font);
    this.#setState({ ...this.#state, fontRegistry });
  }

  undo(): void {
    this.#restore(
      this.#history.undo({
        document: this.#state.document,
        selection: this.#state.selection,
      }),
    );
  }

  redo(): void {
    this.#restore(
      this.#history.redo({
        document: this.#state.document,
        selection: this.#state.selection,
      }),
    );
  }

  canUndo(): boolean {
    return this.#history.canUndo();
  }

  canRedo(): boolean {
    return this.#history.canRedo();
  }

  #restore(entry: HistoryEntry | undefined): void {
    if (entry === undefined) {
      return;
    }
    this.#setState({
      ...this.#state,
      document: entry.document,
      selection: entry.selection,
      validationErrors: validateIr(entry.document),
      validationWarnings: checkQualifiedInvoice(entry.document),
      dirty: true,
    });
  }

  #setState(next: EditorState): void {
    this.#state = next;
    for (const listener of [...this.#listeners]) {
      listener();
    }
  }
}
