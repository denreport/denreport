import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { commitField, dragFromPalette } from "./helpers/designer-actions";
import { readStoreZip } from "./helpers/zip";

const NOTE_TEXT = "振込手数料はお客様のご負担です";

test("脚注マークを自動採番し、プレビューと ReportLab 書き出しの両方に静的テキストとして反映する", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^テキスト/, { x: 20, y: 20 });
  const text1 = page.locator('.dr-el[data-dr-id="text1"]');
  await expect(text1).toBeVisible();

  const props = page.getByRole("complementary", { name: "プロパティ" });
  const textField = props.getByLabel("テキスト", { exact: true });
  await textField.fill("振込手数料{#fee}をご負担ください");
  await textField.blur();

  // Click an empty area to deselect and move to the document settings panel (footnotes section)
  const paper = page.getByRole("application", { name: "キャンバス" });
  const paperBox = await paper.boundingBox();
  if (paperBox === null) {
    throw new Error("キャンバスが表示されていません");
  }
  await paper.click({
    position: { x: paperBox.width - 10, y: paperBox.height - 10 },
  });

  const useFootnotesButton = props.getByRole("button", { name: "脚注を使う" });
  await expect(useFootnotesButton).toBeVisible();
  await useFootnotesButton.click();
  await props.getByRole("button", { name: "＋ 注記を追加" }).click();
  await commitField(props.getByLabel("id", { exact: true }), "fee");
  const noteBody = props.getByLabel("本文", { exact: true });
  await noteBody.fill(NOTE_TEXT);
  await noteBody.blur();

  await page.getByRole("button", { name: "プレビュー" }).click();
  const preview = page.getByRole("dialog", { name: "プレビュー" });
  await expect(preview).toBeVisible();
  await expect(preview.getByText("振込手数料*1をご負担ください")).toBeVisible();
  await expect(preview.getByText(`*1 ${NOTE_TEXT}`)).toBeVisible();
  await preview.getByRole("button", { name: "閉じる" }).click();
  await expect(preview).toBeHidden();

  await page.getByRole("button", { name: "書き出し" }).click();
  const exportDialog = page.getByRole("dialog", { name: "書き出し" });
  await expect(exportDialog).toBeVisible();
  await exportDialog.getByRole("button", { name: /ReportLab/ }).click();

  const downloadPromise = page.waitForEvent("download");
  await exportDialog.getByRole("button", { name: "書き出す" }).click();
  const download = await downloadPromise;
  const zipPath = await download.path();
  const entries = readStoreZip(readFileSync(zipPath ?? ""));
  const report = entries.find((entry) => entry.name === "report.py");
  if (report === undefined) {
    throw new Error("zip に report.py がありません");
  }
  const code = report.data.toString("utf8");
  // Does not fit within the default 40mm width, wraps character-by-character into 2 lines
  expect(code).toContain('["振込手数料*1をご負担く", "ださい"]');
  expect(code).toContain(`*1 ${NOTE_TEXT}`);
  expect(code).not.toContain("{#fee}");
});
