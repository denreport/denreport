import type { IrDocument } from "@denreport/core";
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
import * as publicExports from "../index";
import { addScenario, parseSampleDataStorage } from "../state/sample-scenarios";
import type { EditorStore } from "../state/store";
import type { DesignerOptions, DesignerTheme, LoadIrResult } from "./designer";
import { Designer } from "./designer";

const VALID_IR = JSON.stringify({
  version: "1.0",
  page: { width: 210, height: 297 },
  font: { name: "NotoSansJP" },
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
  font: { name: "NotoSansJP" },
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

// jsdom は matchMedia 未実装のため、常に不一致（= ライト解決）の最小スタブを与える
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
  // jsdom の URL には createObjectURL / revokeObjectURL が無い
  Object.assign(URL, {
    createObjectURL: () => "blob:denreport-test",
    revokeObjectURL: () => {},
  });
});

let containers: HTMLElement[] = [];
let designers: Designer[] = [];

function mount(options?: DesignerOptions): {
  container: HTMLElement;
  designer: Designer;
} {
  const container = document.createElement("div");
  document.body.append(container);
  const designer =
    options === undefined
      ? new Designer(container)
      : new Designer(container, options);
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
      ...container.querySelectorAll<HTMLButtonElement>(".apx-toolbar button"),
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

describe("Designer のマウントと破棄", () => {
  it("マウントで container 内に .apx-designer が描画される", async () => {
    const { container } = mount();
    const rootEl = container.querySelector(".apx-designer");
    expect(rootEl).not.toBeNull();
    await vi.waitFor(() => {
      expect(container.querySelector(".apx-statusbar")).not.toBeNull();
    });
  });

  it("既存の container 内容は占有時に取り除かれる", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>previous</p>";
    document.body.append(container);
    containers.push(container);
    designers.push(new Designer(container));
    expect(container.querySelector("p")).toBeNull();
  });

  it("destroy で container が空に戻り、冪等である", () => {
    const { container, designer } = mount();
    designer.destroy();
    expect(container.childNodes).toHaveLength(0);
    expect(() => designer.destroy()).not.toThrow();
  });

  it("destroy 後の他メソッド呼び出しは throw する", () => {
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
  });

  it("不正な initialIr はコンストラクタで throw する", () => {
    const container = document.createElement("div");
    containers.push(container);
    expect(() => new Designer(container, { initialIr: "{" })).toThrow();
  });
});

