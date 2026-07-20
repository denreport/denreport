import { expect, test } from "@playwright/test";
import { dragFromPalette } from "./helpers/designer-actions";

test("text 要素のダブルクリック編集は blur で確定し、Ctrl+Z 1回で戻る", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^テキスト/, { x: 60, y: 40 });
  const textEl = page.locator('.dr-el[data-dr-id="text1"]');
  await expect(textEl).toBeVisible();

  await textEl.dblclick();
  const editor = page.locator(".dr-inline-editor");
  await expect(editor).toBeVisible();
  await expect(editor).toHaveValue("text1");
  await editor.fill("新しい文言");

  // Click the margin (padding outside the paper) to blur → commit. Since this doesn't go
  // through paper's pointer handling, the selection state doesn't change
  await page.locator(".dr-canvas-content").click({ position: { x: 2, y: 2 } });
  await expect(editor).toBeHidden();
  await expect(textEl).toHaveText("新しい文言");
  await expect(
    page
      .getByRole("complementary", { name: "プロパティ" })
      .getByLabel("テキスト", { exact: true }),
  ).toHaveValue("新しい文言");

  // Return focus into the layout (re-clicking an already-selected element doesn't change the selection or the document)
  await textEl.click();
  await page.keyboard.press("Control+z");
  await expect(textEl).toHaveText("text1");
});

test("表の列見出しのダブルクリック編集は Enter で確定する", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^表/, { x: 130, y: 150 });
  const header = page.locator(
    '.dr-el[data-dr-id="table1"] .dr-tbl-th[data-dr-col="0"]',
  );
  await expect(header).toBeVisible();

  await header.dblclick();
  const editor = page.locator(".dr-inline-editor");
  await expect(editor).toBeVisible();
  await expect(editor).toHaveValue("column1");
  await editor.fill("品名");
  await editor.press("Enter");

  await expect(editor).toBeHidden();
  await expect(header).toHaveText("品名");
});

test("Escape で閉じると文書は変わらない", async ({ page }) => {
  await page.goto("/");
  await dragFromPalette(page, /^テキスト/, { x: 60, y: 40 });
  const textEl = page.locator('.dr-el[data-dr-id="text1"]');
  await expect(textEl).toBeVisible();

  await textEl.dblclick();
  const editor = page.locator(".dr-inline-editor");
  await expect(editor).toBeVisible();
  await editor.fill("破棄されるはずの文言");
  await editor.press("Escape");

  await expect(editor).toBeHidden();
  await expect(textEl).toHaveText("text1");
});
