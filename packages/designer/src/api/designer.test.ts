import type { CompatTargetId, IrDocument } from "@denreport/core";
import { parseIr } from "@denreport/core";
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";
import type { Locale } from "../i18n/locale";
import { ja } from "../i18n/messages/ja";
import * as publicExports from "../index";
import { addScenario, parseSampleDataStorage } from "../state/sample-scenarios";
import type { EditorStore } from "../state/store";
import type {
  DesignerLocale,
  DesignerOptions,
  DesignerTheme,
  LoadIrResult,
} from "./designer";
import { Designer } from "./designer";

const VALID_IR = JSON.stringify({
  version: "1.0",
  page: { width: 210, height: 297 },
  font: { regular: "NotoSansJP" },
  elements: [
    {
      type: "text",
      id: "title",
      x: 10,
      y: 10,
      w: 100,
      h: 8,
      text: "請求書",
    },
  ],
});

const ROUND_TRIP_IR = JSON.stringify({
  version: "1.0",
  page: { width: 210, height: 297 },
  font: { regular: "NotoSansJP" },
  elements: [
    {
      type: "text",
      id: "title",
      x: 10,
      y: 10,
      w: 100,
      h: 8,
      text: "請求書",
      fontSize: 14,
      align: "center",
    },
    {
      type: "text",
      id: "customer",
      x: 10,
      y: 24,
      w: 80,
      h: 6,
      text: "{customerName}",
    },
    {
      type: "line",
      id: "rule1",
      x: 10,
      y: 34,
      orientation: "horizontal",
      length: 190,
    },
    { type: "rect", id: "frame", x: 10, y: 40, w: 190, h: 30 },
    {
      type: "image",
      id: "logo",
      x: 170,
      y: 10,
      w: 30,
      h: 12,
      src: "data:image/png;base64,iVBORw0KGgo=",
    },
    { type: "pageNumber", id: "pageno", x: 90, y: 285, w: 30, h: 6 },
    {
      type: "barcode",
      id: "qr",
      x: 10,
      y: 250,
      w: 20,
      h: 20,
      symbology: "qrcode",
      value: "{code}",
    },
    {
      type: "table",
      id: "items",
      x: 10,
      y: 80,
      bind: "items",
      columns: [
        { key: "name", label: "品名", width: 100 },
        { key: "qty", label: "数量", width: 30, align: "right" },
        { key: "price", label: "金額", width: 40, align: "right" },
      ],
      rowHeight: 8,
      headerHeight: 8,
      minRows: 5,
      maxY: 240,
    },
    {
      type: "flex",
      id: "totals",
      x: 120,
      y: 250,
      direction: "column",
      gap: 2,
      children: [
        { type: "text", id: "totalLabel", w: 40, h: 6, text: "合計" },
        {
          type: "flex",
          id: "totalRow",
          direction: "row",
          gap: 4,
          children: [
            { type: "text", id: "taxLabel", w: 20, h: 6, text: "税" },
            { type: "text", id: "taxValue", w: 20, h: 6, text: "{tax}" },
          ],
        },
      ],
    },
  ],
});

function storeOf(designer: Designer): EditorStore {
  return (designer as unknown as { readonly store: EditorStore }).store;
}

