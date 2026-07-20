import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { dragFromPalette } from "./helpers/designer-actions";

// Cell-center px for the default table (col1/col2 each 40mm, header 8mm, row 8mm). Computed
// from the table's and canvas's measured boundingBox so it doesn't depend on snap-position jitter
async function cellCenter(
  page: Page,
  row: "header" | number,
  col: number,
): Promise<{ readonly x: number; readonly y: number }> {
  const table = page.locator('.dr-el[data-dr-id="table1"]');
  const tableBox = await table.boundingBox();
  const paper = page.getByRole("application", { name: "キャンバス" });
  const paperBox = await paper.boundingBox();
  if (tableBox === null || paperBox === null) {
    throw new Error("表またはキャンバスが表示されていません");
  }
  const pxPerMm = paperBox.width / 210;
  return {
    x: tableBox.x + (col * 40 + 20) * pxPerMm,
    y:
      row === "header"
        ? tableBox.y + 4 * pxPerMm
        : tableBox.y + (8 + row * 8 + 4) * pxPerMm,
  };
}

async function setSampleData(
  page: import("@playwright/test").Page,
  data: unknown,
): Promise<void> {
  const preview = page.getByRole("dialog", { name: "プレビュー" });
  await page.getByRole("button", { name: "プレビュー" }).click();
  await expect(preview).toBeVisible();
  const sampleField = preview.getByLabel("サンプルデータ (JSON)");
  await sampleField.fill(JSON.stringify(data));
  await sampleField.blur();
  await preview.getByRole("button", { name: "閉じる" }).click();
  await expect(preview).toBeHidden();
}

test("同一値の連続行の結合がキャンバスとプレビューに反映される", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^表/, { x: 130, y: 150 });
  const table = page.locator('.dr-el[data-dr-id="table1"]');
  await expect(table).toBeVisible();

  await setSampleData(page, {
    items: [
      { col1: "同じ", col2: "A" },
      { col1: "同じ", col2: "B" },
      { col1: "別", col2: "C" },
    ],
  });

  const coveredCell = page.locator(
    '[data-dr-id="table1"] [data-dr-row="1"][data-dr-col="0"]',
  );
  await expect(coveredCell).toHaveText("同じ");

  const props = page.getByRole("complementary", { name: "プロパティ" });
  await props.getByLabel("列1 の同一値の連続行を結合").check();

  // The covered cell disappears, while the origin cell and the neighboring column remain
  await expect(coveredCell).toHaveCount(0);
  await expect(
    page.locator('[data-dr-id="table1"] [data-dr-row="0"][data-dr-col="0"]'),
  ).toHaveText("同じ");
  await expect(
    page.locator('[data-dr-id="table1"] [data-dr-row="1"][data-dr-col="1"]'),
  ).toHaveText("B");

  const preview = page.getByRole("dialog", { name: "プレビュー" });
  await page.getByRole("button", { name: "プレビュー" }).click();
  await expect(preview).toBeVisible();
  await expect(preview.locator(".dr-preview-error")).toHaveCount(0);
  await expect(preview.locator(".dr-preview-count")).toHaveText("1 ページ");
});

