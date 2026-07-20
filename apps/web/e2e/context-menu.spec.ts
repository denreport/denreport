import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

function paletteButton(page: Page) {
  return page
    .getByRole("navigation", { name: "要素パレット" })
    .getByRole("button", { name: /^テキスト/ });
}

test("要素上の右クリックからメニューで削除し、undo・コピー・貼り付けが行える", async ({
  page,
}) => {
  await page.goto("/");
  await paletteButton(page).click();
  const element = page.locator('.dr-el[data-dr-id="text1"]');
  await expect(element).toBeVisible();

  await element.click({ button: "right" });
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const copyItem = menu.getByRole("menuitem", { name: /^コピー/ });
  const deleteItem = menu.getByRole("menuitem", { name: /^削除/ });
  const pasteItem = menu.getByRole("menuitem", { name: /^貼り付け/ });
  await expect(copyItem).toHaveAttribute("aria-disabled", "false");
  await expect(deleteItem).toHaveAttribute("aria-disabled", "false");
  await expect(pasteItem).toHaveAttribute("aria-disabled", "true");

  await deleteItem.click();
  await expect(element).toHaveCount(0);

  await page.keyboard.press("ControlOrMeta+z");
  await expect(element).toBeVisible();

  await element.click({ button: "right" });
  await page
    .getByRole("menu")
    .getByRole("menuitem", { name: /^コピー/ })
    .click();

  const paper = page.getByRole("application", { name: "キャンバス" });
  const paperBox = await paper.boundingBox();
  if (paperBox === null) {
    throw new Error("キャンバスが表示されていません");
  }
  await paper.click({
    button: "right",
    position: { x: paperBox.width - 10, y: paperBox.height - 10 },
  });
  const bgMenu = page.getByRole("menu");
  await expect(
    bgMenu.getByRole("menuitem", { name: /^貼り付け/ }),
  ).toHaveAttribute("aria-disabled", "false");

  await bgMenu.getByRole("menuitem", { name: /^貼り付け/ }).click();
  await expect(page.locator(".dr-el[data-dr-id]")).toHaveCount(2);
});

test("Esc でメニューが閉じる", async ({ page }) => {
  await page.goto("/");
  await paletteButton(page).click();
  const element = page.locator('.dr-el[data-dr-id="text1"]');
  await expect(element).toBeVisible();

  await element.click({ button: "right" });
  await expect(page.getByRole("menu")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
});
