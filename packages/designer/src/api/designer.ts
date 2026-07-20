import type { CompatTargetId, IrDocument, IrError } from "@denreport/core";
import { IR_VERSION, parseIr } from "@denreport/core";
import { createElement } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import type { DesignerLocale, Locale } from "../i18n/locale";
import { resolveLocale } from "../i18n/locale";
import { getMessages } from "../i18n/messages";
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
export type { DesignerLocale };

export const SAVE_FILE_NAME = "report-template.json";

/** The sole channel from the React tree to reach Designer's capabilities (theme, locale, save, load) */
export interface DesignerChrome {
  /** The current resolved theme ("auto" becomes the resolved value). Used for the toggle's display state */
  readonly resolvedTheme: "light" | "dark";
  /** Sets the inverse of resolvedTheme as the explicit theme (exits "auto" following) */
  readonly toggleTheme: () => void;
  /** Save button behavior: notifies onSaveRequest listeners if any are registered, otherwise saveIr + download */
  readonly requestSave: () => void;
  /** The load for "Open". Same contract as the public loadIr (on success, clears history and fires onChange) */
  readonly importIr: (json: string) => LoadIrResult;
  /** The current resolved locale ("auto" becomes the resolved value). Used for the switch button's display */
  readonly locale: Locale;
  /** Sets the inverse of the resolved locale as the explicit locale (exits "auto" following) */
  readonly toggleLocale: () => void;
}

export interface DesignerOptions {
  /** IR v1 JSON string. If omitted, a blank document (A4 portrait, bundled font set, elements: []) */
  readonly initialIr?: string;
  /** A serialized string of the full set of sample-data scenarios (the return value of getSampleData,
      envelope format), or legacy raw JSON. If omitted, defaults to a single entry (empty json).
      Also accepts invalid JSON (a normal state while editing; unlike initialIr, this does not throw) */
  readonly initialSampleData?: string;
  /** The currently selected export target (the return value of getExportTarget). Defaults to "pdfme" if omitted */
  readonly initialExportTarget?: CompatTargetId;
  /** Defaults to "auto" (follows prefers-color-scheme) */
  readonly theme?: DesignerTheme;
  /** Defaults to "auto" (determines ja/en from navigator.languages) */
  readonly locale?: DesignerLocale;
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
  private readonly localeChangeListeners = new Set<() => void>();
  private readonly mediaQuery: MediaQueryList;
  private readonly onMediaChange: () => void;
  private lastDocument: IrDocument;
  private lastGroups: readonly ElementGroup[];
  private lastSampleScenarios: SampleScenarioSet;
  private lastExportTarget: CompatTargetId;
  private theme: DesignerTheme;
  private locale: DesignerLocale;
  private destroyed = false;

  /** Takes over container's contents to render the designer. Dimensions are controlled by the host via container */
  constructor(container: HTMLElement, options?: DesignerOptions) {
    const initialDocument =
      options?.initialIr === undefined
        ? BLANK_DOCUMENT
        : parseInitialIr(options.initialIr);
    const initialLocale = options?.locale ?? "auto";

    this.store = new EditorStore(
      initialDocument,
      options?.initialSampleData,
      options?.initialExportTarget,
      getMessages(resolveLocale(initialLocale, navigator.languages))
        .scenarioNames,
    );
    this.lastDocument = initialDocument;
    this.lastGroups = this.store.getState().groups;
    this.lastSampleScenarios = this.store.getState().sampleScenarios;
    this.lastExportTarget = this.store.getState().selectedExportTarget;
    // Notifications to the host are narrowed by reference comparison, since changes such as
    // selection/zoom should not notify the host. group/ungroup replaces only groups without
    // changing document, so both are checked
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
    this.locale = initialLocale;
    this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.onMediaChange = () => {
      if (this.theme === "auto") {
        this.render();
      }
    };
    this.mediaQuery.addEventListener("change", this.onMediaChange);

    this.reactRoot = createRoot(this.rootEl);
    this.render();
  }

  /** Loads IR JSON and replaces the current document. On failure, leaves the document unchanged
      and returns errors. On success, clears the undo/redo history and fires the change notification */
  loadIr(json: string): LoadIrResult {
    this.assertAlive();
    const result = parseIr(json, { locale: this.getLocale() });
    if (!result.ok) {
      return { ok: false, errors: result.errors };
    }
    this.store.replaceDocument(result.document);
    return { ok: true };
  }

  /** Returns the current document as an IR v1 JSON string (normalized = optional attributes have
      explicit defaults filled in). Serializes after writing groups (surviving ones only) to the groups key */
  saveIr(): string {
    this.assertAlive();
    const state = this.store.getState();
    const json = JSON.stringify(embedGroups(state.document, state.groups));
    this.store.markSaved();
    return json;
  }

