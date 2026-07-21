import { expect, test } from "@playwright/test";

test.describe("selecting from local PC fonts (permission granted)", () => {
  test.use({ permissions: ["local-fonts"] });

  test("works end-to-end from listing through selection to preview", async ({
    page,
  }) => {
    await page.goto("/");
    const props = page.getByRole("complementary", { name: "プロパティ" });
    await props.getByRole("button", { name: "標準のフォントを選択…" }).click();

    const dialog = page.getByRole("dialog", { name: "標準のフォントを選択" });
    await expect(dialog).toBeVisible();

    // fonts-liberation is installed on both CI (playwright install --with-deps) and the dev
    // container, and being a TrueType (glyf) outline it always passes validateFont
    await dialog.getByLabel("フォント名で検索").fill("Liberation");
    const candidate = dialog.locator(".dr-font-name").first();
    await expect(candidate).toBeVisible();
    const displayName = await candidate.innerText();

    await candidate.click();
    await dialog.getByRole("button", { name: "このフォントを使う" }).click();
    await expect(dialog).toBeHidden();

    await expect(props.getByText(`実データ: ${displayName}`)).toBeVisible();
    const registeredName = await props.getByLabel("フォント名").inputValue();
    expect(registeredName).toMatch(/^[A-Za-z_][A-Za-z0-9_]*$/);
    expect(registeredName).not.toBe("NotoSansJP");

    await page.getByRole("button", { name: "プレビュー" }).click();
    const preview = page.getByRole("dialog", { name: "プレビュー" });
    await expect(preview).toBeVisible();
    await expect(preview.locator(".dr-preview-warnings")).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(
          (family) => document.fonts.check(`13px ${family}`),
          `dr-local-${registeredName}`,
        ),
      )
      .toBe(true);
  });
});

test.describe("environment without local font selection support", () => {
  test("shows fallback explanatory text instead of the selection button", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const win = window as unknown as { queryLocalFonts?: unknown };
      delete win.queryLocalFonts;
    });
    await page.goto("/");

    const props = page.getByRole("complementary", { name: "プロパティ" });
    await expect(
      props.getByRole("button", { name: /のフォントを選択…$/ }),
    ).toHaveCount(0);
    await expect(
      props.getByText(/PC 内フォントの一覧取得に対応していません/),
    ).toBeVisible();
    await expect(props.getByLabel("フォント名")).toHaveValue("NotoSansJP");
  });
});