// jsdom doesn't implement matchMedia, so provide a minimal stub that always mismatches (= resolves to light)
beforeAll(() => {
  vi.stubGlobal(
    "matchMedia",
    (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
  // jsdom's URL lacks createObjectURL / revokeObjectURL
  Object.assign(URL, {
    createObjectURL: () => "blob:denreport-test",
    revokeObjectURL: () => {},
  });
});

let containers: HTMLElement[] = [];
let designers: Designer[] = [];

// jsdom's default language is en-US, so default to ja here so that tests with locale omitted
// don't fall back to an English display
function mount(options?: DesignerOptions): {
  container: HTMLElement;
  designer: Designer;
} {
  const container = document.createElement("div");
  document.body.append(container);
  const designer = new Designer(container, { locale: "ja", ...options });
  containers.push(container);
  designers.push(designer);
  return { container, designer };
}

afterEach(() => {
  for (const designer of designers) {
    designer.destroy();
  }
  for (const container of containers) {
    container.remove();
  }
  designers = [];
  containers = [];
  vi.restoreAllMocks();
});

async function toolbarButton(
  container: HTMLElement,
  label: string,
): Promise<HTMLButtonElement> {
  return await vi.waitFor(() => {
    const button = [
      ...container.querySelectorAll<HTMLButtonElement>(".dr-toolbar button"),
    ].find((b) => (b.getAttribute("aria-label") ?? b.textContent) === label);
    if (button === undefined) {
      throw new Error(`ツールバーにボタンがない: ${label}`);
    }
    return button;
  });
}

function click(el: Element): void {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function parseSample(json: string): ReturnType<typeof parseSampleDataStorage> {
  return parseSampleDataStorage(json, ja.scenarioNames);
}

function makeDirty(designer: Designer): void {
  const store = storeOf(designer);
  store.commit({ ...store.getState().document, elements: [] });
  if (!store.getState().dirty) {
    throw new Error("dirty にならなかった");
  }
}

function spyAnchorClicks(): HTMLAnchorElement[] {
  const clicked: HTMLAnchorElement[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push(this);
  });
  return clicked;
}

describe("Designer mount and destroy", () => {
  it("mounting renders .dr-designer inside the container", async () => {
    const { container } = mount();
    const rootEl = container.querySelector(".dr-designer");
    expect(rootEl).not.toBeNull();
    await vi.waitFor(() => {
      expect(container.querySelector(".dr-statusbar")).not.toBeNull();
    });
  });

  it("existing container content is removed when claimed", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>previous</p>";
    document.body.append(container);
    containers.push(container);
    designers.push(new Designer(container));
    expect(container.querySelector("p")).toBeNull();
  });

  it("destroy empties the container and is idempotent", () => {
    const { container, designer } = mount();
    designer.destroy();
    expect(container.childNodes).toHaveLength(0);
    expect(() => designer.destroy()).not.toThrow();
  });

  it("calling other methods after destroy throws", () => {
    const { designer } = mount();
    designer.destroy();
    expect(() => designer.loadIr(VALID_IR)).toThrow();
    expect(() => designer.saveIr()).toThrow();
    expect(() => designer.onChange(() => {})).toThrow();
    expect(() => designer.onSaveRequest(() => {})).toThrow();
    expect(() => designer.setTheme("dark")).toThrow();
    expect(() => designer.getSampleData()).toThrow();
    expect(() => designer.setSampleData("{}")).toThrow();
    expect(() => designer.onSampleDataChange(() => {})).toThrow();
    expect(() => designer.getExportTarget()).toThrow();
    expect(() => designer.onExportTargetChange(() => {})).toThrow();
    expect(() => designer.setLocale("en")).toThrow();
    expect(() => designer.getLocale()).toThrow();
    expect(() => designer.onLocaleChange(() => {})).toThrow();
  });

  it("an invalid initialIr throws in the constructor", () => {
    const container = document.createElement("div");
    containers.push(container);
    expect(() => new Designer(container, { initialIr: "{" })).toThrow();
  });
});

describe("IR input/output", () => {
  it("defaults to a blank document (portrait A4, NotoSansJP, empty elements) when omitted", () => {
    const { designer } = mount();
    const result = parseIr(designer.saveIr());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.page).toEqual({ width: 210, height: 297 });
      expect(result.document.font).toEqual({
        regular: "NotoSansJP",
        bold: "NotoSansJPBold",
      });
      expect(result.document.elements).toEqual([]);
    }
  });

  it("a successful loadIr replaces the document and returns ok", () => {
    const { designer } = mount();
    const result = designer.loadIr(VALID_IR);
    expect(result).toEqual({ ok: true });
    const saved = parseIr(designer.saveIr());
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.document.elements).toHaveLength(1);
    }
  });

  it("loadIr with invalid IR returns ok: false and errors, leaving the document unchanged", () => {
    const { designer } = mount({ initialIr: VALID_IR });
    const before = designer.saveIr();
    const result = designer.loadIr('{"version":"1.0"}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
      const first = result.errors.at(0);
      expect(first?.rule).toBeDefined();
      expect(first?.path).toBeDefined();
      expect(first?.message).toBeDefined();
    }
    expect(designer.saveIr()).toBe(before);
  });

  it("saveIr's output parses ok with parseIr (round-trip consistency)", () => {
    const { designer } = mount({ initialIr: VALID_IR });
    const result = parseIr(designer.saveIr());
    expect(result.ok).toBe(true);
  });

  it("saveIr returns normalized JSON (optional attributes made explicit with defaults)", () => {
    const { designer } = mount({ initialIr: VALID_IR });
    const parsed = JSON.parse(designer.saveIr()) as IrDocument;
    const element = parsed.elements.at(0);
    expect(element).toMatchObject({
      pages: "first",
      fontSize: 10,
      align: "left",
      lineHeight: 1.25,
    });
  });

  it("saveIr then loadIr then saveIr restores a document with every element type to an equal value", () => {
    const { designer } = mount({ initialIr: ROUND_TRIP_IR });
    const saved = designer.saveIr();
    const types = (JSON.parse(saved) as IrDocument).elements.map(
      (el) => el.type,
    );
    expect(new Set(types)).toEqual(
      new Set([
        "text",
        "line",
        "rect",
        "image",
        "pageNumber",
        "barcode",
        "table",
        "flex",
      ]),
    );

    const { designer: reloaded } = mount();
    expect(reloaded.loadIr(saved)).toEqual({ ok: true });
    expect(reloaded.saveIr()).toBe(saved);
  });

  it("saveIr serializes surviving groups under the groups key", () => {
    const { designer } = mount({ initialIr: ROUND_TRIP_IR });
    storeOf(designer).setGroups([
      { id: "group1", memberIds: ["title", "customer"] },
    ]);
    const parsed = JSON.parse(designer.saveIr()) as IrDocument;
    expect(parsed.groups).toEqual([
      { id: "group1", memberIds: ["title", "customer"] },
    ]);
  });

  it("a group with fewer than 2 surviving members omits the groups key entirely", () => {
    const { designer } = mount({ initialIr: ROUND_TRIP_IR });
    storeOf(designer).setGroups([{ id: "group1", memberIds: ["title"] }]);
    const parsed = JSON.parse(designer.saveIr()) as IrDocument;
    expect(parsed).not.toHaveProperty("groups");
  });

  it("saveIr then loadIr then saveIr restores groups to an equal value", () => {
    const { designer } = mount({ initialIr: ROUND_TRIP_IR });
    storeOf(designer).setGroups([
      { id: "group1", memberIds: ["title", "customer"] },
    ]);
    const saved = designer.saveIr();

    const { designer: reloaded } = mount();
    expect(reloaded.loadIr(saved)).toEqual({ ok: true });
    expect(storeOf(reloaded).getState().groups).toEqual([
      { id: "group1", memberIds: ["title", "customer"] },
    ]);
    expect(reloaded.saveIr()).toBe(saved);
  });

  it("loadIr resets old groups when the loaded IR has none", () => {
    const { designer } = mount({ initialIr: VALID_IR });
    const store = storeOf(designer);
    store.setGroups([{ id: "group1", memberIds: ["title"] }]);
    expect(store.getState().groups).not.toEqual([]);

    expect(designer.loadIr(VALID_IR)).toEqual({ ok: true });
    expect(store.getState().groups).toEqual([]);
  });
});

