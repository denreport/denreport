import { expect, test } from "@playwright/test";
import { commitField, dragFromPalette } from "./helpers/designer-actions";

test("minRows の空行セルに固定値を入力すると、キャンバスとプレビューの両方に反映される", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^表/, { x: 130, y: 150 });
  const table = page.locator('.apx-el[data-apx-id="table1"]');
  await expect(table).toBeVisible();

  const props = page.getByRole("complementary", { name: "プロパティ" });
  await commitField(props.getByLabel("最低行数"), "2");

  const cell = page.locator(
    '[data-apx-id="table1"] [data-apx-row="0"][data-apx-col="0"]',
  );
  await cell.dblclick();
  const editor = page.locator(".apx-inline-editor");
  await expect(editor).toBeVisible();
  await expect(editor).toHaveValue("");
  await editor.fill("固定値");
  await editor.press("Enter");
  await expect(editor).toBeHidden();

  await expect(cell).toHaveText("固定値");
  await expect(cell).toHaveClass(/is-override/);

  await page.getByRole("button", { name: "プレビュー" }).click();
  const preview = page.getByRole("dialog", { name: "プレビュー" });
  await expect(preview).toBeVisible();
  await expect(preview.getByText("固定値")).toBeVisible();
});

test("bind データのあるセルを上書きすると、プレビューは固定値を優先し、Ctrl+Z で bind 値に戻る", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^表/, { x: 130, y: 150 });
  const table = page.locator('.apx-el[data-apx-id="table1"]');
  await expect(table).toBeVisible();

  const preview = page.getByRole("dialog", { name: "プレビュー" });
  await page.getByRole("button", { name: "プレビュー" }).click();
  await expect(preview).toBeVisible();
  const sampleField = preview.getByLabel("サンプルデータ (JSON)");
  await sampleField.fill(
    JSON.stringify({ items: [{ col1: "行A", col2: "値A" }] }),
  );
  await sampleField.blur();
  await preview.getByRole("button", { name: "閉じる" }).click();
  await expect(preview).toBeHidden();

  const cell = page.locator(
    '[data-apx-id="table1"] [data-apx-row="0"][data-apx-col="0"]',
  );
  await expect(cell).toHaveText("行A");

  await cell.dblclick();
  const editor = page.locator(".apx-inline-editor");
  await expect(editor).toHaveValue("行A");
  await editor.fill("上書き値");
  await editor.press("Enter");
  await expect(editor).toBeHidden();
  await expect(cell).toHaveText("上書き値");

  await page.getByRole("button", { name: "プレビュー" }).click();
  await expect(preview).toBeVisible();
  await expect(preview.getByText("上書き値")).toBeVisible();
  await expect(preview.getByText("行A", { exact: true })).toHaveCount(0);
  await preview.getByRole("button", { name: "閉じる" }).click();
  await expect(preview).toBeHidden();

  // Return focus to the canvas before undoing (doesn't change the selection)
  await table.click();
  await page.keyboard.press("Control+z");
  await expect(cell).toHaveText("行A");
});

test("空文字列で確定すると上書きが消え、bind 値の表示に戻る", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^表/, { x: 130, y: 150 });
  const table = page.locator('.apx-el[data-apx-id="table1"]');
  await expect(table).toBeVisible();

  const preview = page.getByRole("dialog", { name: "プレビュー" });
  await page.getByRole("button", { name: "プレビュー" }).click();
  await expect(preview).toBeVisible();
  const sampleField = preview.getByLabel("サンプルデータ (JSON)");
  await sampleField.fill(
    JSON.stringify({ items: [{ col1: "行A", col2: "値A" }] }),
  );
  await sampleField.blur();
  await preview.getByRole("button", { name: "閉じる" }).click();
  await expect(preview).toBeHidden();

  const cell = page.locator(
    '[data-apx-id="table1"] [data-apx-row="0"][data-apx-col="0"]',
  );
  await cell.dblclick();
  const editor = page.locator(".apx-inline-editor");
  await editor.fill("上書き値");
  await editor.press("Enter");
  await expect(editor).toBeHidden();
  await expect(cell).toHaveText("上書き値");
  await expect(cell).toHaveClass(/is-override/);

  await cell.dblclick();
  await expect(editor).toHaveValue("上書き値");
  await editor.fill("");
  await editor.press("Enter");
  await expect(editor).toBeHidden();

  await expect(cell).toHaveText("行A");
  await expect(cell).not.toHaveClass(/is-override/);
});
