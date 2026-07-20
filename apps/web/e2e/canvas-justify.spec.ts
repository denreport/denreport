import { expect, type Locator, test } from "@playwright/test";
import { dragFromPalette } from "./helpers/designer-actions";

function letterSpacingPx(locator: Locator): Promise<number> {
  return locator.evaluate(
    (n) => Number.parseFloat(getComputedStyle(n).letterSpacing) || 0,
  );
}

test("text 要素の整列を均等にすると、キャンバスの行に字間が付く", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^テキスト/, { x: 60, y: 40 });
  const textEl = page.locator('.dr-el[data-dr-id="text1"]');
  await expect(textEl).toBeVisible();

  const props = page.getByRole("complementary", { name: "プロパティ" });
  await props
    .getByRole("group", { name: "整列" })
    .getByRole("button", { name: "均等" })
    .click();

  // Absorb the asynchronous arrival of font metrics via expect's polling
  const line = textEl.locator(".dr-text-line").first();
  await expect(line).toBeVisible();
  await expect.poll(() => letterSpacingPx(line)).toBeGreaterThan(0);

  await props
    .getByRole("group", { name: "整列" })
    .getByRole("button", { name: "左" })
    .click();
  await expect.poll(() => letterSpacingPx(line)).toBe(0);
});

test("表の列の整列を均等にすると、明細セルの字間に反映される", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^表/, { x: 130, y: 150 });
  const table = page.locator('.dr-el[data-dr-id="table1"]');
  await expect(table).toBeVisible();

  await page.getByLabel("列1 の整列").selectOption("justify");

  const cell = page.locator(
    '[data-dr-id="table1"] [data-dr-row="0"][data-dr-col="0"]',
  );
  await cell.dblclick();
  const editor = page.locator(".dr-inline-editor");
  await expect(editor).toBeVisible();
  await editor.fill("御中様");
  await editor.press("Enter");
  await expect(editor).toBeHidden();
  await expect(cell).toHaveText("御中様");

  await expect.poll(() => letterSpacingPx(cell)).toBeGreaterThan(0);
});
