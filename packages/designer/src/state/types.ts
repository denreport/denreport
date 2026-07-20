import type { CompatTargetId, IrDocument, IrError } from "@denreport/core";
import type { EnvelopePresetId } from "./envelope-presets.js";
import type { RegisteredFont } from "./fonts.js";
import type { ElementGroup } from "./groups.js";
import type { CustomGuide } from "./guides.js";
import type { SampleScenarioSet } from "./sample-scenarios.js";

/** The edit view's context. IrPages' "all" is an attribute value shown in all contexts, not a context itself */
export type PageContext = "first" | "rest" | "last";

/** select: dragging selects/moves/resizes. pan: dragging scrolls the viewport */
export type CanvasMode = "select" | "pan";

export interface EditorViewState {
  /** 1.0 = 100% */
  readonly zoom: number;
  readonly pageContext: PageContext;
  readonly snapEnabled: boolean;
  readonly gridVisible: boolean;
  readonly canvasMode: CanvasMode;
}

export interface EditorState {
  /** The normalized IR. The sole source of truth for the document */
  readonly document: IrDocument;
  readonly selection: readonly string[];
  readonly view: EditorViewState;
  readonly validationErrors: readonly IrError[];
  /** Non-empty only for documents where docType is qualifiedInvoice. Does not block export/preview */
  readonly validationWarnings: readonly IrError[];
  /** Whether the document has changed since the last saveIr */
  readonly dirty: boolean;
  /** The full set of sample data scenarios. Preview-only. Invalid JSON is also kept as a
      normal editing state, treated independently of the document/history/dirty */
  readonly sampleScenarios: SampleScenarioSet;
  /** Fonts whose actual data has been fetched within the session (IR identifier name ->
      registered font). Independent of document/history/dirty (on par with sampleData). Not persisted */
  readonly fontRegistry: ReadonlyMap<string, RegisteredFont>;
  /** Permanent guides created from the ruler. Independent of document/history/dirty (on par with sampleData). Not persisted */
  readonly customGuides: readonly CustomGuide[];
  /** The currently selected envelope window preset. Independent of document/history/dirty. Not persisted */
  readonly envelopePresetId: EnvelopePresetId | null;
  /** The currently selected export target. Independent of document/history/dirty (on par with
      envelopePresetId). Not carried into the IR, but exposed via the Designer API so the host
      can persist it to localStorage etc. */
  readonly selectedExportTarget: CompatTargetId;
  /** A bundling of elements that can be selected all at once with a single click. Independent
      of document/history/dirty (on par with fontRegistry; group/ungroup does not commit).
      saveIr serializes the living ones by writing them into document.groups, and
      replaceDocument restores them from there */
  readonly groups: readonly ElementGroup[];
}
