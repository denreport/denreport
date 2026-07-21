import type { IrDocument, IrTextElement } from "@denreport/core";
import { describe, expect, it } from "vitest";
import type { ClipboardState } from "./clipboard";
import type { RegisteredFont } from "./fonts";
import { activeSampleJson, updateActiveJson } from "./sample-scenarios";
import { EditorStore } from "./store";

function textElement(id: string, x: number, text = "見本"): IrTextElement {
  return {
    type: "text",
    id,
    x,
    y: 10,
    pages: "first",
    w: 50,
    h: 10,
    text,
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  };
}

function makeDocument(elements: readonly IrTextElement[] = []): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements,
  };
}

function makeInvoiceDocument(
  elements: readonly IrTextElement[] = [],
): IrDocument {
  return { ...makeDocument(elements), docType: "qualifiedInvoice" };
}

describe("EditorStore", () => {
  it("initial state is non-dirty, no selection, default view", () => {
    const store = new EditorStore(makeDocument());
    const state = store.getState();
    expect(state.dirty).toBe(false);
    expect(state.selection).toEqual([]);
    expect(state.view).toEqual({
      zoom: 1,
      pageContext: "first",
      snapEnabled: true,
      gridVisible: true,
      canvasMode: "select",
    });
    expect(state.validationErrors).toEqual([]);
    expect(state.validationWarnings).toEqual([]);
  });

  it("commit creates a new state object, leaving the old reference unchanged", () => {
    const store = new EditorStore(makeDocument());
    const before = store.getState();

    store.commit(makeDocument([textElement("t1", 10)]), ["t1"]);

    const after = store.getState();
    expect(after).not.toBe(before);
    expect(before.document.elements).toEqual([]);
    expect(before.selection).toEqual([]);
    expect(before.dirty).toBe(false);
    expect(after.document.elements).toHaveLength(1);
    expect(after.selection).toEqual(["t1"]);
  });

  it("commit / replaceDocument / setSelection / setView / markSaved each notify subscribers", () => {
    const store = new EditorStore(makeDocument());
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });

    store.commit(makeDocument([textElement("t1", 10)]));
    store.replaceDocument(makeDocument());
    store.setSelection(["t1"]);
    store.setView({ zoom: 1.5 });
    store.markSaved();
    expect(notified).toBe(5);
  });

  it("subscribe's unsubscribe function stops notifications", () => {
    const store = new EditorStore(makeDocument());
    let notified = 0;
    const unsubscribe = store.subscribe(() => {
      notified += 1;
    });
    unsubscribe();
    store.commit(makeDocument([textElement("t1", 10)]));
    expect(notified).toBe(0);
  });

  it("validationErrors are recomputed after commit", () => {
    const store = new EditorStore(makeDocument());
    expect(store.getState().validationErrors).toEqual([]);

    // x=500 exceeds the paper width of 210mm, so it becomes M02
    store.commit(makeDocument([textElement("t1", 500)]));
    const rules = store.getState().validationErrors.map((e) => e.rule);
    expect(rules).toContain("M02");

    store.commit(makeDocument([textElement("t1", 10)]));
    expect(store.getState().validationErrors).toEqual([]);
  });

  it("setLocale re-validates the current document and notifies subscribers", () => {
    const store = new EditorStore(makeDocument([textElement("t1", 500)]));
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });
    const jaMessage = store.getState().validationErrors[0]?.message;

    store.setLocale("en");
    expect(notified).toBe(1);
    const enMessage = store.getState().validationErrors[0]?.message;
    expect(enMessage).toBeDefined();
    expect(enMessage).not.toBe(jaMessage);

    store.setLocale("en");
    expect(notified).toBe(1);
  });

  it("commit after setLocale also validates in the switched language", () => {
    const store = new EditorStore(makeDocument());
    store.setLocale("en");
    store.commit(makeDocument([textElement("t1", 500)]));
    const enMessage = store.getState().validationErrors[0]?.message;

    const jaStore = new EditorStore(makeDocument([textElement("t1", 500)]));
    expect(enMessage).not.toBe(jaStore.getState().validationErrors[0]?.message);
  });

  it("validationWarnings are recomputed on commit / replaceDocument / undo", () => {
    const store = new EditorStore(makeInvoiceDocument());
    expect(store.getState().validationWarnings.length).toBe(6);

    store.commit(
      makeInvoiceDocument([textElement("t1", 10, "{registrationNumber}")]),
    );
    expect(store.getState().validationWarnings.length).toBe(5);

    store.undo();
    expect(store.getState().validationWarnings.length).toBe(6);

    store.replaceDocument(makeDocument());
    expect(store.getState().validationWarnings).toEqual([]);
  });

  it("dirty is set by commit and cleared by markSaved", () => {
    const store = new EditorStore(makeDocument());
    store.commit(makeDocument([textElement("t1", 10)]));
    expect(store.getState().dirty).toBe(true);
    store.markSaved();
    expect(store.getState().dirty).toBe(false);
  });

  it("replaceDocument clears history and selection and drops dirty", () => {
    const store = new EditorStore(makeDocument());
    store.commit(makeDocument([textElement("t1", 10)]), ["t1"]);
    expect(store.canUndo()).toBe(true);

    store.replaceDocument(makeDocument());
    const state = store.getState();
    expect(store.canUndo()).toBe(false);
    expect(store.canRedo()).toBe(false);
    expect(state.selection).toEqual([]);
    expect(state.dirty).toBe(false);
  });

  it("undo / redo round-trip the document and selection, and setSelection / setView aren't pushed to history", () => {
    const initial = makeDocument();
    const edited = makeDocument([textElement("t1", 10)]);
    const store = new EditorStore(initial);

    store.commit(edited, ["t1"]);
    store.setView({ zoom: 2 });

    store.undo();
    expect(store.getState().document).toBe(initial);
    expect(store.getState().selection).toEqual([]);
    expect(store.getState().view.zoom).toBe(2);
    expect(store.canUndo()).toBe(false);
    expect(store.canRedo()).toBe(true);

    store.redo();
    expect(store.getState().document).toBe(edited);
    expect(store.getState().selection).toEqual(["t1"]);
    expect(store.canUndo()).toBe(true);
    expect(store.canRedo()).toBe(false);
  });

  it("undo / redo do nothing when history is empty", () => {
    const store = new EditorStore(makeDocument());
    const before = store.getState();
    store.undo();
    store.redo();
    expect(store.getState()).toBe(before);
  });
});

