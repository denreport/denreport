import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { commitField, dragFromPalette } from "./helpers/designer-actions";
import { readStoreZip, type ZipEntryData } from "./helpers/zip";

test.setTimeout(240_000);

// An area that doesn't overlap with any element's final position. Only the just-dropped
// element is here, so the visibility-check click isn't stolen by another element.
const SAFE_SPOT = { x: 150, y: 90 } as const;

const LOGO_PATH = fileURLToPath(
  new URL("./fixtures/logo.png", import.meta.url),
);
const LOGO_BUFFER = readFileSync(LOGO_PATH);
const LOGO_BASE64 = LOGO_BUFFER.toString("base64");
const LOGO_DATA_URI = `data:image/png;base64,${LOGO_BASE64}`;

const ZIP_SAVE_PATH = fileURLToPath(
  new URL("../test-results/invoice-full/report-reportlab.zip", import.meta.url),
);

const TEXT_PALETTE = /^テキスト/;
const RECT_PALETTE = /^矩形/;
const TABLE_PALETTE = /^表/;
const IMAGE_PALETTE = /^画像/;
const FLEX_PALETTE = /^フレックス/;
const PAGE_NUMBER_PALETTE = /^ページ番号/;

const FLEX_CHILD_TEXT = {
  text20: "担当: 山田 太郎",
  text21: "内線: 123-456",
} as const;

type Align = "left" | "center" | "right";

interface TableColumnSpec {
  readonly key: string;
  readonly label: string;
  readonly width: number;
  readonly align: Align;
}

const TABLE_COLUMNS: readonly TableColumnSpec[] = [
  { key: "date", label: "日付", width: 22, align: "center" },
  { key: "description", label: "内容", width: 52, align: "left" },
  { key: "reduced", label: "軽減税率", width: 16, align: "center" },
  { key: "qty", label: "数量", width: 12, align: "right" },
  { key: "unit", label: "単位", width: 12, align: "center" },
  { key: "unitPrice", label: "単価（税抜）", width: 22, align: "right" },
  { key: "taxRate", label: "税率", width: 14, align: "center" },
  { key: "amount", label: "金額（税抜）", width: 20, align: "right" },
];

const BIND_KEYS = [
  "issueDate",
  "invoiceNo",
  "customerName",
  "totalWithTax",
  "subtotal",
  "tax",
  "total",
] as const;

const SAMPLE_DATA = {
  issueDate: "2023/10/31",
  invoiceNo: "0000001",
  customerName: "ひな型ジャーナル株式会社 御中",
  totalWithTax: "¥63,800",
  subtotal: "¥58,000",
  tax: "¥5,800",
  total: "¥63,800",
  items: [
    {
      date: "2023/10/11",
      description: "360撮影",
      reduced: "",
      qty: "1",
      unit: "式",
      unitPrice: "¥50,000",
      taxRate: "10%",
      amount: "¥50,000",
    },
    {
      date: "2023/10/1",
      description: "□□□□□",
      reduced: "",
      qty: "4",
      unit: "個",
      unitPrice: "¥2,000",
      taxRate: "10%",
      amount: "¥8,000",
    },
  ],
};

interface ElementSpec {
  readonly id: string;
  readonly palette: RegExp;
  readonly x: number;
  readonly y: number;
  readonly w?: number;
  readonly h?: number;
  readonly yLabel?: string;
  readonly text?: string;
  readonly fontSize?: number;
  readonly align?: Align;
  readonly extra?: (props: Locator) => Promise<void>;
}

async function setTableColumns(props: Locator): Promise<void> {
  for (let i = 0; i < TABLE_COLUMNS.length - 2; i++) {
    await props.getByRole("button", { name: "＋ 列を追加" }).click();
  }
  for (const [i, column] of TABLE_COLUMNS.entries()) {
    const n = i + 1;
    await commitField(props.getByLabel(`列${n} の key`), column.key);
    await commitField(props.getByLabel(`列${n} の見出し`), column.label);
    await commitField(props.getByLabel(`列${n} の幅`), String(column.width));
    await props.getByLabel(`列${n} の整列`).selectOption(column.align);
  }
  await commitField(props.getByLabel("行高"), "7");
  await commitField(props.getByLabel("ヘッダ高"), "8");
  await commitField(props.getByLabel("最低行数"), "12");
  await commitField(props.getByLabel("文字サイズ", { exact: true }), "9");
  await commitField(props.getByLabel("下端（maxY）"), "235");
  await commitField(props.getByLabel("継続上端"), "20");
}