describe("onChange", () => {
  it("fires on document commit, but not on setSelection / setView / markSaved", () => {
    const { designer } = mount({ initialIr: VALID_IR });
    const store = storeOf(designer);
    let fired = 0;
    designer.onChange(() => {
      fired += 1;
    });

    store.setSelection(["title"]);
    store.setView({ zoom: 1.5 });
    store.markSaved();
    expect(fired).toBe(0);

    const parsed = parseIr(VALID_IR);
    if (!parsed.ok) {
      throw new Error("フィクスチャが不正");
    }
    store.commit({ ...parsed.document, elements: [] });
    expect(fired).toBe(1);
  });

  it("also fires on undo / redo / loadIr", () => {
    const { designer } = mount({ initialIr: VALID_IR });
    const store = storeOf(designer);
    const parsed = parseIr(VALID_IR);
    if (!parsed.ok) {
      throw new Error("フィクスチャが不正");
    }
    store.commit({ ...parsed.document, elements: [] });

    let fired = 0;
    designer.onChange(() => {
      fired += 1;
    });
    store.undo();
    expect(fired).toBe(1);
    store.redo();
    expect(fired).toBe(2);
    designer.loadIr(VALID_IR);
    expect(fired).toBe(3);
  });

  it("the unsubscribe function detaches the listener", () => {
    const { designer } = mount();
    let fired = 0;
    const unsubscribe = designer.onChange(() => {
      fired += 1;
    });
    unsubscribe();
    designer.loadIr(VALID_IR);
    expect(fired).toBe(0);
  });

  it("grouping/ungrouping (setGroups) fires even without changing the document", () => {
    const { designer } = mount({ initialIr: ROUND_TRIP_IR });
    const store = storeOf(designer);
    let fired = 0;
    designer.onChange(() => {
      fired += 1;
    });

    store.setGroups([{ id: "group1", memberIds: ["title", "customer"] }]);
    expect(fired).toBe(1);

    store.setGroups([]);
    expect(fired).toBe(2);
  });
});

