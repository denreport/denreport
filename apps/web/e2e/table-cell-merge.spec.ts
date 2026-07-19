import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { dragFromPalette } from "./helpers/designer-actions";

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
  const table = page.locator('.apx-el[data-apx-id="table1"]');
  await expect(table).toBeVisible();

  await setSampleData(page, {
    items: [
      { col1: "同じ", col2: "A" },
      { col1: "同じ", col2: "B" },
      { col1: "別", col2: "C" },
    ],
  });

  const coveredCell = page.locator(
    '[data-apx-id="table1"] [data-apx-row="1"][data-apx-col="0"]',
  );
  await expect(coveredCell).toHaveText("同じ");

  const props = page.getByRole("complementary", { name: "プロパティ" });
  await props.getByLabel("列1 の同一値の連続行を結合").check();

  // 被覆セルが消え、起点セルと隣の列は残る
  await expect(coveredCell).toHaveCount(0);
  await expect(
    page.locator('[data-apx-id="table1"] [data-apx-row="0"][data-apx-col="0"]'),
  ).toHaveText("同じ");
  await expect(
    page.locator('[data-apx-id="table1"] [data-apx-row="1"][data-apx-col="1"]'),
  ).toHaveText("B");

  const preview = page.getByRole("dialog", { name: "プレビュー" });
  await page.getByRole("button", { name: "プレビュー" }).click();
  await expect(preview).toBeVisible();
  await expect(preview.locator(".apx-preview-error")).toHaveCount(0);
  await expect(preview.locator(".apx-preview-count")).toHaveText("1 ページ");
});

test("静的な結合をプロパティで作成し、プレビューと書き出しが検証エラーなく通る", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^表/, { x: 130, y: 150 });
  const table = page.locator('.apx-el[data-apx-id="table1"]');
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

  // 既定の結合（列 col1・行0から縦2行）で被覆セルが消える
  await expect(
    page.locator('[data-apx-id="table1"] [data-apx-row="1"][data-apx-col="0"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('[data-apx-id="table1"] [data-apx-row="0"][data-apx-col="0"]'),
  ).toHaveText("行A");
  await expect(
    page.locator('[data-apx-id="table1"] [data-apx-row="1"][data-apx-col="1"]'),
  ).toHaveText("値B");

  const preview = page.getByRole("dialog", { name: "プレビュー" });
  await page.getByRole("button", { name: "プレビュー" }).click();
  await expect(preview).toBeVisible();
  await expect(preview.locator(".apx-preview-error")).toHaveCount(0);
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