describe("EditorStore sample data", () => {
  it("defaults to one scenario when omitted, and the constructor argument (legacy raw JSON) becomes that scenario's json", () => {
    expect(
      activeSampleJson(
        new EditorStore(makeDocument()).getState().sampleScenarios,
      ),
    ).toBe("");
    expect(
      activeSampleJson(
        new EditorStore(makeDocument(), '{"a": 1}').getState().sampleScenarios,
      ),
    ).toBe('{"a": 1}');
  });

  it("setSampleScenarios notifies subscribers and doesn't affect history or dirty", () => {
    const store = new EditorStore(makeDocument());
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });

    store.setSampleScenarios(
      updateActiveJson(store.getState().sampleScenarios, '{"a": 1}'),
    );
    expect(notified).toBe(1);
    expect(activeSampleJson(store.getState().sampleScenarios)).toBe('{"a": 1}');
    expect(store.canUndo()).toBe(false);
    expect(store.getState().dirty).toBe(false);
  });

  it("undo reverts the document but not the sample data", () => {
    const initial = makeDocument();
    const store = new EditorStore(initial, "v1");
    store.commit(makeDocument([textElement("t1", 10)]));
    store.setSampleScenarios(
      updateActiveJson(store.getState().sampleScenarios, "v2"),
    );

    store.undo();
    expect(store.getState().document).toBe(initial);
    expect(activeSampleJson(store.getState().sampleScenarios)).toBe("v2");
  });

  it("replaceDocument preserves the sample data", () => {
    const store = new EditorStore(makeDocument(), '{"a": 1}');
    store.replaceDocument(makeDocument([textElement("t1", 10)]));
    expect(activeSampleJson(store.getState().sampleScenarios)).toBe('{"a": 1}');
  });
});