describe("Sample data API", () => {
  it("getSampleData returns the envelope format (the full scenario set)", () => {
    const { designer: blank } = mount();
    const blankSet = parseSample(blank.getSampleData());
    expect(blankSet.items).toHaveLength(1);
    expect(blankSet.items[0]?.json).toBe("");

    const raw = '{ "customerName":  "甲" }';
    const { designer } = mount({ initialSampleData: raw });
    const migrated = parseSample(designer.getSampleData());
    expect(migrated.items).toHaveLength(1);
    expect(migrated.items[0]?.json).toBe(raw);
  });

  it("setSampleData / getSampleData round-trip in envelope format and accept invalid JSON too", () => {
    const { designer } = mount();
    designer.setSampleData("{oops");
    expect(parseSample(designer.getSampleData()).items[0]?.json).toBe("{oops");

    const { designer: broken } = mount({ initialSampleData: "{oops" });
    expect(parseSample(broken.getSampleData()).items[0]?.json).toBe("{oops");
  });

  it("passing getSampleData's return value to initialSampleData round-trips", () => {
    const { designer } = mount();
    designer.setSampleData('{"a": 1}');
    const envelope = designer.getSampleData();

    const { designer: restored } = mount({ initialSampleData: envelope });
    expect(restored.getSampleData()).toBe(envelope);
  });

  it("setSampleData fires onSampleDataChange but not onChange", () => {
    const { designer } = mount({ initialIr: VALID_IR });
    let sampleFired = 0;
    let changeFired = 0;
    designer.onSampleDataChange(() => {
      sampleFired += 1;
    });
    designer.onChange(() => {
      changeFired += 1;
    });

    designer.setSampleData('{"a": 1}');
    expect(sampleFired).toBe(1);
    expect(changeFired).toBe(0);
  });

  it("scenario operations (via store.setSampleScenarios) also fire onSampleDataChange", () => {
    const { designer } = mount();
    let sampleFired = 0;
    designer.onSampleDataChange(() => {
      sampleFired += 1;
    });

    const store = storeOf(designer);
    store.setSampleScenarios(
      addScenario(store.getState().sampleScenarios, ja.scenarioNames),
    );
    expect(sampleFired).toBe(1);
    expect(parseSample(designer.getSampleData()).items).toHaveLength(2);
  });

  it("document changes (commit / loadIr) don't fire onSampleDataChange, and the sample is preserved", () => {
    const { designer } = mount({
      initialIr: VALID_IR,
      initialSampleData: '{"a": 1}',
    });
    let sampleFired = 0;
    designer.onSampleDataChange(() => {
      sampleFired += 1;
    });

    makeDirty(designer);
    designer.loadIr(VALID_IR);
    expect(sampleFired).toBe(0);
    expect(parseSample(designer.getSampleData()).items[0]?.json).toBe(
      '{"a": 1}',
    );
  });

  it("the unsubscribe function detaches the listener", () => {
    const { designer } = mount();
    let fired = 0;
    const unsubscribe = designer.onSampleDataChange(() => {
      fired += 1;
    });
    unsubscribe();
    designer.setSampleData("{}");
    expect(fired).toBe(0);
  });
});

