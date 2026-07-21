import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await page.goto("/");
});

test("both panels are visible by default even at 960px", async ({ page }) => {
  await expect(
    page.getByRole("navigation", { name: "要素パレット" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "レイヤー" }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "プロパティ" }),
  ).toBeVisible();
});

test("the left/right panel toggles open and close", async ({ page }) => {
  const palette = page.getByRole("navigation", { name: "要素パレット" });
  const properties = page.getByRole("complementary", { name: "プロパティ" });
  const toggleLeft = page.getByRole("button", { name: "左パネルを開閉" });
  const toggleRight = page.getByRole("button", { name: "右パネルを開閉" });

  await toggleLeft.click();
  await expect(palette).toBeHidden();
  await toggleLeft.click();
  await expect(palette).toBeVisible();

  await toggleRight.click();
  await expect(properties).toBeHidden();
  await toggleRight.click();
  await expect(properties).toBeVisible();
});

test("canvas bar controls remain visible and clickable even with both panels closed", async ({
  page,
}) => {
  await page.getByRole("button", { name: "左パネルを開閉" }).click();
  await page.getByRole("button", { name: "右パネルを開閉" }).click();

  const zoomIn = page.getByRole("button", { name: "拡大" });
  await expect(zoomIn).toBeVisible();
  await zoomIn.click();
});

test("the canvas keeps its width when the left panel is closed", async ({
  page,
}) => {
  const canvasArea = page.locator(".dr-canvas-area");
  const before = await canvasArea.boundingBox();
  if (before === null) {
    throw new Error("キャンバスが表示されていません");
  }

  await page.getByRole("button", { name: "左パネルを開閉" }).click();

  const after = await canvasArea.boundingBox();
  if (after === null) {
    throw new Error("キャンバスが表示されていません");
  }
  // Detects a regression where a grid auto-placement offset collapsed the width to 0
  expect(after.width).toBeGreaterThan(0);
  expect(after.width).toBeGreaterThan(before.width);
  await expect(
    page.getByRole("complementary", { name: "プロパティ" }),
  ).toBeVisible();
});

test("the canvas keeps its width when the right panel is closed", async ({
  page,
}) => {
  const canvasArea = page.locator(".dr-canvas-area");
  const before = await canvasArea.boundingBox();
  if (before === null) {
    throw new Error("キャンバスが表示されていません");
  }

  await page.getByRole("button", { name: "右パネルを開閉" }).click();

  const after = await canvasArea.boundingBox();
  if (after === null) {
    throw new Error("キャンバスが表示されていません");
  }
  expect(after.width).toBeGreaterThan(0);
  expect(after.width).toBeGreaterThan(before.width);
  await expect(
    page.getByRole("navigation", { name: "要素パレット" }),
  ).toBeVisible();
});

test("at 960px the top toolbar has no horizontal scroll and the right panel toggle is clickable", async ({
  page,
}) => {
  const overflowing = await page.evaluate(() => {
    const el = document.querySelector(".dr-toolbar");
    return el !== null && el.scrollWidth > el.clientWidth;
  });
  expect(overflowing).toBe(false);

  const toggleRight = page.getByRole("button", { name: "右パネルを開閉" });
  await expect(toggleRight).toBeVisible();
  await toggleRight.click();
  await expect(
    page.getByRole("complementary", { name: "プロパティ" }),
  ).toBeHidden();
});

test("at 960px the canvas bar's envelope window guide select doesn't collapse and keeps its label text", async ({
  page,
}) => {
  const envelopeSelect = page.getByRole("combobox", { name: "封筒窓ガイド" });
  const box = await envelopeSelect.boundingBox();
  if (box === null) {
    throw new Error("封筒窓ガイド select が表示されていません");
  }
  // A collapsed field shrinks to a few px wide and the label disappears entirely, so 60px is a safe lower bound
  expect(box.width).toBeGreaterThan(60);
});

test("the more actions menu opens and closes", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "その他の操作" });
  await trigger.click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem")).toHaveCount(3);

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("the more actions menu closes when the trigger is clicked again (does not reopen)", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "その他の操作" });
  const menu = page.getByRole("menu");

  await trigger.click();
  await expect(menu).toBeVisible();

  await trigger.click();
  await expect(menu).toHaveCount(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("operating the splitter with the keyboard reduces the palette area's height", async ({
  page,
}) => {
  const splitter = page.getByRole("separator", {
    name: "パレットとレイヤーの高さ",
  });
  const palette = page.getByRole("navigation", { name: "要素パレット" });
  const before = await palette.boundingBox();
  if (before === null) {
    throw new Error("パレットが表示されていません");
  }

  await splitter.focus();
  for (let i = 0; i < 10; i += 1) {
    await splitter.press("ArrowUp");
  }

  const after = await palette.boundingBox();
  if (after === null) {
    throw new Error("パレットが表示されていません");
  }
  expect(after.height).toBeLessThan(before.height);
});
