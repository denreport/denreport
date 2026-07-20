import type { CompatTargetId, IrDocument, IrError } from "@denreport/core";
import { checkQualifiedInvoice, validateIr } from "@denreport/core";
import type { Locale } from "../i18n/locale.js";
import { ja } from "../i18n/messages/ja.js";
import type { ClipboardState } from "./clipboard.js";
import type { EnvelopePresetId } from "./envelope-presets.js";
import type { RegisteredFont } from "./fonts.js";
import type { ElementGroup } from "./groups.js";
import { livingGroups } from "./groups.js";
import type { CustomGuide } from "./guides.js";
import type { HistoryEntry } from "./history.js";
import { History } from "./history.js";
import type {
  SampleScenarioSet,
  ScenarioMessages,
} from "./sample-scenarios.js";
import { parseSampleDataStorage } from "./sample-scenarios.js";
import type { EditorState, EditorViewState } from "./types.js";

const INITIAL_VIEW: EditorViewState = {
  zoom: 1,
  pageContext: "first",
  snapEnabled: true,
  gridVisible: true,
  canvasMode: "select",
};

/** Holds, updates, and lets callers subscribe to edit state. Does not depend on React */
export class EditorStore {
  #state: EditorState;
  readonly #history = new History();
  readonly #listeners = new Set<() => void>();
  #clipboard: ClipboardState | null = null;
  #locale: Locale = "ja";

  constructor(
    initialDocument: IrDocument,
    initialSampleData?: string,
    initialExportTarget?: CompatTargetId,
    // Defaults to ja. Most callers (existing tests, etc.) are locale-agnostic, hence a default
    messages: ScenarioMessages = ja.scenarioNames,
  ) {
    this.#state = {
      document: initialDocument,
      selection: [],
      view: INITIAL_VIEW,
      ...this.#validation(initialDocument),
      dirty: false,
      sampleScenarios: parseSampleDataStorage(
        initialSampleData ?? "",
        messages,
      ),
      fontRegistry: new Map(),
      customGuides: [],
      envelopePresetId: null,
      selectedExportTarget: initialExportTarget ?? "pdfme",
      groups: [],
    };
  }

  getState(): EditorState {
    return this.#state;
  }

  #validation(document: IrDocument): {
    readonly validationErrors: readonly IrError[];
    readonly validationWarnings: readonly IrError[];
  } {
    const options = { locale: this.#locale };
    return {
      validationErrors: validateIr(document, options),
      validationWarnings: checkQualifiedInvoice(document, options),
    };
  }

  /** Switches the validation message language and re-validates the current document.
      Not part of edit state, so it isn't stored on EditorState — only the result is updated */
  setLocale(locale: Locale): void {
    if (locale === this.#locale) {
      return;
    }
    this.#locale = locale;
    this.#setState({
      ...this.#state,
      ...this.#validation(this.#state.document),
    });
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** The sole entry point for document updates. Pushes one history entry, recomputes validation, and marks dirty */
  commit(document: IrDocument, selection?: readonly string[]): void {
    this.#history.push({
      document: this.#state.document,
      selection: this.#state.selection,
    });
    this.#setState({
      ...this.#state,
      document,
      selection: selection ?? this.#state.selection,
      ...this.#validation(document),
      dirty: true,
    });
  }

  /** Clears history and replaces the document. Selection is also cleared, and dirty is lowered.
      Groups are restored from document.groups (with the living-groups filter applied; empty when the key is omitted) */
  replaceDocument(document: IrDocument): void {
    this.#history.clear();
    this.#setState({
      ...this.#state,
      document,
      selection: [],
      ...this.#validation(document),
      dirty: false,
      groups:
        document.groups !== undefined
          ? livingGroups(document.groups, document)
          : [],
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

  /** A state change that doesn't push to history and doesn't affect dirty (on par with setView). Notifies subscribers.
      The sole entry point for scenario operations (switch, add, duplicate, delete, rename, json edit) */
  setSampleScenarios(set: SampleScenarioSet): void {
    this.#setState({ ...this.#state, sampleScenarios: set });
  }

  /** A state change that doesn't push to history and doesn't affect dirty (on par with setSampleData). Notifies subscribers */
  setCustomGuides(guides: readonly CustomGuide[]): void {
    this.#setState({ ...this.#state, customGuides: guides });
  }

  /** A state change that doesn't push to history and doesn't affect dirty (on par with setSampleData). Notifies subscribers */
  setEnvelopePreset(id: EnvelopePresetId | null): void {
    this.#setState({ ...this.#state, envelopePresetId: id });
  }

  /** A state change that doesn't push to history and doesn't affect dirty (on par with setEnvelopePreset). Notifies subscribers */
  setSelectedExportTarget(target: CompatTargetId): void {
    this.#setState({ ...this.#state, selectedExportTarget: target });
  }

  /** A state change that doesn't push to history and doesn't affect dirty (on par with setSampleData). Notifies subscribers */
  setGroups(groups: readonly ElementGroup[]): void {
    this.#setState({ ...this.#state, groups });
  }

  markSaved(): void {
    this.#setState({ ...this.#state, dirty: false });
  }

  getClipboard(): ClipboardState | null {
    return this.#clipboard;
  }

  /** Outside history, and doesn't notify subscribers either (no UI reads the clipboard) */
  setClipboard(clipboard: ClipboardState): void {
    this.#clipboard = clipboard;
  }

  /** Adds to the registry keyed by font.name (same name overwrites). Doesn't push to history or affect dirty.
      Notifies subscribers. The registry is preserved even across replaceDocument (IR load) */
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
      ...this.#validation(entry.document),
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