describe("EditorStore clipboard", () => {
  const clipboard: ClipboardState = {
    elements: [textElement("t1", 10)],
    pasteCount: 0,
    groupIndexes: [],
  };

  it("initial value is null", () => {
    const store = new EditorStore(makeDocument());
    expect(store.getClipboard()).toBeNull();
  });

  it("setClipboard doesn't notify listeners and doesn't change getState()'s result (including dirty)", () => {
    const store = new EditorStore(makeDocument());
    const before = store.getState();
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });

    store.setClipboard(clipboard);

    expect(notified).toBe(0);
    expect(store.getState()).toBe(before);
    expect(store.getClipboard()).toEqual(clipboard);
  });

  it("clipboard is unchanged across undo / redo", () => {
    const store = new EditorStore(makeDocument());
    store.commit(makeDocument([textElement("t1", 10)]), ["t1"]);
    store.setClipboard(clipboard);

    store.undo();
    expect(store.getClipboard()).toEqual(clipboard);
    store.redo();
    expect(store.getClipboard()).toEqual(clipboard);
  });
});

describe("EditorStore custom guides and envelope preset", () => {
  it("initial value is an empty array and null", () => {
    const state = new EditorStore(makeDocument()).getState();
    expect(state.customGuides).toEqual([]);
    expect(state.envelopePresetId).toBeNull();
  });

  it("setCustomGuides / setEnvelopePreset notify subscribers and don't affect history or dirty", () => {
    const store = new EditorStore(makeDocument());
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });

    store.setCustomGuides([{ id: "guide1", axis: "x", positionMm: 10 }]);
    store.setEnvelopePreset("l3-w80h45");

    expect(notified).toBe(2);
    expect(store.getState().customGuides).toEqual([
      { id: "guide1", axis: "x", positionMm: 10 },
    ]);
    expect(store.getState().envelopePresetId).toBe("l3-w80h45");
    expect(store.canUndo()).toBe(false);
    expect(store.getState().dirty).toBe(false);
  });

  it("preserved across undo / redo, commit, and replaceDocument", () => {
    const store = new EditorStore(makeDocument());
    store.setCustomGuides([{ id: "guide1", axis: "y", positionMm: 20 }]);
    store.setEnvelopePreset("l3-w90h55");

    store.commit(makeDocument([textElement("t1", 10)]));
    store.undo();
    expect(store.getState().customGuides).toEqual([
      { id: "guide1", axis: "y", positionMm: 20 },
    ]);
    expect(store.getState().envelopePresetId).toBe("l3-w90h55");

    store.replaceDocument(makeDocument());
    expect(store.getState().customGuides).toEqual([
      { id: "guide1", axis: "y", positionMm: 20 },
    ]);
    expect(store.getState().envelopePresetId).toBe("l3-w90h55");
  });
});

describe("EditorStore export target", () => {
  it("the default initial value is pdfme", () => {
    const state = new EditorStore(makeDocument()).getState();
    expect(state.selectedExportTarget).toBe("pdfme");
  });

  it("the initial value can be specified via the third constructor argument", () => {
    const state = new EditorStore(
      makeDocument(),
      undefined,
      "reportlab",
    ).getState();
    expect(state.selectedExportTarget).toBe("reportlab");
  });

  it("setSelectedExportTarget notifies subscribers and doesn't affect history or dirty", () => {
    const store = new EditorStore(makeDocument());
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });

    store.setSelectedExportTarget("reportlab");

    expect(notified).toBe(1);
    expect(store.getState().selectedExportTarget).toBe("reportlab");
    expect(store.canUndo()).toBe(false);
    expect(store.getState().dirty).toBe(false);
  });

  it("preserved across undo / redo, commit, and replaceDocument", () => {
    const store = new EditorStore(makeDocument());
    store.setSelectedExportTarget("reportlab");

    store.commit(makeDocument([textElement("t1", 10)]));
    store.undo();
    expect(store.getState().selectedExportTarget).toBe("reportlab");

    store.replaceDocument(makeDocument());
    expect(store.getState().selectedExportTarget).toBe("reportlab");
  });
});