test("静的な結合をプロパティで作成し、プレビューと書き出しが検証エラーなく通る", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^表/, { x: 130, y: 150 });
  const table = page.locator('.dr-el[data-dr-id="table1"]');
  await expect(table).toBeVisible();

  await setSampleData(page, {
    items: [
      { col1: "行A", col2: "値A" },
      { col1: "行B", col2: "値B" },
    ],
  });

  const props = page.getByRole("complementary", { name: "プロパティ" });
  await props.getByRole("button", { name: "＋ 結合を追加" }).click();
  await expect(props.getByLabel("結合1 の行数")).toHaveValue("2");

  // The default merge (column col1, 2 rows vertically starting at row 0) hides the covered cell
  await expect(
    page.locator('[data-dr-id="table1"] [data-dr-row="1"][data-dr-col="0"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('[data-dr-id="table1"] [data-dr-row="0"][data-dr-col="0"]'),
  ).toHaveText("行A");
  await expect(
    page.locator('[data-dr-id="table1"] [data-dr-row="1"][data-dr-col="1"]'),
  ).toHaveText("値B");

  const preview = page.getByRole("dialog", { name: "プレビュー" });
  await page.getByRole("button", { name: "プレビュー" }).click();
  await expect(preview).toBeVisible();
  await expect(preview.locator(".dr-preview-error")).toHaveCount(0);
  await preview.getByRole("button", { name: "閉じる" }).click();
  await expect(preview).toBeHidden();

  await page.getByRole("button", { name: "書き出し" }).click();
  const exportDialog = page.getByRole("dialog", { name: "書き出し" });
  await expect(exportDialog).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await exportDialog.getByRole("button", { name: "書き出す" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("report-pdfme.json");
  const artifact = JSON.parse(
    readFileSync((await download.path()) ?? "", "utf8"),
  ) as { readonly template?: unknown; readonly inputs?: unknown };
  expect(artifact.template).toBeDefined();
  expect(artifact.inputs).toBeDefined();
});

test("セルをドラッグ選択して右クリックで結合し、解除できる", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^表/, { x: 130, y: 150 });
  const table = page.locator('.dr-el[data-dr-id="table1"]');
  await expect(table).toBeVisible();
  const beforeDrag = await table.boundingBox();

  const start = await cellCenter(page, 0, 0);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const end = await cellCenter(page, 1, 0);
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();

  await expect(page.locator(".dr-cell-sel")).toBeVisible();
  const afterDrag = await table.boundingBox();
  expect(afterDrag).toEqual(beforeDrag);

  await page.mouse.click(end.x, end.y, { button: "right" });
  const menu = page.getByRole("menu");
  const mergeItem = menu.getByRole("menuitem", { name: "セルを結合" });
  await expect(mergeItem).toHaveAttribute("aria-disabled", "false");
  await mergeItem.click();

  await expect(
    page.locator('[data-dr-id="table1"] [data-dr-row="1"][data-dr-col="0"]'),
  ).toHaveCount(0);
  const props = page.getByRole("complementary", { name: "プロパティ" });
  await expect(props.getByLabel("結合1 の行数")).toHaveValue("2");

  const origin = await cellCenter(page, 0, 0);
  await page.mouse.click(origin.x, origin.y);
  await page.mouse.click(origin.x, origin.y, { button: "right" });
  await page
    .getByRole("menu")
    .getByRole("menuitem", { name: "結合を解除" })
    .click();

  await expect(
    page.locator('[data-dr-id="table1"] [data-dr-row="1"][data-dr-col="0"]'),
  ).toBeVisible();
  await expect(props.getByLabel("結合1 の行数")).toHaveCount(0);
});

test("ヘッダ行は横ドラッグで結合できる", async ({ page }) => {
  await page.goto("/");
  await dragFromPalette(page, /^表/, { x: 130, y: 150 });
  const table = page.locator('.dr-el[data-dr-id="table1"]');
  await expect(table).toBeVisible();

  const start = await cellCenter(page, "header", 0);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const end = await cellCenter(page, "header", 1);
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator(".dr-cell-sel")).toBeVisible();

  await page.mouse.click(end.x, end.y, { button: "right" });
  await page
    .getByRole("menu")
    .getByRole("menuitem", { name: "セルを結合" })
    .click();

  await expect(
    page.locator('[data-dr-id="table1"] .dr-tbl-th[data-dr-col="1"]'),
  ).toHaveCount(0);

  const preview = page.getByRole("dialog", { name: "プレビュー" });
  await page.getByRole("button", { name: "プレビュー" }).click();
  await expect(preview).toBeVisible();
  await expect(preview.locator(".dr-preview-error")).toHaveCount(0);
});

test("mergeSameValue 列を含む範囲では結合が無効", async ({ page }) => {
  await page.goto("/");
  await dragFromPalette(page, /^表/, { x: 130, y: 150 });
  const table = page.locator('.dr-el[data-dr-id="table1"]');
  await expect(table).toBeVisible();

  const props = page.getByRole("complementary", { name: "プロパティ" });
  await props.getByLabel("列1 の同一値の連続行を結合").check();

  const start = await cellCenter(page, 0, 0);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const end = await cellCenter(page, 1, 0);
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator(".dr-cell-sel")).toBeVisible();

  await page.mouse.click(end.x, end.y, { button: "right" });
  await expect(
    page.getByRole("menu").getByRole("menuitem", { name: "セルを結合" }),
  ).toHaveAttribute("aria-disabled", "true");
});
