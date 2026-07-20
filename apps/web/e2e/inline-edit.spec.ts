import { expect, test } from "@playwright/test";
import { dragFromPalette } from "./helpers/designer-actions";

test("text 要素のダブルクリック編集は blur で確定し、Ctrl+Z 1回で戻る", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^テキスト/, { x: 60, y: 40 });
  const textEl = page.locator('.apx-el[data-apx-id="text1"]');
  await expect(textEl).toBeVisible();

  await textEl.dblclick();
  const editor = page.locator(".apx-inline-editor");
  await expect(editor).toBeVisible();
  await expect(editor).toHaveValue("text1");
  await editor.fill("新しい文言");

  // 余白（紙の外側の padding）をクリックして blur → 確定。paper のポインタ処理を
  // 経由しないため選択状態は変わらない
  await page.locator(".apx-canvas-content").click({ position: { x: 2, y: 2 } });
  await expect(editor).toBeHidden();
  await expect(textEl).toHaveText("新しい文言");
  await expect(
    page
      .getByRole("complementary", { name: "プロパティ" })
      .getByLabel("テキスト", { exact: true }),
  ).toHaveValue("新しい文言");

  // レイアウト内へフォーカスを戻す（選択済み要素の再クリックは選択・文書を変えない）
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
    '.apx-el[data-apx-id="table1"] .apx-tbl-th[data-apx-col="0"]',
  );
  await expect(header).toBeVisible();

  await header.dblclick();
  const editor = page.locator(".apx-inline-editor");
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
  const textEl = page.locator('.apx-el[data-apx-id="text1"]');
  await expect(textEl).toBeVisible();

  await textEl.dblclick();
  const editor = page.locator(".apx-inline-editor");
  await expect(editor).toBeVisible();
  await editor.fill("破棄されるはずの文言");
  await editor.press("Escape");

  await expect(editor).toBeHidden();
  await expect(textEl).toHaveText("text1");
});
