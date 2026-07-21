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

async function zoomToMax(page: Page): Promise<void> {
  const zoomIn = page.getByRole("button", { name: "拡大" });
  while (!(await zoomIn.isDisabled())) {
    await zoomIn.click();
  }
}

test("dragging in move mode pans the view without moving elements; switching back to select mode restores drag-to-move", async ({
  page,
}) => {
  await page.goto("/");
  await paletteButton(page).click();
  const element = page.locator('.dr-el[data-dr-id="text1"]');
  await expect(element).toBeVisible();

  const props = propsPanel(page);
  const xField = props.getByLabel("x", { exact: true });
  const yField = props.getByLabel("y", { exact: true });
  const xBefore = await xField.inputValue();
  const yBefore = await yField.inputValue();

  await zoomToMax(page);
  await page.getByRole("button", { name: "移動" }).click();

  const viewport = page.locator(".dr-viewport");
  await expect(viewport).toHaveClass(/is-pan/);
  const scrollBefore = await viewport.evaluate((el) => ({
    left: el.scrollLeft,
    top: el.scrollTop,
  }));

  const box = await viewport.boundingBox();
  if (box === null) {
    throw new Error("ビューポートが表示されていません");
  }
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await expect(viewport).toHaveClass(/is-panning/);
  // Move up-left since there's plenty of remaining scroll room in every direction
  // (moving down-right could clamp at 0)
  await page.mouse.move(startX - 40, startY - 40, { steps: 8 });
  await page.mouse.up();
  await expect(viewport).not.toHaveClass(/is-panning/);

  const scrollAfter = await viewport.evaluate((el) => ({
    left: el.scrollLeft,
    top: el.scrollTop,
  }));
  expect(scrollAfter.left).toBeGreaterThan(scrollBefore.left);
  expect(scrollAfter.top).toBeGreaterThan(scrollBefore.top);
  await expect(xField).toHaveValue(xBefore);
  await expect(yField).toHaveValue(yBefore);

  await page.getByRole("button", { name: "選択" }).click();
  await expect(viewport).not.toHaveClass(/is-pan/);

  await page.locator('[data-dr-layer-id="text1"] .dr-layer-main').click();
  const elBox = await element.boundingBox();
  if (elBox === null) {
    throw new Error("要素が表示されていません");
  }
  const elCenterX = elBox.x + elBox.width / 2;
  const elCenterY = elBox.y + elBox.height / 2;
  await page.mouse.move(elCenterX, elCenterY);
  await page.mouse.down();
  await page.mouse.move(elCenterX + 40, elCenterY + 40, { steps: 8 });
  await page.mouse.up();

  await expect(xField).not.toHaveValue(xBefore);
});