async function uploadLogo(props: Locator): Promise<void> {
  await props.getByLabel("ファイル").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: LOGO_BUFFER,
  });
  await expect(props.locator(".dr-field-static")).toHaveText("image/png");
}

const ELEMENTS: readonly ElementSpec[] = [
  {
    id: "text1",
    palette: TEXT_PALETTE,
    x: 20,
    y: 15,
    w: 170,
    h: 10,
    text: "請求書",
    fontSize: 18,
    align: "center",
  },
  {
    id: "text2",
    palette: TEXT_PALETTE,
    x: 132,
    y: 30,
    w: 22,
    h: 18,
    text: "発行日\n請求番号\n登録番号",
  },
  {
    id: "text3",
    palette: TEXT_PALETTE,
    x: 156,
    y: 30,
    w: 34,
    h: 6,
    text: "{issueDate}",
  },
  {
    id: "text4",
    palette: TEXT_PALETTE,
    x: 156,
    y: 36,
    w: 34,
    h: 6,
    text: "{invoiceNo}",
  },
  {
    id: "text5",
    palette: TEXT_PALETTE,
    x: 156,
    y: 42,
    w: 34,
    h: 6,
    text: "T1234567890123",
  },
  {
    id: "text6",
    palette: TEXT_PALETTE,
    x: 20,
    y: 40,
    w: 90,
    h: 8,
    text: "{customerName}",
    fontSize: 12,
  },
  {
    id: "text7",
    palette: TEXT_PALETTE,
    x: 20,
    y: 50,
    w: 60,
    h: 10,
    text: "〒123-4567\n東京都",
  },
  {
    id: "text8",
    palette: TEXT_PALETTE,
    x: 130,
    y: 56,
    w: 60,
    h: 7,
    text: "アイウエオ株式会社",
    fontSize: 11,
  },
  {
    id: "image1",
    palette: IMAGE_PALETTE,
    x: 116,
    y: 54,
    w: 12,
    h: 12,
    extra: uploadLogo,
  },
  {
    id: "text9",
    palette: TEXT_PALETTE,
    x: 130,
    y: 64,
    w: 70,
    h: 20,
    text: "〒100-0000\n住所: 東京都\n電話: 03-0000-0000\nメール: info@example.com",
  },
  {
    id: "text10",
    palette: TEXT_PALETTE,
    x: 20,
    y: 70,
    w: 90,
    h: 6,
    text: "下記の通り、ご請求申し上げます。",
  },
  {
    id: "rect1",
    palette: RECT_PALETTE,
    x: 20,
    y: 78,
    w: 90,
    h: 16,
  },
  {
    id: "text11",
    palette: TEXT_PALETTE,
    x: 22,
    y: 79,
    w: 86,
    h: 6,
    text: "ご請求金額（税込）",
    align: "center",
  },
  {
    id: "text12",
    palette: TEXT_PALETTE,
    x: 22,
    y: 86,
    w: 84,
    h: 8,
    text: "{totalWithTax}",
    fontSize: 16,
    align: "right",
  },
  {
    id: "rect2",
    palette: RECT_PALETTE,
    x: 20,
    y: 100,
    w: 90,
    h: 24,
  },
  {
    id: "text13",
    palette: TEXT_PALETTE,
    x: 22,
    y: 102,
    w: 86,
    h: 20,
    text: "振込先: 〇〇銀行 △△支店 普通口座 1234567\n口座名義: ヒナガタジャーナル(カ\n振込期日: 2023年12月末\n振込手数料は御社のご負担にてお願いいたします。",
  },
  {
    id: "table1",
    palette: TABLE_PALETTE,
    x: 20,
    y: 135,
    yLabel: "y（1ページ目）",
    extra: setTableColumns,
  },
  {
    id: "text14",
    palette: TEXT_PALETTE,
    x: 20,
    y: 240,
    w: 80,
    h: 16,
    text: "※は軽減税率対象です。\n10%対象 消費税 ¥5,800 / 金額 ¥58,000\n8%対象 消費税 ¥0 / 金額 ¥0",
  },
  {
    id: "text15",
    palette: TEXT_PALETTE,
    x: 130,
    y: 240,
    w: 24,
    h: 18,
    text: "小計\n消費税\n合計",
  },
  {
    id: "text16",
    palette: TEXT_PALETTE,
    x: 156,
    y: 240,
    w: 34,
    h: 6,
    text: "{subtotal}",
    align: "right",
  },
  {
    id: "text17",
    palette: TEXT_PALETTE,
    x: 156,
    y: 246,
    w: 34,
    h: 6,
    text: "{tax}",
    align: "right",
  },
  {
    id: "text18",
    palette: TEXT_PALETTE,
    x: 156,
    y: 252,
    w: 34,
    h: 6,
    text: "{total}",
    align: "right",
  },
  {
    id: "rect3",
    palette: RECT_PALETTE,
    x: 20,
    y: 266,
    w: 170,
    h: 18,
  },
  {
    id: "text19",
    palette: TEXT_PALETTE,
    x: 22,
    y: 268,
    w: 166,
    h: 14,
    text: "備考\n振り込み手数料はご負担くださいますようお願い申し上げます",
  },
  {
    id: "pageNumber1",
    palette: PAGE_NUMBER_PALETTE,
    x: 90,
    y: 288,
    w: 30,
    h: 6,
    align: "center",
  },
];