describe("Export target API", () => {
  it("defaults to pdfme when omitted", () => {
    const { designer } = mount();
    expect(designer.getExportTarget()).toBe("pdfme");
  });

  it("passing initialExportTarget sets the initial value", () => {
    const { designer } = mount({ initialExportTarget: "reportlab" });
    expect(designer.getExportTarget()).toBe("reportlab");
  });

  it("a selection change via the store (equivalent to toolbar / export dialog) fires onExportTargetChange but not onChange", () => {
    const { designer } = mount({ initialIr: VALID_IR });
    let targetFired = 0;
    let changeFired = 0;
    designer.onExportTargetChange(() => {
      targetFired += 1;
    });
    designer.onChange(() => {
      changeFired += 1;
    });

    storeOf(designer).setSelectedExportTarget("reportlab");
    expect(targetFired).toBe(1);
    expect(changeFired).toBe(0);
    expect(designer.getExportTarget()).toBe("reportlab");
  });

  it("the unsubscribe function detaches the listener", () => {
    const { designer } = mount();
    let fired = 0;
    const unsubscribe = designer.onExportTargetChange(() => {
      fired += 1;
    });
    unsubscribe();
    storeOf(designer).setSelectedExportTarget("reportlab");
    expect(fired).toBe(0);
  });
});

describe("Theme", () => {
  it("setTheme switches the data-theme attribute", () => {
    const { container, designer } = mount();
    const rootEl = container.querySelector(".dr-designer");
    designer.setTheme("dark");
    expect(rootEl?.getAttribute("data-theme")).toBe("dark");
    designer.setTheme("light");
    expect(rootEl?.getAttribute("data-theme")).toBe("light");
  });

  it('"auto" resolves to the OS setting (light under jsdom)', () => {
    const { container, designer } = mount();
    const rootEl = container.querySelector(".dr-designer");
    expect(rootEl?.getAttribute("data-theme")).toBe("light");
    designer.setTheme("dark");
    designer.setTheme("auto");
    expect(rootEl?.getAttribute("data-theme")).toBe("light");
  });
});

describe("Save button and onSaveRequest", () => {
  it("without a listener, clicking save triggers a download and clears dirty", async () => {
    const { container, designer } = mount({ initialIr: VALID_IR });
    makeDirty(designer);
    const clicked = spyAnchorClicks();

    const save = await toolbarButton(container, "保存");
    click(save);

    expect(clicked).toHaveLength(1);
    expect(clicked.at(0)?.getAttribute("download")).toBe(
      "report-template.json",
    );
    expect(storeOf(designer).getState().dirty).toBe(false);
  });

  it("while a listener is registered, only the notification fires, with no download and no markSaved", async () => {
    const { container, designer } = mount({ initialIr: VALID_IR });
    makeDirty(designer);
    const clicked = spyAnchorClicks();
    const listener = vi.fn();
    const unsubscribe = designer.onSaveRequest(listener);

    const save = await toolbarButton(container, "保存");
    click(save);

    expect(listener).toHaveBeenCalledOnce();
    expect(clicked).toHaveLength(0);
    expect(storeOf(designer).getState().dirty).toBe(true);

    unsubscribe();
    click(save);

    expect(listener).toHaveBeenCalledOnce();
    expect(clicked).toHaveLength(1);
    expect(storeOf(designer).getState().dirty).toBe(false);
  });

  it("the save button is enabled even for a clean document", async () => {
    const { container } = mount({ initialIr: VALID_IR });
    const save = await toolbarButton(container, "保存");
    expect(save.disabled).toBe(false);
  });
});

