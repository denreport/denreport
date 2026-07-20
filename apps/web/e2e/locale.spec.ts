import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

async function switchToEnglish(page: Page): Promise<void> {
  await page.getByRole("button", { name: "言語" }).click();
  await expect(page).toHaveTitle("Report Designer");
}

function propertiesPanel(page: Page) {
  return page.getByRole("complementary", { name: "Properties" });
}

async function addTextElement(page: Page): Promise<void> {
  await page
    .getByRole("navigation", { name: "Element palette" })
    .getByRole("button", { name: "Text" })
    .click();
  await expect(page.locator('.dr-el[data-dr-id="text1"]')).toBeVisible();
}

test("言語切替はリロード後も保持され、title・lang・UI 文言が追随する", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("帳票デザイナー");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("ja");

  await switchToEnglish(page);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();

  await page.reload();
  await expect(page).toHaveTitle("Report Designer");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
});

test("en から ja へ戻すと日本語表示に復帰し、それもリロード後に保持される", async ({
  page,
}) => {
  await page.goto("/");
  await switchToEnglish(page);
  await expect(
    page.getByRole("navigation", { name: "Element palette" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Language" }).click();
  await expect(page).toHaveTitle("帳票デザイナー");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("ja");
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "要素パレット" }),
  ).toBeVisible();

  await page.reload();
  await expect(page).toHaveTitle("帳票デザイナー");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("ja");
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeVisible();
});

test("en ではプロパティパネルの要素型名・見出し・欄ラベルが英語になる", async ({
  page,
}) => {
  await page.goto("/");
  await switchToEnglish(page);
  await addTextElement(page);

  const props = propertiesPanel(page);
  await expect(props.locator(".dr-type-badge")).toHaveText("Text");
  await expect(props.locator(".dr-sect-h")).toHaveText([
    "Content",
    "Placement",
    "Text",
  ]);
  await expect(props.getByLabel("Name", { exact: true })).toBeVisible();
  await expect(props.getByLabel("x", { exact: true })).toBeVisible();
  await expect(props.getByLabel("Font size", { exact: true })).toBeVisible();
  await expect(props.getByLabel("Line height", { exact: true })).toBeVisible();
  await expect(props.getByLabel("Text color", { exact: true })).toBeVisible();
  await expect(props.getByRole("button", { name: "Bold" })).toBeVisible();
});

test("en では書き出しダイアログの見出し・ボタン・説明文が英語になる", async ({
  page,
}) => {
  await page.goto("/");
  await switchToEnglish(page);

  await page.getByRole("button", { name: "Export" }).click();
  const dialog = page.getByRole("dialog", { name: "Export" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText("Warnings don't block export. Validation errors do."),
  ).toBeVisible();
  await expect(dialog.getByText("Template + inputs (JSON)")).toBeVisible();
  await expect(
    dialog.getByText("Generated code (.py + fonts, zip)"),
  ).toBeVisible();
  await expect(
    dialog.getByRole("checkbox", {
      name: "Embed the whole font (no subsetting)",
    }),
  ).toBeVisible();
  await expect(dialog.getByText("Compatibility warnings")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Export" })).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeVisible();
});

test("en ではプレビューダイアログの見出し・ボタン・説明文が英語になる", async ({
  page,
}) => {
  await page.goto("/");
  await switchToEnglish(page);

  await page.getByRole("button", { name: "Preview" }).click();
  const dialog = page.getByRole("dialog", { name: "Preview" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("1 page", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("combobox", { name: "Sample data scenario" }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Sample data (JSON)")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Generate from bind keys" }),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeVisible();
});

test("en では検証ペインの core 由来メッセージが英語になる", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "要素パレット" })
    .getByRole("button", { name: /^テキスト/ })
    .click();
  const xField = page
    .getByRole("complementary", { name: "プロパティ" })
    .getByLabel("x", { exact: true });
  await xField.fill("300");
  await xField.press("Enter");

  await page.locator(".dr-drawer-bar").click();
  const row = page.locator(".dr-verr").first();
  await expect(row).toContainText("M02");
  await expect(row).toContainText("要素が用紙の右端を超えています");

  await switchToEnglish(page);
  await expect(row).toContainText(
    "The element extends past the page's right edge",
  );
});

test("en では記載事項チェックの警告が英語になる", async ({ page }) => {
  await page.goto("/");
  await switchToEnglish(page);
  await propertiesPanel(page).getByLabel("Enable").check();

  await page.locator(".dr-drawer-bar").click();
  await expect(page.locator(".dr-verr")).toHaveCount(6);
  await expect(
    page.locator(".dr-verr", { hasText: "Issuer's registration number" }),
  ).toHaveCount(1);
});

test("en では互換警告の userMessage が英語になる", async ({ page }) => {
  await page.goto("/");
  await switchToEnglish(page);
  await addTextElement(page);

  await page.locator(".dr-drawer-bar").click();
  const card = page.locator(".dr-drawer-compat .dr-warn-card");
  await expect(card).toHaveCount(1);
  await expect(card.locator(".dr-warn-level")).toHaveText("Approximated");
  await expect(card).toContainText(
    "Text wrapping and alignment are the same regardless of the export target.",
  );
  await expect(card.locator(".dr-warn-count")).toHaveText("1 location");
});

test("en では復元失敗のホスト通知が英語になる", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("denreport-designer.locale", "en");
    localStorage.setItem("denreport-designer.ir", "{broken");
  });
  await page.goto("/");

  await expect(page.getByRole("status")).toContainText(
    "Could not load the saved template. Starting with a blank document.",
  );
  await expect(
    page.getByRole("status").getByRole("button", { name: "Close" }),
  ).toBeVisible();
  await expect(
    page.getByText("Drag an element from the palette to place it"),
  ).toBeVisible();
});
