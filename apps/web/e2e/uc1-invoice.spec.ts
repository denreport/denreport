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

test("UC-1: 請求書レイアウトを作りプレビューして ReportLab コードに書き出す", async ({
  page,
}) => {
  // vite preview は Cache-Control: no-cache + ETag で配信するため、2回目以降の fetch は
  // 304 再検証（本体 0 バイト）になる。「再取得しない」の検査対象はフォント本体の
  // ダウンロード回数とし、Resource Timing の転送量で数える
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

  // 1. 白紙で起動
  await page.goto("/");
  await expect(
    page.getByText("パレットから要素をドラッグして配置"),
  ).toBeVisible();

  // 2. 要素配置: text ×4（宛先・発行者・登録番号・合計）+ table ×1
  await dragFromPalette(page, /^テキスト/, { x: 45, y: 40 });
  await expect(page.locator('.apx-el[data-apx-id="text1"]')).toBeVisible();
  await dragFromPalette(page, /^テキスト/, { x: 160, y: 40 });
  await expect(page.locator('.apx-el[data-apx-id="text2"]')).toBeVisible();
  await dragFromPalette(page, /^テキスト/, { x: 160, y: 55 });
  await expect(page.locator('.apx-el[data-apx-id="text3"]')).toBeVisible();
  await dragFromPalette(page, /^テキスト/, { x: 160, y: 250 });
  await expect(page.locator('.apx-el[data-apx-id="text4"]')).toBeVisible();
  await dragFromPalette(page, /^表/, { x: 105, y: 120 });
  await expect(page.locator('.apx-el[data-apx-id="table1"]')).toBeVisible();

  // 3. プロパティ編集
  const props = page.getByRole("complementary", { name: "プロパティ" });

  // 宛先: {customerName} トークン
  await page.locator('.apx-el[data-apx-id="text1"]').click();
  const destinationField = props.getByLabel("テキスト", { exact: true });
  await destinationField.fill("{customerName}");
  await destinationField.blur();

  // 発行者・登録番号: 固定文言
  await page.locator('.apx-el[data-apx-id="text2"]').click();
  const issuerField = props.getByLabel("テキスト", { exact: true });
  await issuerField.fill("株式会社サンプル商事");
  await issuerField.blur();

  await page.locator('.apx-el[data-apx-id="text3"]').click();
  const registrationField = props.getByLabel("テキスト", { exact: true });
  await registrationField.fill("登録番号 T1234567890123");
  await registrationField.blur();

  // 合計: {total} トークン
  await page.locator('.apx-el[data-apx-id="text4"]').click();
  const totalField = props.getByLabel("テキスト", { exact: true });
  await totalField.fill("{total}");
  await totalField.blur();

  // 明細表: bind = items（既定値を確認）と列定義3列（品名 name / 数量 qty / 金額 price）
  await page.locator('.apx-el[data-apx-id="table1"]').click();
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

  // 4. サンプルデータ生成と行数変更
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

  // 5. プレビュー確認: ページ数・警告なし・同梱フォント
  await expect(preview.getByText("1 ページ", { exact: true })).toBeVisible();
  await expect(preview.locator(".apx-preview-warnings")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => document.fonts.check("13px apx-embedded-notosansjp")),
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
  await expect(preview.locator(".apx-preview-pageno").first()).toHaveText(
    /^1 \/ [2-9]\d*$/,
  );
  await expect(preview.locator(".apx-preview-warnings")).toHaveCount(0);

  // プレビューを開き直してもフォント本体の再ダウンロードは起きない
  expect(await fontDownloadCount()).toBe(1);
  await preview.getByRole("button", { name: "閉じる" }).click();
  await expect(preview).toBeHidden();
  await page.getByRole("button", { name: "プレビュー" }).click();
  await expect(preview.locator(".apx-preview-pageno").first()).toBeVisible();
  expect(await fontDownloadCount()).toBe(1);
  await preview.getByRole("button", { name: "閉じる" }).click();
  await expect(preview).toBeHidden();

  // 6. 書き出しダイアログ（初期フォーカス・Esc）→ ReportLab 書き出し
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

  // 7. zip の内容検査
  const entries = readStoreZip(readFileSync(ZIP_SAVE_PATH));
  expect(entries.map((e) => e.name).sort()).toEqual([
    "NotoSansJP.ttf",
    "report.py",
  ]);
  const fontEntry = entryOf(entries, "NotoSansJP.ttf");
  expect(fontEntry.data.equals(readFileSync(FONT_ASSET_PATH))).toBe(true);
  const code = entryOf(entries, "report.py").data.toString("utf8");
  expect(code).toContain('FONT_FILE = "NotoSansJP.ttf"');
  expect(code).toMatch(/^PAGE_COUNT = \d+$/m);
  expect(code).toContain("株式会社サンプル商事");
  // 既定幅 40mm には収まらず1文字単位の折り返しで2行に分かれる
  expect(code).toContain('["登録番号 T12345678901", "23"]');
  expect(code).toContain("customerName");
  expect(code).toContain("品目 60");

  // 8. 自動保存された IR の同等性（text ×4 + table、bind、列 key）
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