describe("Theme toggle", () => {
  it("the theme item in the more-actions menu flips data-theme, moving from auto to an explicit theme", async () => {
    const { container } = mount();
    const rootEl = container.querySelector(".dr-designer");
    expect(rootEl?.getAttribute("data-theme")).toBe("light");

    click(await toolbarButton(container, "その他の操作"));
    click(await toolbarButton(container, "テーマを切り替え（現在: ライト）"));
    // If it stayed on auto it would resolve to light (the matchMedia stub always mismatches),
    // so becoming dark is itself evidence that it moved to an explicit theme
    await vi.waitFor(() => {
      expect(rootEl?.getAttribute("data-theme")).toBe("dark");
    });

    click(await toolbarButton(container, "その他の操作"));
    click(await toolbarButton(container, "テーマを切り替え（現在: ダーク）"));
    await vi.waitFor(() => {
      expect(rootEl?.getAttribute("data-theme")).toBe("light");
    });
  });
});

describe("Language switching", () => {
  it('locale defaults to "auto" (resolves to en because jsdom navigator.languages is en-US)', () => {
    const container = document.createElement("div");
    containers.push(container);
    const designer = new Designer(container);
    designers.push(designer);
    expect(designer.getLocale()).toBe("en");
  });

  it("setLocale switches the display language and rootEl.lang, and fires onLocaleChange", async () => {
    const { container, designer } = mount();
    const rootEl = container.querySelector(".dr-designer");
    expect(rootEl?.getAttribute("lang")).toBe("ja");
    expect(designer.getLocale()).toBe("ja");
    await toolbarButton(container, "保存");

    let fired = 0;
    designer.onLocaleChange(() => {
      fired += 1;
    });

    designer.setLocale("en");
    expect(designer.getLocale()).toBe("en");
    expect(rootEl?.getAttribute("lang")).toBe("en");
    expect(fired).toBe(1);
    await toolbarButton(container, "Save");

    designer.setLocale("ja");
    expect(fired).toBe(2);
    await toolbarButton(container, "保存");
  });

  it("onLocaleChange doesn't fire for a setLocale whose resolved value is unchanged", () => {
    const { designer } = mount();
    let fired = 0;
    designer.onLocaleChange(() => {
      fired += 1;
    });
    designer.setLocale("ja");
    expect(fired).toBe(0);
  });

  it("the unsubscribe function detaches the listener", () => {
    const { designer } = mount();
    let fired = 0;
    const unsubscribe = designer.onLocaleChange(() => {
      fired += 1;
    });
    unsubscribe();
    designer.setLocale("en");
    expect(fired).toBe(0);
  });
});

describe("Locale propagation to core / targets", () => {
  async function openedDrawer(container: HTMLElement): Promise<HTMLElement> {
    const bar = await vi.waitFor(() => {
      const el = container.querySelector<HTMLButtonElement>(".dr-drawer-bar");
      if (el === null) throw new Error("検証ペインがない");
      return el;
    });
    click(bar);
    return await vi.waitFor(() => {
      const body = container.querySelector<HTMLElement>(".dr-drawer-body");
      if (body === null) throw new Error("検証ペインが開かない");
      return body;
    });
  }

  it("setLocale switches the validation error text", async () => {
    const { container, designer } = mount({ initialIr: VALID_IR });
    const store = storeOf(designer);
    const document_ = store.getState().document;
    store.commit({
      ...document_,
      elements: document_.elements.map((el) => ({ ...el, x: -1 })),
    });
    const body = await openedDrawer(container);
    await vi.waitFor(() => {
      expect(body.textContent).toContain("x が 0 未満です");
    });

    designer.setLocale("en");
    await vi.waitFor(() => {
      expect(body.textContent).toContain("x is below 0");
      expect(body.textContent).not.toContain("x が 0 未満です");
    });
  });

  it("setLocale switches the compatibility warning text", async () => {
    const { container, designer } = mount({ initialIr: VALID_IR });
    const body = await openedDrawer(container);
    await vi.waitFor(() => {
      expect(body.textContent).toContain("文字の折り返しや配置は");
    });

    designer.setLocale("en");
    await vi.waitFor(() => {
      expect(body.textContent).toContain("Text wrapping and alignment");
      expect(body.textContent).not.toContain("文字の折り返しや配置は");
    });
  });

  it("the export dialog's compatibility warning switches with setLocale", async () => {
    const { container, designer } = mount({ initialIr: VALID_IR });
    click(await toolbarButton(container, "書き出し"));
    const dialog = await vi.waitFor(() => {
      const el = container.querySelector<HTMLElement>(".dr-warn-card");
      if (el === null) throw new Error("互換警告カードがない");
      return el;
    });
    expect(dialog.textContent).toContain("文字の折り返しや配置は");

    designer.setLocale("en");
    await vi.waitFor(() => {
      const el = container.querySelector<HTMLElement>(".dr-warn-card");
      expect(el?.textContent).toContain("Text wrapping and alignment");
    });
  });

  it("loadIr's failure message follows the resolved locale", () => {
    const { designer } = mount();
    const jaResult = designer.loadIr("{");
    expect(jaResult.ok).toBe(false);
    if (jaResult.ok) throw new Error("失敗を期待");

    designer.setLocale("en");
    const enResult = designer.loadIr("{");
    expect(enResult.ok).toBe(false);
    if (enResult.ok) throw new Error("失敗を期待");
    expect(enResult.errors[0]?.message).not.toBe(jaResult.errors[0]?.message);
  });
});

