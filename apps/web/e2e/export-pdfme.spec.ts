import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const IR_FIXTURE = readFileSync(
  fileURLToPath(new URL("./fixtures/invoice-ir.json", import.meta.url)),
  "utf8",
);

const SAMPLE_DATA = JSON.stringify({
  title: "請求書",
  issuerAddr: "東京都千代田区1-1-1",
  items: [
    { name: "商品A", amount: "10,000" },
    { name: "商品B", amount: "20,000" },
  ],
});

test("fixture IR を localStorage から復元し pdfme JSON を書き出す", async ({
  page,
}) => {
  await page.addInitScript(
    ([ir, sample]) => {
      localStorage.setItem("denreport-designer.ir", ir ?? "");
      localStorage.setItem("denreport-designer.sample-data", sample ?? "");
    },
    [IR_FIXTURE, SAMPLE_DATA],
  );
  await page.goto("/");
  await expect(page.locator('.apx-el[data-apx-id="title"]')).toBeVisible();

  await page.getByRole("button", { name: "書き出し" }).click();
  const exportDialog = page.getByRole("dialog", { name: "書き出し" });
  await expect(exportDialog).toBeVisible();
  await expect(
    exportDialog.getByRole("button", { name: /^pdfme/ }),
  ).toHaveAttribute("aria-pressed", "true");

  const downloadPromise = page.waitForEvent("download");
  await exportDialog.getByRole("button", { name: "書き出す" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("report-pdfme.json");

  const path = await download.path();
  const artifact = JSON.parse(readFileSync(path, "utf8")) as {
    readonly template?: { readonly schemas?: readonly unknown[][] };
    readonly inputs?: readonly Record<string, unknown>[];
  };
  expect(Object.keys(artifact).sort()).toEqual(["inputs", "template"]);

  // 明細2行 + minRows 3 は1ページに収まる
  const schemas = artifact.template?.schemas;
  expect(schemas).toHaveLength(1);
  expect(schemas?.[0]?.length).toBeGreaterThan(0);

  expect(artifact.inputs).toHaveLength(1);
  const inputs = artifact.inputs?.[0] ?? {};
  const titleKey = Object.keys(inputs).find((key) => key.includes("title"));
  expect(titleKey).toBeDefined();
  expect(inputs[titleKey ?? ""]).toBe("請求書");
});

test("フォント全体埋め込みをオンにすると font ブロック付きの pdfme JSON を書き出す", async ({
  page,
}) => {
  await page.addInitScript(
    ([ir, sample]) => {
      localStorage.setItem("denreport-designer.ir", ir ?? "");
      localStorage.setItem("denreport-designer.sample-data", sample ?? "");
    },
    [IR_FIXTURE, SAMPLE_DATA],
  );
  await page.goto("/");
  await expect(page.locator('.apx-el[data-apx-id="title"]')).toBeVisible();

  await page.getByRole("button", { name: "書き出し" }).click();
  const exportDialog = page.getByRole("dialog", { name: "書き出し" });
  await expect(exportDialog).toBeVisible();

  await exportDialog
    .getByRole("checkbox", {
      name: "フォントをまるごと埋め込む（サブセット化しない）",
    })
    .check();

  const downloadPromise = page.waitForEvent("download");
  await exportDialog.getByRole("button", { name: "書き出す" }).click();
  const download = await downloadPromise;

  const path = await download.path();
  const artifact = JSON.parse(readFileSync(path, "utf8")) as {
    readonly font?: { readonly name?: string; readonly subset?: boolean };
  };
  expect(Object.keys(artifact).sort()).toEqual(["font", "inputs", "template"]);
  expect(artifact.font?.subset).toBe(false);
});
