import { expect, test } from "@playwright/test";
import { commitField, dragFromPalette } from "./helpers/designer-actions";

test("楕円をパレットから配置し、塗り色と枠線色がキャンバスとプレビューに反映される", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^楕円/, { x: 100, y: 100 });
  const ellipse = page.locator('.apx-el[data-apx-id="ellipse1"]');
  await expect(ellipse).toBeVisible();

  const props = page.getByRole("complementary", { name: "プロパティ" });
  await props.getByLabel("なし").uncheck();
  await props.getByLabel("塗り色").fill("#eeeeee");
  await props.getByLabel("枠線色").fill("#112233");

  await expect(ellipse).toHaveCSS("background-color", "rgb(238, 238, 238)");
  await expect(ellipse).toHaveCSS("border-color", "rgb(17, 34, 51)");

  await page.getByRole("button", { name: "プレビュー" }).click();
  const preview = page.getByRole("dialog", { name: "プレビュー" });
  await expect(preview).toBeVisible();
  const ellipseSvg = preview.locator(".apx-preview-svg ellipse");
  await expect(ellipseSvg).toHaveAttribute("fill", "#eeeeee");
  await expect(ellipseSvg).toHaveAttribute("stroke", "#112233");
});

test("矩形の角丸・破線・塗りがプレビューの SVG 属性と IR の両方に反映される", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^矩形/, { x: 100, y: 100 });
  const rect = page.locator('.apx-el[data-apx-id="rect1"]');
  await expect(rect).toBeVisible();

  const props = page.getByRole("complementary", { name: "プロパティ" });
  await props.getByLabel("なし").uncheck();
  await props.getByLabel("塗り色").fill("#eeeeee");
  await commitField(props.getByLabel("角丸半径"), "3");

  await page.getByRole("button", { name: "プレビュー" }).click();
  const preview = page.getByRole("dialog", { name: "プレビュー" });
  await expect(preview).toBeVisible();
  const rectSvg = preview.locator(".apx-preview-svg rect");
  await expect(rectSvg).toHaveAttribute("rx", "3");
  await expect(rectSvg).toHaveAttribute("fill", "#eeeeee");
  await preview.getByRole("button", { name: "閉じる" }).click();
  await expect(preview).toBeHidden();

  // Combining rounded corners with a non-solid line style is forbidden (M17),
  // so reset the corner radius before switching the line style
  await commitField(props.getByLabel("角丸半径"), "0");
  await props.getByLabel("線種").selectOption("dashed");

  await page.getByRole("button", { name: "プレビュー" }).click();
  await expect(preview).toBeVisible();
  await expect(rectSvg).toHaveAttribute("stroke-dasharray", "2 1");
  await expect(rectSvg).not.toHaveAttribute("rx", "3");
  await preview.getByRole("button", { name: "閉じる" }).click();
  await expect(preview).toBeHidden();

  await page.waitForFunction(() => {
    const raw = localStorage.getItem("denreport-designer.ir");
    if (raw === null) return false;
    const parsed = JSON.parse(raw) as {
      readonly elements?: readonly { readonly borderStyle?: string }[];
    };
    return parsed.elements?.some((el) => el.borderStyle === "dashed") ?? false;
  });
  const storedIr = await page.evaluate(() =>
    localStorage.getItem("denreport-designer.ir"),
  );
  const ir = JSON.parse(storedIr ?? "{}") as {
    readonly elements: readonly {
      readonly type: string;
      readonly cornerRadius?: number;
      readonly fillColor?: string;
      readonly borderStyle?: string;
    }[];
  };
  const rectEl = ir.elements.find((el) => el.type === "rect");
  expect(rectEl?.cornerRadius).toBeUndefined();
  expect(rectEl?.fillColor).toBe("#eeeeee");
  expect(rectEl?.borderStyle).toBe("dashed");
});

test("表の網掛けトグルがキャンバスの縞とプレビューの塗り矩形に反映され、Ctrl+Z で戻る", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^表/, { x: 100, y: 100 });
  const table = page.locator('.apx-el[data-apx-id="table1"]');
  await expect(table).toBeVisible();

  const props = page.getByRole("complementary", { name: "プロパティ" });
  const stripeToggle = props.getByLabel("1行おきに背景色を付ける");
  await stripeToggle.check();
  await expect(
    page.locator('[data-apx-id="table1"] .apx-tbl-stripe').first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "プレビュー" }).click();
  const preview = page.getByRole("dialog", { name: "プレビュー" });
  await expect(preview).toBeVisible();
  await expect(
    preview.locator(".apx-preview-svg rect[fill='#f0f0f0']").first(),
  ).toBeVisible();
  await preview.getByRole("button", { name: "閉じる" }).click();
  await expect(preview).toBeHidden();

  await table.click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(
    page.locator('[data-apx-id="table1"] .apx-tbl-stripe'),
  ).toHaveCount(0);
});

test("表の内部罫線が外枠の内側にぴったり収まる", async ({ page }) => {
  await page.goto("/");
  await dragFromPalette(page, /^表/, { x: 100, y: 100 });
  const table = page.locator('.apx-el[data-apx-id="table1"]');
  await expect(table).toBeVisible();
  const hline = table.locator(".apx-tbl-hline").first();
  await expect(hline).toBeVisible();
  const tableBox = await table.boundingBox();
  const hlineBox = await hline.boundingBox();
  if (tableBox === null || hlineBox === null)
    throw new Error("boundingBox がない");
  expect(Math.abs(hlineBox.x - tableBox.x)).toBeLessThan(0.5);
  expect(
    Math.abs(hlineBox.x + hlineBox.width - (tableBox.x + tableBox.width)),
  ).toBeLessThan(0.5);
});

test("表の罫線の太さ・線種がキャンバスに反映される", async ({ page }) => {
  await page.goto("/");
  await dragFromPalette(page, /^表/, { x: 100, y: 100 });
  const table = page.locator('.apx-el[data-apx-id="table1"]');
  await expect(table).toBeVisible();

  const props = page.getByRole("complementary", { name: "プロパティ" });
  await commitField(props.getByLabel("外枠の太さ"), "1");
  await props.getByLabel("外枠の線種").selectOption("dashed");
  await commitField(props.getByLabel("内部罫線の太さ"), "0.5");
  await props.getByLabel("内部罫線の線種").selectOption("dotted");

  await expect(table).toHaveCSS("--frame-w", "1");
  await expect(table).toHaveCSS("--grid-w", "0.5");
  await expect(table.locator(".apx-tbl-frame")).toHaveCSS(
    "border-top-style",
    "dashed",
  );
  await expect(table.locator(".apx-tbl-hline").first()).toHaveCSS(
    "border-top-style",
    "dotted",
  );
  await expect(table.locator(".apx-tbl-vline").first()).toHaveCSS(
    "border-left-style",
    "dotted",
  );
});
