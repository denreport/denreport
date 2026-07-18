import { expect, test } from "@playwright/test";

test("記載事項チェックを有効化すると警告が出て、欄を配置すると消え、警告があっても書き出しできる", async ({
  page,
}) => {
  await page.goto("/");
  const props = page.getByRole("complementary", { name: "プロパティ" });
  await props.getByLabel("有効化").check();

  const drawerBar = page.locator(".apx-drawer-bar");
  await drawerBar.click();
  await expect(page.locator(".apx-badge-warn")).toHaveText("6");
  await expect(page.locator(".apx-verr")).toHaveCount(6);
  const registrationWarning = page.locator(".apx-verr", {
    hasText: "発行者の登録番号",
  });
  await expect(registrationWarning).toHaveCount(1);

  await page
    .getByRole("navigation", { name: "要素パレット" })
    .getByRole("button", { name: /^テキスト/ })
    .click();
  const textField = props.getByLabel("テキスト", { exact: true });
  await textField.fill("{registrationNumber}");
  await textField.blur();

  await expect(page.locator(".apx-badge-warn")).toHaveText("5");
  await expect(registrationWarning).toHaveCount(0);

  await page.getByRole("button", { name: "書き出し" }).click();
  const exportDialog = page.getByRole("dialog", { name: "書き出し" });
  await expect(exportDialog).toBeVisible();
  const exportButton = exportDialog.getByRole("button", { name: "書き出す" });
  await expect(exportButton).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  await downloadPromise;
});
