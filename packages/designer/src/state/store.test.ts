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
    font: { name: "NotoSansJP" },
    elements,
  };
}

function makeInvoiceDocument(
  elements: readonly IrTextElement[] = [],
): IrDocument {
  return { ...makeDocument(elements), docType: "qualifiedInvoice" };
}

describe("EditorStore", () => {
  it("初期状態は非 dirty・選択なし・既定ビュー", () => {
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

  it("commit は新しい状態オブジェクトを生成し、旧参照は不変のまま", () => {
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

  it("commit / replaceDocument / setSelection / setView / markSaved のそれぞれで購読者に通知される", () => {
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

  it("subscribe の解除関数で通知が止まる", () => {
    const store = new EditorStore(makeDocument());
    let notified = 0;
    const unsubscribe = store.subscribe(() => {
      notified += 1;
    });
    unsubscribe();
    store.commit(makeDocument([textElement("t1", 10)]));
    expect(notified).toBe(0);
  });

  it("commit 後に validationErrors が再計算される", () => {
    const store = new EditorStore(makeDocument());
    expect(store.getState().validationErrors).toEqual([]);

    // x=500 は用紙幅 210mm を超えるため M02 になる
    store.commit(makeDocument([textElement("t1", 500)]));
    const rules = store.getState().validationErrors.map((e) => e.rule);
    expect(rules).toContain("M02");

    store.commit(makeDocument([textElement("t1", 10)]));
    expect(store.getState().validationErrors).toEqual([]);
  });

  it("commit / replaceDocument / undo で validationWarnings が再計算される", () => {
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

  it("dirty は commit で立ち、markSaved で下りる", () => {
    const store = new EditorStore(makeDocument());
    store.commit(makeDocument([textElement("t1", 10)]));
    expect(store.getState().dirty).toBe(true);
    store.markSaved();
    expect(store.getState().dirty).toBe(false);
  });

  it("replaceDocument は履歴と選択をクリアし dirty を下ろす", () => {
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

  it("undo / redo で文書と選択が往復し、setSelection / setView は履歴に積まれない", () => {
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

  it("履歴が空の undo / redo は何もしない", () => {
    const store = new EditorStore(makeDocument());
    const before = store.getState();
    store.undo();
    store.redo();
    expect(store.getState()).toBe(before);
  });
});

describe("EditorStore のサンプルデータ", () => {
  it("省略時は既定1件のシナリオ、コンストラクタ引数（レガシー生 JSON）はそのシナリオの json になる", () => {
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

  it("setSampleScenarios は購読者に通知し、履歴にも dirty にも影響しない", () => {
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

  it("undo で文書は戻るがサンプルデータは戻らない", () => {
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

  it("replaceDocument はサンプルデータを維持する", () => {
    const store = new EditorStore(makeDocument(), '{"a": 1}');
    store.replaceDocument(makeDocument([textElement("t1", 10)]));
    expect(activeSampleJson(store.getState().sampleScenarios)).toBe('{"a": 1}');
  });
});

describe("EditorStore のクリップボード", () => {
  const clipboard: ClipboardState = {
    elements: [textElement("t1", 10)],
    pasteCount: 0,
    groupIndexes: [],
  };

  it("初期値は null", () => {
    const store = new EditorStore(makeDocument());
    expect(store.getClipboard()).toBeNull();
  });

  it("setClipboard はリスナーに通知せず、getState() の結果（dirty 含む）も変えない", () => {
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

  it("undo / redo してもクリップボードは変わらない", () => {
    const store = new EditorStore(makeDocument());
    store.commit(makeDocument([textElement("t1", 10)]), ["t1"]);
    store.setClipboard(clipboard);

    store.undo();
    expect(store.getClipboard()).toEqual(clipboard);
    store.redo();
    expect(store.getClipboard()).toEqual(clipboard);
  });
});

describe("EditorStore のカスタムガイド・封筒プリセット", () => {
  it("初期値は空配列と null", () => {
    const state = new EditorStore(makeDocument()).getState();
    expect(state.customGuides).toEqual([]);
    expect(state.envelopePresetId).toBeNull();
  });

  it("setCustomGuides / setEnvelopePreset は購読者に通知し、履歴にも dirty にも影響しない", () => {
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

  it("undo / redo・commit・replaceDocument を経ても維持される", () => {
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

function registeredFont(name: string): RegisteredFont {
  return {
    name,
    displayName: name,
    data: new Uint8Array([1, 2, 3]),
    ascentPerEm: 1,
  };
}

describe("EditorStore のフォントレジストリ", () => {
  it("初期状態は空", () => {
    expect(new EditorStore(makeDocument()).getState().fontRegistry.size).toBe(
      0,
    );
  });

  it("registerFont は購読者に通知し、レジストリに追加する", () => {
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

  it("履歴に積まれず dirty も変わらない", () => {
    const store = new EditorStore(makeDocument());
    store.registerFont(registeredFont("IPAexGothic"));
    expect(store.canUndo()).toBe(false);
    expect(store.getState().dirty).toBe(false);
  });

  it("同名は上書きする", () => {
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

  it("undo / redo・commit・replaceDocument を経てもレジストリは維持される", () => {
    const store = new EditorStore(makeDocument());
    store.registerFont(registeredFont("IPAexGothic"));

    store.commit(makeDocument([textElement("t1", 10)]));
    store.undo();
    expect(store.getState().fontRegistry.get("IPAexGothic")).toBeDefined();

    store.replaceDocument(makeDocument());
    expect(store.getState().fontRegistry.get("IPAexGothic")).toBeDefined();
  });
});

describe("EditorStore のグループ", () => {
  it("初期状態は空", () => {
    expect(new EditorStore(makeDocument()).getState().groups).toEqual([]);
  });

  it("setGroups は購読者に通知し、履歴・dirty に影響しない", () => {
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

  it("replaceDocument は新文書に groups が無ければグループを空にする", () => {
    const store = new EditorStore(makeDocument());
    store.setGroups([{ id: "group1", memberIds: ["a", "b"] }]);

    store.replaceDocument(makeDocument([textElement("t1", 10)]));
    expect(store.getState().groups).toEqual([]);
  });

  it("replaceDocument は document.groups からグループを復元する", () => {
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

  it("replaceDocument は生存メンバー2未満のグループを復元しない", () => {
    const store = new EditorStore(makeDocument());
    const document: IrDocument = {
      ...makeDocument([textElement("t1", 10)]),
      groups: [{ id: "group1", memberIds: ["t1", "ghost"] }],
    };

    store.replaceDocument(document);
    expect(store.getState().groups).toEqual([]);
  });

  it("undo / redo してもグループは変わらない", () => {
    const store = new EditorStore(makeDocument());
    store.commit(makeDocument([textElement("t1", 10)]), ["t1"]);
    store.setGroups([{ id: "group1", memberIds: ["t1"] }]);

    store.undo();
    expect(store.getState().groups).toEqual([
      { id: "group1", memberIds: ["t1"] },
    ]);
  });
});