async function setStaticText(props: Locator, value: string): Promise<void> {
  const field = props.getByLabel("テキスト", { exact: true });
  await field.fill(value);
  await field.blur();
}

const ALIGN_LABEL: Readonly<Record<Align, string>> = {
  left: "左",
  center: "中央",
  right: "右",
};

async function setAlign(props: Locator, align: Align): Promise<void> {
  await props
    .getByRole("group", { name: "整列" })
    .getByRole("button", { name: ALIGN_LABEL[align] })
    .click();
}

async function placeElement(
  page: Page,
  props: Locator,
  spec: ElementSpec,
): Promise<void> {
  await dragFromPalette(page, spec.palette, SAFE_SPOT);
  const el = page.locator(`.dr-el[data-dr-id="${spec.id}"]`);
  await expect(el).toBeVisible();
  await el.click();
  await commitField(props.getByLabel("x", { exact: true }), String(spec.x));
  await commitField(
    props.getByLabel(spec.yLabel ?? "y", { exact: true }),
    String(spec.y),
  );
  if (spec.w !== undefined) {
    await commitField(props.getByLabel("w", { exact: true }), String(spec.w));
  }
  if (spec.h !== undefined) {
    await commitField(props.getByLabel("h", { exact: true }), String(spec.h));
  }
  if (spec.text !== undefined) {
    await setStaticText(props, spec.text);
  }
  if (spec.fontSize !== undefined) {
    await commitField(
      props.getByLabel("文字サイズ", { exact: true }),
      String(spec.fontSize),
    );
  }
  if (spec.align !== undefined) {
    await setAlign(props, spec.align);
  }
  await spec.extra?.(props);
}

function entryOf(entries: readonly ZipEntryData[], name: string): ZipEntryData {
  const entry = entries.find((e) => e.name === name);
  if (entry === undefined) {
    throw new Error(`zip に ${name} がありません`);
  }
  return entry;
}

async function expectTableWarning(exportDialog: Locator): Promise<void> {
  const tableCard = exportDialog
    .locator(".dr-warn-card")
    .filter({ hasText: "表の行がページをまたぐ" });
  await expect(tableCard).toBeVisible();
  await expect(
    tableCard.locator(".dr-chip").filter({ hasText: "table1" }),
  ).toBeVisible();
}

async function expectPageNumberWarning(exportDialog: Locator): Promise<void> {
  const card = exportDialog
    .locator(".dr-warn-card")
    .filter({ hasText: "確定した文字列に変換" });
  await expect(card).toBeVisible();
  await expect(
    card.locator(".dr-chip").filter({ hasText: "pageNumber1" }),
  ).toBeVisible();
}