describe("IR の入出力", () => {
  it("省略時は白紙文書（A4 縦・NotoSansJP・elements 空）になる", () => {
    const { designer } = mount();
    const result = parseIr(designer.saveIr());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.page).toEqual({ width: 210, height: 297 });
      expect(result.document.font.name).toBe("NotoSansJP");
      expect(result.document.elements).toEqual([]);
    }
  });

  it("loadIr が成功すると文書が置き換わり ok を返す", () => {
    const { designer } = mount();
    const result = designer.loadIr(VALID_IR);
    expect(result).toEqual({ ok: true });
    const saved = parseIr(designer.saveIr());
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.document.elements).toHaveLength(1);
    }
  });

  it("不正 IR の loadIr は ok: false と errors を返し、文書を変えない", () => {
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

  it("saveIr の出力は parseIr で ok になる（往復の整合）", () => {
    const { designer } = mount({ initialIr: VALID_IR });
    const result = parseIr(designer.saveIr());
    expect(result.ok).toBe(true);
  });

  it("saveIr は正規化済み（任意属性のデフォルト明示済み）の JSON を返す", () => {
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

  it("saveIr → loadIr → saveIr で全要素種を含む文書が同値に復元される", () => {
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

  it("saveIr は生存グループを groups キーへ直列化する", () => {
    const { designer } = mount({ initialIr: ROUND_TRIP_IR });
    storeOf(designer).setGroups([
      { id: "group1", memberIds: ["title", "customer"] },
    ]);
    const parsed = JSON.parse(designer.saveIr()) as IrDocument;
    expect(parsed.groups).toEqual([
      { id: "group1", memberIds: ["title", "customer"] },
    ]);
  });

  it("生存メンバーが2未満のグループは groups キーごと省かれる", () => {
    const { designer } = mount({ initialIr: ROUND_TRIP_IR });
    storeOf(designer).setGroups([{ id: "group1", memberIds: ["title"] }]);
    const parsed = JSON.parse(designer.saveIr()) as IrDocument;
    expect(parsed).not.toHaveProperty("groups");
  });

  it("saveIr → loadIr → saveIr でグループが同値に復元される", () => {
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

  it("loadIr は読み込んだ IR に groups が無ければ旧グループをリセットする", () => {
    const { designer } = mount({ initialIr: VALID_IR });
    const store = storeOf(designer);
    store.setGroups([{ id: "group1", memberIds: ["title"] }]);
    expect(store.getState().groups).not.toEqual([]);

    expect(designer.loadIr(VALID_IR)).toEqual({ ok: true });
    expect(store.getState().groups).toEqual([]);
  });
});

describe("onChange", () => {
  it("文書 commit で発火し、setSelection / setView / markSaved では発火しない", () => {
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

  it("undo / redo / loadIr でも発火する", () => {
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

  it("解除関数でリスナーが外れる", () => {
    const { designer } = mount();
    let fired = 0;
    const unsubscribe = designer.onChange(() => {
      fired += 1;
    });
    unsubscribe();
    designer.loadIr(VALID_IR);
    expect(fired).toBe(0);
  });

  it("グループ化・解除（setGroups）は文書を変えなくても発火する", () => {
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

describe("サンプルデータ API", () => {
  it("getSampleData は封筒形式（シナリオ一式）を返す", () => {
    const { designer: blank } = mount();
    const blankSet = parseSampleDataStorage(blank.getSampleData());
    expect(blankSet.items).toHaveLength(1);
    expect(blankSet.items[0]?.json).toBe("");

    const raw = '{ "customerName":  "甲" }';
    const { designer } = mount({ initialSampleData: raw });
    const migrated = parseSampleDataStorage(designer.getSampleData());
    expect(migrated.items).toHaveLength(1);
    expect(migrated.items[0]?.json).toBe(raw);
  });

  it("setSampleData / getSampleData は封筒形式で往復し、不正 JSON も受理する", () => {
    const { designer } = mount();
    designer.setSampleData("{oops");
    expect(
      parseSampleDataStorage(designer.getSampleData()).items[0]?.json,
    ).toBe("{oops");

    const { designer: broken } = mount({ initialSampleData: "{oops" });
    expect(parseSampleDataStorage(broken.getSampleData()).items[0]?.json).toBe(
      "{oops",
    );
  });

  it("getSampleData の返り値を initialSampleData に渡すと往復する", () => {
    const { designer } = mount();
    designer.setSampleData('{"a": 1}');
    const envelope = designer.getSampleData();

    const { designer: restored } = mount({ initialSampleData: envelope });
    expect(restored.getSampleData()).toBe(envelope);
  });

  it("setSampleData で onSampleDataChange が発火し、onChange は発火しない", () => {
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

  it("シナリオ操作（store.setSampleScenarios 経由）でも onSampleDataChange が発火する", () => {
    const { designer } = mount();
    let sampleFired = 0;
    designer.onSampleDataChange(() => {
      sampleFired += 1;
    });

    const store = storeOf(designer);
    store.setSampleScenarios(addScenario(store.getState().sampleScenarios));
    expect(sampleFired).toBe(1);
    expect(parseSampleDataStorage(designer.getSampleData()).items).toHaveLength(
      2,
    );
  });

  it("文書変更（commit / loadIr）では onSampleDataChange が発火せず、サンプルは維持される", () => {
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
    expect(
      parseSampleDataStorage(designer.getSampleData()).items[0]?.json,
    ).toBe('{"a": 1}');
  });

  it("解除関数でリスナーが外れる", () => {
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

describe("テーマ", () => {
  it("setTheme で data-theme 属性が切り替わる", () => {
    const { container, designer } = mount();
    const rootEl = container.querySelector(".apx-designer");
    designer.setTheme("dark");
    expect(rootEl?.getAttribute("data-theme")).toBe("dark");
    designer.setTheme("light");
    expect(rootEl?.getAttribute("data-theme")).toBe("light");
  });

  it('"auto" は OS 設定の解決値になる（jsdom では light）', () => {
    const { container, designer } = mount();
    const rootEl = container.querySelector(".apx-designer");
    expect(rootEl?.getAttribute("data-theme")).toBe("light");
    designer.setTheme("dark");
    designer.setTheme("auto");
    expect(rootEl?.getAttribute("data-theme")).toBe("light");
  });
});

describe("保存ボタンと onSaveRequest", () => {
  it("リスナーなしでは保存クリックでダウンロードが走り dirty が下りる", async () => {
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

  it("リスナー登録中は通知のみで、ダウンロードも markSaved も起きない", async () => {
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

  it("保存ボタンはクリーンな文書でも活性である", async () => {
    const { container } = mount({ initialIr: VALID_IR });
    const save = await toolbarButton(container, "保存");
    expect(save.disabled).toBe(false);
  });
});

describe("テーマトグル", () => {
  it("トグルで data-theme と aria-pressed が裏返り、auto から明示テーマに移る", async () => {
    const { container } = mount();
    const rootEl = container.querySelector(".apx-designer");
    expect(rootEl?.getAttribute("data-theme")).toBe("light");

    const toggle = await toolbarButton(container, "テーマ");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    click(toggle);
    // auto のままなら light に解決される（matchMedia スタブは常に不一致）ため、
    // dark になったこと自体が明示テーマへ移った証拠になる
    expect(rootEl?.getAttribute("data-theme")).toBe("dark");
    await vi.waitFor(() => {
      expect(toggle.getAttribute("aria-pressed")).toBe("true");
      expect(toggle.classList.contains("is-on")).toBe(true);
    });

    click(toggle);
    expect(rootEl?.getAttribute("data-theme")).toBe("light");
    await vi.waitFor(() => {
      expect(toggle.getAttribute("aria-pressed")).toBe("false");
    });
  });
});

describe("公開面の型（React 非漏洩）", () => {
  it("値のエクスポートは Designer クラスのみ", () => {
    expectTypeOf<keyof typeof publicExports>().toEqualTypeOf<"Designer">();
    expect(Object.keys(publicExports)).toEqual(["Designer"]);
  });

  it("公開シグネチャは DOM 標準型・プリミティブ・core の型だけで閉じる", () => {
    // HTMLElement の全属性を展開する expectTypeOf の深い等価比較は現実的でないため、
    // コンストラクタは代入可能性（コンパイル時検査）で担保する
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
    expectTypeOf<Designer["setTheme"]>().toEqualTypeOf<
      (theme: DesignerTheme) => void
    >();
    expectTypeOf<Designer["destroy"]>().toEqualTypeOf<() => void>();
    expectTypeOf<DesignerTheme>().toEqualTypeOf<"light" | "dark" | "auto">();
    expectTypeOf<DesignerOptions>().toEqualTypeOf<{
      readonly initialIr?: string;
      readonly initialSampleData?: string;
      readonly theme?: DesignerTheme;
    }>();
  });
});
