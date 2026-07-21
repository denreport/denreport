import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { commitField, dragFromPalette } from "./helpers/designer-actions";
import { readStoreZip, type ZipEntryData } from "./helpers/zip";

const FONT_ASSET_PATH = fileURLToPath(
  new URL(
    "../../../packages/targets/assets/fonts/NotoSansJP-Regular.ttf",
    import.meta.url,
  ),
);
const BOLD_FONT_ASSET_PATH = fileURLToPath(
  new URL(
    "../../../packages/targets/assets/fonts/NotoSansJP-Bold.ttf",
    import.meta.url,
  ),
);
const OFL_ASSET_PATH = fileURLToPath(
  new URL("../../../packages/targets/assets/fonts/OFL.txt", import.meta.url),
);
const ZIP_SAVE_PATH = fileURLToPath(
  new URL("../test-results/uc1/report-reportlab.zip", import.meta.url),
);

function entryOf(entries: readonly ZipEntryData[], name: string): ZipEntryData {
  const entry = entries.find((e) => e.name === name);
  if (entry === undefined) {
    throw new Error(`zip に ${name} がありません`);
  }
  return entry;
}

test("UC-1: build an invoice layout, preview it, and export to ReportLab code", async ({
  page,
}) => {
  // vite preview serves with Cache-Control: no-cache + ETag, so fetches from the second one on
  // become 304 revalidations (0-byte body). We check "no re-fetch" by counting font-body
  // downloads via Resource Timing transfer size
  const fontDownloadCount = (): Promise<number> =>
    page.evaluate(
      () =>
        performance
          .getEntriesByType("resource")
          .filter(
            (entry): entry is PerformanceResourceTiming =>
              entry.name.endsWith(".ttf") &&
              entry instanceof PerformanceResourceTiming,
          )
          .filter(
            (entry) =>
              entry.encodedBodySize > 0 &&
              entry.transferSize >= entry.encodedBodySize,
          ).length,
    );

  // 1. Start with a blank canvas
  await page.goto("/");
  await expect(
    page.getByText("パレットから要素をドラッグして配置"),
  ).toBeVisible();

  // 2. Place elements: text ×4 (recipient, issuer, registration number, total) + table ×1
  await dragFromPalette(page, /^テキスト/, { x: 45, y: 40 });
  await expect(page.locator('.dr-el[data-dr-id="text1"]')).toBeVisible();
  await dragFromPalette(page, /^テキスト/, { x: 160, y: 40 });
  await expect(page.locator('.dr-el[data-dr-id="text2"]')).toBeVisible();
  await dragFromPalette(page, /^テキスト/, { x: 160, y: 55 });
  await expect(page.locator('.dr-el[data-dr-id="text3"]')).toBeVisible();
  await dragFromPalette(page, /^テキスト/, { x: 160, y: 250 });
  await expect(page.locator('.dr-el[data-dr-id="text4"]')).toBeVisible();
  await dragFromPalette(page, /^表/, { x: 105, y: 120 });
  await expect(page.locator('.dr-el[data-dr-id="table1"]')).toBeVisible();

  // 3. Edit properties
  const props = page.getByRole("complementary", { name: "プロパティ" });

  // Recipient: {customerName} token
  await page.locator('.dr-el[data-dr-id="text1"]').click();
  const destinationField = props.getByLabel("テキスト", { exact: true });
  await destinationField.fill("{customerName}");
  await destinationField.blur();

  // Issuer / registration number: fixed text
  await page.locator('.dr-el[data-dr-id="text2"]').click();
  const issuerField = props.getByLabel("テキスト", { exact: true });
  await issuerField.fill("株式会社サンプル商事");
  await issuerField.blur();

  await page.locator('.dr-el[data-dr-id="text3"]').click();
  const registrationField = props.getByLabel("テキスト", { exact: true });
  await registrationField.fill("登録番号 T1234567890123");
  await registrationField.blur();

  // Total: {total} token
  await page.locator('.dr-el[data-dr-id="text4"]').click();
  const totalField = props.getByLabel("テキスト", { exact: true });
  await totalField.fill("{total}");
  await totalField.blur();

  // Line-item table: bind = items (verify the default) and 3 column definitions (name / qty / price)
  await page.locator('.dr-el[data-dr-id="table1"]').click();
  await expect(props.getByLabel("バインド")).toHaveValue("items");
  await commitField(props.getByLabel("y（1ページ目）", { exact: true }), "100");
  await commitField(props.getByLabel("列1 の key"), "name");
  await commitField(props.getByLabel("列1 の見出し"), "品名");
  await commitField(props.getByLabel("列1 の幅"), "60");
  await commitField(props.getByLabel("列2 の key"), "qty");
  await commitField(props.getByLabel("列2 の見出し"), "数量");
  await commitField(props.getByLabel("列2 の幅"), "25");
  await props.getByLabel("列2 の整列").selectOption("right");
  await props.getByRole("button", { name: "＋ 列を追加" }).click();
  await commitField(props.getByLabel("列3 の key"), "price");
  await commitField(props.getByLabel("列3 の見出し"), "金額");
  await commitField(props.getByLabel("列3 の幅"), "35");
  await props.getByLabel("列3 の整列").selectOption("right");

  // 4. Generate sample data and change the row count
  await page.getByRole("button", { name: "プレビュー" }).click();
  const preview = page.getByRole("dialog", { name: "プレビュー" });
  await expect(preview).toBeVisible();
  await preview.getByRole("button", { name: "bind キーから生成" }).click();

  const sampleField = preview.getByLabel("サンプルデータ (JSON)");
  const generated = JSON.parse(await sampleField.inputValue()) as {
    readonly customerName?: unknown;
    readonly total?: unknown;
    readonly items?: unknown;
  };
  expect(generated.customerName).toBe("customerName");
  expect(generated.total).toBe("total");
  expect(generated.items).toHaveLength(3);

  // 5. Verify the preview: page count, no warnings, bundled font
  await expect(preview.getByText("1 ページ", { exact: true })).toBeVisible();
  await expect(preview.locator(".dr-preview-warnings")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => document.fonts.check("13px dr-embedded-notosansjp")),
    )
    .toBe(true);

  const manyRows = Array.from({ length: 60 }, (_, i) => ({
    name: `品目 ${i + 1}`,
    qty: String(i + 1),
    price: String((i + 1) * 100),
  }));
  await sampleField.fill(
    JSON.stringify({ ...generated, items: manyRows }, null, 2),
  );
  await sampleField.blur();
  await expect(preview.getByText(/^[2-9]\d* ページ$/)).toBeVisible();
  await expect(preview.locator(".dr-preview-pageno").first()).toHaveText(
    /^1 \/ [2-9]\d*$/,
  );
  await expect(preview.locator(".dr-preview-warnings")).toHaveCount(0);

  // Reopening the preview doesn't re-download the font bodies (2 files: regular + bold)
  expect(await fontDownloadCount()).toBe(2);
  await preview.getByRole("button", { name: "閉じる" }).click();
  await expect(preview).toBeHidden();
  await page.getByRole("button", { name: "プレビュー" }).click();
  await expect(preview.locator(".dr-preview-pageno").first()).toBeVisible();
  expect(await fontDownloadCount()).toBe(2);
  await preview.getByRole("button", { name: "閉じる" }).click();
  await expect(preview).toBeHidden();

  // 6. Export dialog (initial focus, Esc) → ReportLab export
  await page.getByRole("button", { name: "書き出し" }).click();
  const exportDialog = page.getByRole("dialog", { name: "書き出し" });
  await expect(exportDialog).toBeVisible();
  expect(
    await exportDialog.evaluate((el) =>
      el.contains(el.ownerDocument.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(exportDialog).toBeHidden();

  await page.getByRole("button", { name: "書き出し" }).click();
  await expect(exportDialog).toBeVisible();
  await exportDialog.getByRole("button", { name: /ReportLab/ }).click();
  const downloadPromise = page.waitForEvent("download");
  await exportDialog.getByRole("button", { name: "書き出す" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("report-reportlab.zip");
  await download.saveAs(ZIP_SAVE_PATH);

  // 7. Inspect the zip contents
  const entries = readStoreZip(readFileSync(ZIP_SAVE_PATH));
  expect(entries.map((e) => e.name).sort()).toEqual([
    "NotoSansJP.ttf",
    "NotoSansJPBold.ttf",
    "OFL.txt",
    "report.py",
  ]);
  const fontEntry = entryOf(entries, "NotoSansJP.ttf");
  expect(fontEntry.data.equals(readFileSync(FONT_ASSET_PATH))).toBe(true);
  const boldFontEntry = entryOf(entries, "NotoSansJPBold.ttf");
  expect(boldFontEntry.data.equals(readFileSync(BOLD_FONT_ASSET_PATH))).toBe(
    true,
  );
  const oflEntry = entryOf(entries, "OFL.txt");
  expect(oflEntry.data.equals(readFileSync(OFL_ASSET_PATH))).toBe(true);
  const code = entryOf(entries, "report.py").data.toString("utf8");
  expect(code).toContain('"NotoSansJP": ("NotoSansJP.ttf", ');
  expect(code).toContain('"NotoSansJPBold": ("NotoSansJPBold.ttf", ');
  expect(code).toMatch(/^PAGE_COUNT = \d+$/m);
  expect(code).toContain("株式会社サンプル商事");
  // Does not fit within the default 40mm width, wraps character-by-character into 2 lines
  expect(code).toContain('["登録番号 T12345678901", "23"]');
  expect(code).toContain("customerName");
  expect(code).toContain("品目 60");

  // 8. Equivalence of the auto-saved IR (text ×4 + table, bind, column keys)
  await page.waitForFunction(() =>
    (localStorage.getItem("denreport-designer.ir") ?? "").includes('"price"'),
  );
  const storedIr = await page.evaluate(() =>
    localStorage.getItem("denreport-designer.ir"),
  );
  const ir = JSON.parse(storedIr ?? "") as {
    readonly version: string;
    readonly elements: readonly {
      readonly type: string;
      readonly bind?: string;
      readonly text?: string;
      readonly columns?: readonly { readonly key: string }[];
    }[];
  };
  expect(ir.version).toBe("1.0");
  const texts = ir.elements.filter((el) => el.type === "text");
  expect(texts).toHaveLength(4);
  expect(texts.every((el) => "bind" in el === false)).toBe(true);
  expect(texts.map((el) => el.text)).toEqual(
    expect.arrayContaining([
      "{customerName}",
      "{total}",
      "株式会社サンプル商事",
      "登録番号 T1234567890123",
    ]),
  );
  const [table, ...restTables] = ir.elements.filter(
    (el) => el.type === "table",
  );
  expect(restTables).toHaveLength(0);
  expect(table?.bind).toBe("items");
  expect(table?.columns?.map((column) => column.key)).toEqual([
    "name",
    "qty",
    "price",
  ]);
});