interface StoredElement {
  readonly id: string;
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly w?: number;
  readonly h?: number;
  readonly text?: string;
  readonly bind?: string;
  readonly src?: string;
  readonly format?: string;
  readonly pages?: string;
  readonly fontSize?: number;
  readonly align?: string;
  readonly direction?: string;
  readonly gap?: number;
  readonly justifyContent?: string;
  readonly alignItems?: string;
  readonly children?: readonly StoredElement[];
  readonly columns?: readonly {
    readonly key: string;
    readonly label: string;
    readonly width: number;
    readonly align: string;
  }[];
  readonly minRows?: number;
  readonly rowHeight?: number;
  readonly headerHeight?: number;
  readonly maxY?: number;
  readonly continuationY?: number;
}

test("適格請求書サンプルをデザイナー UI だけで再現し両ターゲットへ書き出す", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("パレットから要素をドラッグして配置"),
  ).toBeVisible();

  const props = page.getByRole("complementary", { name: "プロパティ" });

  await test.step("要素配置: タイトル・メタ情報・宛先・発行者・ロゴ", async () => {
    for (const spec of ELEMENTS.slice(0, 9)) {
      await placeElement(page, props, spec);
    }
  });

  await test.step("要素配置: 挨拶文・請求金額ボックス・振込先ボックス", async () => {
    for (const spec of ELEMENTS.slice(9, 16)) {
      await placeElement(page, props, spec);
    }
  });

  await test.step("要素配置: 明細表（8列）", async () => {
    const table = ELEMENTS[16];
    if (table === undefined) {
      throw new Error("table1 の定義がありません");
    }
    await placeElement(page, props, table);
  });

  await test.step("要素配置: 税率区分・合計・備考・ページ番号", async () => {
    for (const spec of ELEMENTS.slice(17)) {
      await placeElement(page, props, spec);
    }
  });

  await test.step("要素配置: flex（発行者担当者情報）", async () => {
    // flex1's final position overlaps the safe spot, so from here on we don't drop onto the safe spot.
    await dragFromPalette(page, FLEX_PALETTE, SAFE_SPOT);
    const flexEl = page.locator('.dr-el[data-dr-id="flex1"]');
    await expect(flexEl).toBeVisible();
    // flex1 itself is already selected right after the drop, so commit x/y directly without an intervening click-select
    await commitField(props.getByLabel("x", { exact: true }), "130");
    await commitField(props.getByLabel("y", { exact: true }), "85");

    const text20 = page.locator('.dr-el[data-dr-id="text20"]');
    await expect(text20).toBeVisible();
    await text20.click();
    await setStaticText(props, FLEX_CHILD_TEXT.text20);

    // Drop below text20's main-axis center (y89) to get a trailing insert (insertIndex 1)
    await dragFromPalette(page, TEXT_PALETTE, { x: 140, y: 92 });
    const text21 = page.locator('.dr-el[data-dr-id="text21"]');
    await expect(text21).toBeVisible();
    await setStaticText(props, FLEX_CHILD_TEXT.text21);
  });

  const preview = page.getByRole("dialog", { name: "プレビュー" });

  await test.step("サンプルデータ", async () => {
    await page.getByRole("button", { name: "プレビュー" }).click();
    await expect(preview).toBeVisible();
    const sampleField = preview.getByLabel("サンプルデータ (JSON)");
    await sampleField.fill(JSON.stringify(SAMPLE_DATA, null, 2));
    await sampleField.blur();
  });

  await test.step("プレビュー確認", async () => {
    await expect(preview.getByText("1 ページ", { exact: true })).toBeVisible();
    await expect(preview.locator(".dr-preview-warnings")).toHaveCount(0);
    // The "1 / 1" text at the bottom of the page and the preview's own page-number caption end up
    // as the same string, so scope the match for pageNumber1's expanded output to inside the SVG
    await expect(
      preview.locator(".dr-preview-svg").getByText("1 / 1", { exact: true }),
    ).toBeVisible();
    await expect(preview.getByText(FLEX_CHILD_TEXT.text20)).toBeVisible();
    await preview.getByRole("button", { name: "閉じる" }).click();
    await expect(preview).toBeHidden();
  });

  await test.step("pdfme 書き出し", async () => {
    await page.getByRole("button", { name: "書き出し" }).click();
    const exportDialog = page.getByRole("dialog", { name: "書き出し" });
    await expect(exportDialog).toBeVisible();
    await expect(
      exportDialog.getByRole("button", { name: /^pdfme/ }),
    ).toHaveAttribute("aria-pressed", "true");

    await expectTableWarning(exportDialog);
    await expectPageNumberWarning(exportDialog);
    await expect(
      exportDialog.locator(".dr-warn-card").filter({ hasText: "Pillow" }),
    ).toHaveCount(0);

    const downloadPromise = page.waitForEvent("download");
    await exportDialog.getByRole("button", { name: "書き出す" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("report-pdfme.json");
    const jsonPath = await download.path();
    const rawJson = readFileSync(jsonPath ?? "", "utf8");
    const artifact = JSON.parse(rawJson) as {
      readonly template?: {
        readonly schemas?: readonly {
          readonly name: string;
          readonly type: string;
          readonly position: { readonly x: number; readonly y: number };
        }[][];
      };
      readonly inputs?: readonly Record<string, string>[];
    };
    expect(Object.keys(artifact).sort()).toEqual(["inputs", "template"]);
    expect(artifact.template?.schemas).toHaveLength(1);
    expect(rawJson).toContain("ひな型ジャーナル株式会社 御中");
    expect(rawJson).toContain("360撮影");
    expect(rawJson).toContain("□□□□□");
    expect(rawJson).toContain(LOGO_DATA_URI);

    // Without depending on the schema name generation rule, look up the name from the value and match the schema
    const schemaOfValue = (
      value: string,
    ): {
      readonly type: string;
      readonly position: { x: number; y: number };
    } => {
      const inputs = artifact.inputs?.[0] ?? {};
      const name = Object.entries(inputs).find(([, v]) => v === value)?.[0];
      const schema = artifact.template?.schemas?.[0]?.find(
        (s) => s.name === name,
      );
      if (schema === undefined) {
        throw new Error(`inputs/schemas に値 "${value}" が見つかりません`);
      }
      return schema;
    };
    expect(schemaOfValue(FLEX_CHILD_TEXT.text20).position).toEqual({
      x: 130,
      y: 85,
    });
    expect(schemaOfValue(FLEX_CHILD_TEXT.text21).position).toEqual({
      x: 130,
      y: 95,
    });
    const pageNumberSchema = schemaOfValue("1 / 1");
    expect(pageNumberSchema.position).toEqual({ x: 90, y: 288 });
    expect(pageNumberSchema.type).toBe("text");
  });

  await test.step("ReportLab 書き出し", async () => {
    await page.getByRole("button", { name: "書き出し" }).click();
    const exportDialog = page.getByRole("dialog", { name: "書き出し" });
    await expect(exportDialog).toBeVisible();
    await exportDialog.getByRole("button", { name: /ReportLab/ }).click();

    await expectTableWarning(exportDialog);
    await expectPageNumberWarning(exportDialog);
    const imageCard = exportDialog
      .locator(".dr-warn-card")
      .filter({ hasText: "Pillow" });
    await expect(imageCard).toBeVisible();
    await expect(
      imageCard.locator(".dr-chip").filter({ hasText: "image1" }),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await exportDialog.getByRole("button", { name: "書き出す" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("report-reportlab.zip");
    mkdirSync(dirname(ZIP_SAVE_PATH), { recursive: true });
    await download.saveAs(ZIP_SAVE_PATH);

    const entries = readStoreZip(readFileSync(ZIP_SAVE_PATH));
    expect(entries.map((e) => e.name).sort()).toEqual([
      "NotoSansJP.ttf",
      "NotoSansJPBold.ttf",
      "OFL.txt",
      "report.py",
    ]);
    const code = entryOf(entries, "report.py").data.toString("utf8");
    expect(code).toContain('"NotoSansJP": ("NotoSansJP.ttf", ');
    expect(code).toContain('"NotoSansJPBold": ("NotoSansJPBold.ttf", ');
    expect(code).toMatch(/^PAGE_COUNT = 1$/m);
    expect(code).toContain("import base64");
    expect(code).toContain("Pillow");
    expect(code).toContain(LOGO_BASE64);
    expect(code).toContain("請求書");
    expect(code).toContain("T1234567890123");
    expect(code).toContain("ご請求金額（税込）");
    expect(code).toContain("ひな型ジャーナル株式会社 御中");
    expect(code).toContain("¥63,800");
    expect(code).toContain("360撮影");
    expect(code).toContain("¥50,000");

    expect(code).toContain('_text(c, "NotoSansJP", 130, 85,');
    expect(code).toContain('_text(c, "NotoSansJP", 130, 95,');
    expect(code).toContain('_text(c, "NotoSansJP", 90, 288,');
    expect(code).toContain(`"${FLEX_CHILD_TEXT.text20}"`);
    expect(code).toContain(`"${FLEX_CHILD_TEXT.text21}"`);
    expect(code).toContain('["1 / 1"]');
  });

  await test.step("IR 検査", async () => {
    await page.waitForFunction((text21) => {
      const raw = localStorage.getItem("denreport-designer.ir");
      if (raw === null) {
        return false;
      }
      try {
        const parsed = JSON.parse(raw) as { elements?: unknown[] };
        return (parsed.elements?.length ?? 0) === 26 && raw.includes(text21);
      } catch {
        return false;
      }
    }, FLEX_CHILD_TEXT.text21);
    const storedIr = await page.evaluate(() =>
      localStorage.getItem("denreport-designer.ir"),
    );
    const ir = JSON.parse(storedIr ?? "") as {
      readonly version: string;
      readonly elements: readonly StoredElement[];
    };
    expect(ir.version).toBe("1.0");
    expect(ir.elements).toHaveLength(26);

    const expectedPositions = [
      ...ELEMENTS.map((spec) => ({
        id: spec.id,
        type: spec.id.replace(/\d+$/, ""),
        x: spec.x,
        y: spec.y,
      })),
      { id: "flex1", type: "flex", x: 130, y: 85 },
    ];
    expect(
      ir.elements.map((el) => ({ id: el.id, type: el.type, x: el.x, y: el.y })),
    ).toEqual(expectedPositions);

    const texts = ir.elements.filter((el) => el.type === "text");
    expect(texts).toHaveLength(19);
    expect(texts.every((el) => "bind" in el === false)).toBe(true);
    const actualTokenTexts = texts
      .map((el) => el.text)
      .filter((text): text is string => /^\{[A-Za-z_]\w*\}$/.test(text ?? ""));
    expect([...actualTokenTexts].sort()).toEqual(
      [...BIND_KEYS].map((key) => `{${key}}`).sort(),
    );
    for (const spec of ELEMENTS) {
      if (spec.text === undefined) {
        continue;
      }
      const el = ir.elements.find((e) => e.id === spec.id);
      expect(el?.text).toBe(spec.text);
    }

    const table = ir.elements.find((el) => el.id === "table1");
    expect(table?.bind).toBe("items");
    expect(table?.columns).toEqual(
      TABLE_COLUMNS.map((c) => ({
        key: c.key,
        label: c.label,
        width: c.width,
        align: c.align,
      })),
    );
    expect(table?.minRows).toBe(12);
    expect(table?.rowHeight).toBe(7);
    expect(table?.headerHeight).toBe(8);
    expect(table?.maxY).toBe(235);
    expect(table?.continuationY).toBe(20);

    const image = ir.elements.find((el) => el.id === "image1");
    expect(image?.src).toBe(LOGO_DATA_URI);

    const pageNumber = ir.elements.find((el) => el.id === "pageNumber1");
    expect(pageNumber?.format).toBe("{n} / {N}");
    expect(pageNumber?.pages).toBe("all");
    expect(pageNumber?.w).toBe(30);
    expect(pageNumber?.h).toBe(6);
    expect(pageNumber?.align).toBe("center");
    expect(pageNumber?.fontSize).toBe(10);

    const flex = ir.elements.find((el) => el.id === "flex1");
    expect(flex?.direction).toBe("column");
    expect(flex?.gap).toBe(2);
    expect(flex?.justifyContent).toBe("start");
    expect(flex?.alignItems).toBe("start");
    expect(flex?.w).toBeUndefined();
    expect(flex?.h).toBeUndefined();
    expect(flex?.children).toHaveLength(2);
    expect(
      flex?.children?.map((child) => ({
        id: child.id,
        type: child.type,
        text: child.text,
        w: child.w,
        h: child.h,
      })),
    ).toEqual([
      { id: "text20", type: "text", text: FLEX_CHILD_TEXT.text20, w: 40, h: 8 },
      { id: "text21", type: "text", text: FLEX_CHILD_TEXT.text21, w: 40, h: 8 },
    ]);
    for (const child of flex?.children ?? []) {
      expect("x" in child).toBe(false);
      expect("y" in child).toBe(false);
      expect("pages" in child).toBe(false);
    }
  });
});
