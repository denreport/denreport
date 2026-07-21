import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { dragFromPalette } from "./helpers/designer-actions";

const PAGE_WIDTH_MM = 210;
const PAGE_CENTER_MM = { x: 105, y: 148.5 };

function paletteButton(page: Page) {
  return page
    .getByRole("navigation", { name: "要素パレット" })
    .getByRole("button", { name: /^テキスト/ });
}

test("clicking the palette adds the element to the page center and selects it", async ({
  page,
}) => {
  await page.goto("/");
  await paletteButton(page).click();

  const element = page.locator('.dr-el[data-dr-id="text1"]');
  await expect(element).toBeVisible();
  await expect(page.locator(".dr-sel-box .dr-el-chip")).toHaveText(
    "テキスト · text1",
  );

  const paper = page.getByRole("application", { name: "キャンバス" });
  const paperBox = await paper.boundingBox();
  const elBox = await element.boundingBox();
  if (paperBox === null || elBox === null) {
    throw new Error("キャンバスまたは要素が表示されていません");
  }
  const pxPerMm = paperBox.width / PAGE_WIDTH_MM;
  const centerX = elBox.x + elBox.width / 2 - paperBox.x;
  const centerY = elBox.y + elBox.height / 2 - paperBox.y;
  expect(Math.abs(centerX - PAGE_CENTER_MM.x * pxPerMm)).toBeLessThan(
    pxPerMm * 2,
  );
  expect(Math.abs(centerY - PAGE_CENTER_MM.y * pxPerMm)).toBeLessThan(
    pxPerMm * 2,
  );
});

test("click-add and drag placement don't double-fire, each adds exactly one", async ({
  page,
}) => {
  await page.goto("/");
  await paletteButton(page).click();
  await expect(page.locator('.dr-el[data-dr-id="text1"]')).toBeVisible();

  await dragFromPalette(page, /^テキスト/, { x: 150, y: 200 });
  await expect(page.locator('.dr-el[data-dr-id="text2"]')).toBeVisible();
  await expect(page.locator('.dr-el[data-dr-id="text3"]')).toHaveCount(0);
});

test("click-add can be undone as a single commit", async ({ page }) => {
  await page.goto("/");
  await paletteButton(page).click();
  await expect(page.locator('.dr-el[data-dr-id="text1"]')).toBeVisible();

  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.locator('.dr-el[data-dr-id="text1"]')).toHaveCount(0);
});