  /** Registers a listener called on document changes (committing an edit, undo/redo, loadIr) or
      group changes (group/ungroup), and returns an unsubscribe function. Does not fire on
      selection, zoom, or page-context changes */
  onChange(listener: () => void): () => void {
    this.assertAlive();
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  /** Registers a listener called when the toolbar's "Save" is pressed, and returns an unsubscribe
      function. While one or more listeners are registered, the default save behavior (downloading
      the IR JSON as a file) does not happen */
  onSaveRequest(listener: () => void): () => void {
    this.assertAlive();
    this.saveRequestListeners.add(listener);
    return () => {
      this.saveRequestListeners.delete(listener);
    };
  }

  /** Returns a serialized string of the full set of scenarios (envelope format). For autosave / host persistence */
  getSampleData(): string {
    this.assertAlive();
    return serializeSampleDataStorage(this.store.getState().sampleScenarios);
  }

  /** Replaces the full set of scenarios. Accepts both envelope format and legacy raw JSON, and
      does not throw. Does not affect undo history, dirty, or onChange; fires onSampleDataChange */
  setSampleData(json: string): void {
    this.assertAlive();
    this.store.setSampleScenarios(
      parseSampleDataStorage(json, getMessages(this.getLocale()).scenarioNames),
    );
  }

  /** Registers a listener called on sample-data changes (edit UI, setSampleData), and returns an
      unsubscribe function. Does not fire on document changes (firing is separate from onChange) */
  onSampleDataChange(listener: () => void): () => void {
    this.assertAlive();
    this.sampleDataListeners.add(listener);
    return () => {
      this.sampleDataListeners.delete(listener);
    };
  }

  /** The currently selected export target. For host-side persistence */
  getExportTarget(): CompatTargetId {
    this.assertAlive();
    return this.store.getState().selectedExportTarget;
  }

  /** Registers a listener called on export target selection changes (toolbar, export dialog),
      and returns an unsubscribe function */
  onExportTargetChange(listener: () => void): () => void {
    this.assertAlive();
    this.exportTargetListeners.add(listener);
    return () => {
      this.exportTargetListeners.delete(listener);
    };
  }

  /** Switches the theme. "auto" follows the OS setting */
  setTheme(theme: DesignerTheme): void {
    this.assertAlive();
    this.theme = theme;
    this.render();
  }

  /** Switches the locale. "auto" follows navigator.languages */
  setLocale(locale: DesignerLocale): void {
    this.assertAlive();
    const previousResolved = this.getLocale();
    this.locale = locale;
    this.render();
    if (this.getLocale() !== previousResolved) {
      for (const listener of [...this.localeChangeListeners]) {
        listener();
      }
    }
  }

  /** The current resolved locale. For host-side persistence */
  getLocale(): Locale {
    this.assertAlive();
    return resolveLocale(this.locale, navigator.languages);
  }

  /** Registers a listener called on locale changes (switch button, setLocale), and returns an unsubscribe function */
  onLocaleChange(listener: () => void): () => void {
    this.assertAlive();
    this.localeChangeListeners.add(listener);
    return () => {
      this.localeChangeListeners.delete(listener);
    };
  }

  /** Unmounts the React tree and empties container. Idempotent. Calling other methods after destroy throws */
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
    this.localeChangeListeners.clear();
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

  private render(): void {
    const resolvedTheme =
      this.theme === "auto"
        ? this.mediaQuery.matches
          ? "dark"
          : "light"
        : this.theme;
    const resolvedLocale = resolveLocale(this.locale, navigator.languages);
    this.store.setLocale(resolvedLocale);
    this.rootEl.dataset.theme = resolvedTheme;
    this.rootEl.lang = resolvedLocale;
    const chrome: DesignerChrome = {
      resolvedTheme,
      toggleTheme: () => {
        this.setTheme(resolvedTheme === "dark" ? "light" : "dark");
      },
      requestSave: () => {
        this.requestSave();
      },
      importIr: (json) => this.loadIr(json),
      locale: resolvedLocale,
      toggleLocale: () => {
        this.setLocale(resolvedLocale === "ja" ? "en" : "ja");
      },
    };
    this.reactRoot.render(
      createElement(DesignerRoot, {
        store: this.store,
        chrome,
        locale: resolvedLocale,
      }),
    );
  }

  private assertAlive(): void {
    if (this.destroyed) {
      throw new Error("この Designer は destroy 済みです");
    }
  }
}
