import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

function paletteButton(page: Page) {
  return page
    .getByRole("navigation", { name: "要素パレット" })
    .getByRole("button", { name: /^テキスト/ });
}

function propsPanel(page: Page) {
  return page.getByRole("complementary", { name: "プロパティ" });
}

function stylesDialog(page: Page) {
  return page.getByRole("dialog", { name: "スタイル" });
}

async function selectLayer(page: Page, id: string): Promise<void> {
  await page.locator(`[data-apx-layer-id="${id}"] .apx-layer-main`).click();
}

test("スタイル作成 → 複数要素へ適用 → 定義変更の一括反映 → 保存・再読込後も参照が維持される", async ({
  page,
}) => {
  await page.goto("/");

  // Place two elements, text1 and text2
  await paletteButton(page).click();
  await expect(page.locator('.apx-el[data-apx-id="text1"]')).toBeVisible();
  await paletteButton(page).click();
  await expect(page.locator('.apx-el[data-apx-id="text2"]')).toBeVisible();

  // Create a style and give it a name
  await page.getByRole("button", { name: "スタイル" }).click();
  const dialog = stylesDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "＋ 新しいスタイル" }).click();
  await dialog.getByLabel("名前").fill("見出し");
  await dialog.getByLabel("名前").press("Enter");
  await dialog.getByRole("button", { name: "閉じる" }).click();
  await expect(dialog).not.toBeVisible();

  // Apply it to both text1 and text2
  await selectLayer(page, "text1");
  await propsPanel(page)
    .getByLabel("スタイル")
    .selectOption({ label: "見出し" });
  await selectLayer(page, "text2");
  await propsPanel(page)
    .getByLabel("スタイル")
    .selectOption({ label: "見出し" });
  await expect(
    propsPanel(page).getByLabel("文字サイズ", { exact: true }),
  ).toHaveValue("10.0");

  // Changing the definition's font size applies to both elements at once
  await page.getByRole("button", { name: "スタイル" }).click();
  await expect(dialog).toBeVisible();
  const fontSizeField = dialog.getByRole("textbox", { name: "文字サイズ" });
  await fontSizeField.fill("24");
  await fontSizeField.press("Enter");
  await dialog.getByRole("button", { name: "閉じる" }).click();

  await selectLayer(page, "text1");
  await expect(
    propsPanel(page).getByLabel("文字サイズ", { exact: true }),
  ).toHaveValue("24.0");
  await selectLayer(page, "text2");
  await expect(
    propsPanel(page).getByLabel("文字サイズ", { exact: true }),
  ).toHaveValue("24.0");

  // The reference is preserved after save and reload, and a repeated bulk update still works
  await page.waitForFunction(() =>
    (localStorage.getItem("denreport-designer.ir") ?? "").includes(
      '"style":"見出し"',
    ),
  );
  await page.reload();

  await page.getByRole("button", { name: "スタイル" }).click();
  await expect(dialog).toBeVisible();
  const fontSizeFieldAfterReload = dialog.getByRole("textbox", {
    name: "文字サイズ",
  });
  await expect(fontSizeFieldAfterReload).toHaveValue("24.0");
  await fontSizeFieldAfterReload.fill("30");
  await fontSizeFieldAfterReload.press("Enter");
  await dialog.getByRole("button", { name: "閉じる" }).click();

  await selectLayer(page, "text1");
  await expect(
    propsPanel(page).getByLabel("文字サイズ", { exact: true }),
  ).toHaveValue("30.0");
  await selectLayer(page, "text2");
  await expect(
    propsPanel(page).getByLabel("文字サイズ", { exact: true }),
  ).toHaveValue("30.0");
});
