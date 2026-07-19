import { expect, test } from "@playwright/test";

test("言語切替はリロード後も保持され、title・lang・UI 文言が追随する", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("帳票デザイナー");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("ja");

  await page.getByRole("button", { name: "言語" }).click();
  await expect(page).toHaveTitle("Report Designer");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();

  await page.reload();
  await expect(page).toHaveTitle("Report Designer");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
});