describe("Public surface types (no React leakage)", () => {
  it("the only value export is the Designer class", () => {
    expectTypeOf<keyof typeof publicExports>().toEqualTypeOf<"Designer">();
    expect(Object.keys(publicExports)).toEqual(["Designer"]);
  });

  it("the public signature is closed over DOM standard types, primitives, and core types only", () => {
    // A deep equality comparison via expectTypeOf that expands every attribute of HTMLElement
    // isn't practical, so the constructor is verified via assignability (a compile-time check) instead
    const construct: new (
      container: HTMLElement,
      options?: DesignerOptions,
    ) => Designer = Designer;
    expect(construct).toBe(Designer);
    expectTypeOf<Designer["loadIr"]>().toEqualTypeOf<
      (json: string) => LoadIrResult
    >();
    expectTypeOf<Designer["saveIr"]>().toEqualTypeOf<() => string>();
    expectTypeOf<Designer["onChange"]>().toEqualTypeOf<
      (listener: () => void) => () => void
    >();
    expectTypeOf<Designer["onSaveRequest"]>().toEqualTypeOf<
      (listener: () => void) => () => void
    >();
    expectTypeOf<Designer["getSampleData"]>().toEqualTypeOf<() => string>();
    expectTypeOf<Designer["setSampleData"]>().toEqualTypeOf<
      (json: string) => void
    >();
    expectTypeOf<Designer["onSampleDataChange"]>().toEqualTypeOf<
      (listener: () => void) => () => void
    >();
    expectTypeOf<Designer["getExportTarget"]>().toEqualTypeOf<
      () => CompatTargetId
    >();
    expectTypeOf<Designer["onExportTargetChange"]>().toEqualTypeOf<
      (listener: () => void) => () => void
    >();
    expectTypeOf<Designer["setTheme"]>().toEqualTypeOf<
      (theme: DesignerTheme) => void
    >();
    expectTypeOf<Designer["setLocale"]>().toEqualTypeOf<
      (locale: DesignerLocale) => void
    >();
    expectTypeOf<Designer["getLocale"]>().toEqualTypeOf<() => Locale>();
    expectTypeOf<Designer["onLocaleChange"]>().toEqualTypeOf<
      (listener: () => void) => () => void
    >();
    expectTypeOf<Designer["destroy"]>().toEqualTypeOf<() => void>();
    expectTypeOf<DesignerTheme>().toEqualTypeOf<"light" | "dark" | "auto">();
    expectTypeOf<DesignerLocale>().toEqualTypeOf<"ja" | "en" | "auto">();
    expectTypeOf<DesignerOptions>().toEqualTypeOf<{
      readonly initialIr?: string;
      readonly initialSampleData?: string;
      readonly initialExportTarget?: CompatTargetId;
      readonly theme?: DesignerTheme;
      readonly locale?: DesignerLocale;
    }>();
  });
});
