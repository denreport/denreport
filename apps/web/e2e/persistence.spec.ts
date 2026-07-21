import { expect, test } from "@playwright/test";

test("edits are auto-saved and restored after reload", async ({ page }) => {
  await page.goto("/");
  const props = page.getByRole("complementary", { name: "プロパティ" });
  const widthField = props.getByLabel("幅", { exact: true });
  await widthField.fill("200");
  await widthField.press("Enter");

  await page.waitForFunction(() =>
    (localStorage.getItem("denreport-designer.ir") ?? "").includes(
      '"width":200',
    ),
  );
  await page.reload();
  await expect(props.getByLabel("幅", { exact: true })).toHaveValue("200.0");
});

test("a corrupted saved value falls back to blank with a notice, and the saved value is not cleared", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("denreport-designer.ir", "{broken");
  });
  await page.goto("/");

  await expect(page.getByRole("status")).toContainText(
    "保存されていたテンプレートを読み込めませんでした。白紙で開始します。",
  );
  await expect(
    page.getByText("パレットから要素をドラッグして配置"),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("denreport-designer.ir")),
  ).toBe("{broken");
});

test("sample data edits persist after reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "プレビュー" }).click();
  const preview = page.getByRole("dialog", { name: "プレビュー" });
  const sampleField = preview.getByLabel("サンプルデータ (JSON)");
  await sampleField.fill('{"customerName": "テスト株式会社"}');
  await sampleField.blur();

  await page.waitForFunction(() =>
    (localStorage.getItem("denreport-designer.sample-data") ?? "").includes(
      "テスト株式会社",
    ),
  );
  await page.reload();
  await page.getByRole("button", { name: "プレビュー" }).click();
  await expect(preview.getByLabel("サンプルデータ (JSON)")).toHaveValue(
    '{"customerName": "テスト株式会社"}',
  );
});