function registeredFont(name: string): RegisteredFont {
  return {
    name,
    displayName: name,
    data: new Uint8Array([1, 2, 3]),
    ascentPerEm: 1,
  };
}

describe("EditorStore font registry", () => {
  it("initial state is empty", () => {
    expect(new EditorStore(makeDocument()).getState().fontRegistry.size).toBe(
      0,
    );
  });

  it("registerFont notifies subscribers and adds to the registry", () => {
    const store = new EditorStore(makeDocument());
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });

    store.registerFont(registeredFont("IPAexGothic"));
    expect(notified).toBe(1);
    expect(store.getState().fontRegistry.get("IPAexGothic")).toEqual(
      registeredFont("IPAexGothic"),
    );
  });

  it("isn't pushed to history and doesn't change dirty", () => {
    const store = new EditorStore(makeDocument());
    store.registerFont(registeredFont("IPAexGothic"));
    expect(store.canUndo()).toBe(false);
    expect(store.getState().dirty).toBe(false);
  });

  it("the same name overwrites", () => {
    const store = new EditorStore(makeDocument());
    store.registerFont(registeredFont("IPAexGothic"));
    const updated: RegisteredFont = {
      ...registeredFont("IPAexGothic"),
      displayName: "IPAex ゴシック（更新）",
    };
    store.registerFont(updated);
    expect(store.getState().fontRegistry.size).toBe(1);
    expect(store.getState().fontRegistry.get("IPAexGothic")).toEqual(updated);
  });

  it("the registry is preserved across undo / redo, commit, and replaceDocument", () => {
    const store = new EditorStore(makeDocument());
    store.registerFont(registeredFont("IPAexGothic"));

    store.commit(makeDocument([textElement("t1", 10)]));
    store.undo();
    expect(store.getState().fontRegistry.get("IPAexGothic")).toBeDefined();

    store.replaceDocument(makeDocument());
    expect(store.getState().fontRegistry.get("IPAexGothic")).toBeDefined();
  });
});

describe("EditorStore groups", () => {
  it("initial state is empty", () => {
    expect(new EditorStore(makeDocument()).getState().groups).toEqual([]);
  });

  it("setGroups notifies subscribers and doesn't affect history or dirty", () => {
    const store = new EditorStore(makeDocument());
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });

    store.setGroups([{ id: "group1", memberIds: ["a", "b"] }]);
    expect(notified).toBe(1);
    expect(store.getState().groups).toEqual([
      { id: "group1", memberIds: ["a", "b"] },
    ]);
    expect(store.canUndo()).toBe(false);
    expect(store.getState().dirty).toBe(false);
  });

  it("replaceDocument empties groups when the new document has none", () => {
    const store = new EditorStore(makeDocument());
    store.setGroups([{ id: "group1", memberIds: ["a", "b"] }]);

    store.replaceDocument(makeDocument([textElement("t1", 10)]));
    expect(store.getState().groups).toEqual([]);
  });

  it("replaceDocument restores groups from document.groups", () => {
    const store = new EditorStore(makeDocument());
    const document: IrDocument = {
      ...makeDocument([textElement("t1", 10), textElement("t2", 60)]),
      groups: [{ id: "group1", memberIds: ["t1", "t2"] }],
    };

    store.replaceDocument(document);
    expect(store.getState().groups).toEqual([
      { id: "group1", memberIds: ["t1", "t2"] },
    ]);
  });

  it("replaceDocument doesn't restore a group with fewer than 2 surviving members", () => {
    const store = new EditorStore(makeDocument());
    const document: IrDocument = {
      ...makeDocument([textElement("t1", 10)]),
      groups: [{ id: "group1", memberIds: ["t1", "ghost"] }],
    };

    store.replaceDocument(document);
    expect(store.getState().groups).toEqual([]);
  });

  it("groups are unchanged across undo / redo", () => {
    const store = new EditorStore(makeDocument());
    store.commit(makeDocument([textElement("t1", 10)]), ["t1"]);
    store.setGroups([{ id: "group1", memberIds: ["t1"] }]);

    store.undo();
    expect(store.getState().groups).toEqual([
      { id: "group1", memberIds: ["t1"] },
    ]);
  });
});
