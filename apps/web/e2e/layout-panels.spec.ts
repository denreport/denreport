import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await page.goto("/");
});

test("960px でも既定では両パネルが可視である", async ({ page }) => {
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

test("左右パネルのトグルで開閉できる", async ({ page }) => {
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

test("両パネルを閉じてもキャンバスバーの操作は可視かつクリック可能", async ({
  page,
}) => {
  await page.getByRole("button", { name: "左パネルを開閉" }).click();
  await page.getByRole("button", { name: "右パネルを開閉" }).click();

  const zoomIn = page.getByRole("button", { name: "拡大" });
  await expect(zoomIn).toBeVisible();
  await zoomIn.click();
});

test("左パネルを閉じてもキャンバスは幅を保って表示される", async ({ page }) => {
  const canvasArea = page.locator(".apx-canvas-area");
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

test("右パネルを閉じてもキャンバスは幅を保って表示される", async ({ page }) => {
  const canvasArea = page.locator(".apx-canvas-area");
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

test("スプリッターをキーボードで操作するとパレット領域の高さが減る", async ({
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
