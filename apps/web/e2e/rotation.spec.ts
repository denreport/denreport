import { expect, test } from "@playwright/test";
import { commitField, dragFromPalette } from "./helpers/designer-actions";

interface StoredIr {
  readonly elements: readonly {
    readonly type: string;
    readonly rotate?: number;
  }[];
}

async function storedRectRotate(page: import("@playwright/test").Page) {
  const raw = await page.evaluate(() =>
    localStorage.getItem("denreport-designer.ir"),
  );
  const ir = JSON.parse(raw ?? "{}") as StoredIr;
  return ir.elements.find((el) => el.type === "rect")?.rotate;
}

test("回転ハンドルのドラッグで IR に rotate が入り、キャンバスとプレビューに反映される", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^矩形/, { x: 100, y: 100 });
  const rect = page.locator('.apx-el[data-apx-id="rect1"]');
  await expect(rect).toBeVisible();

  const handle = page.locator('[data-apx-handle="rotate"]');
  await expect(handle).toBeVisible();

  const box = await rect.boundingBox();
  if (box === null) throw new Error("矩形が表示されていません");
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  // 上辺中央のハンドルから中心の真横まで = 時計回りに約 90°（Shift で 15° 刻みの 90° に確定）
  await handle.hover();
  await page.mouse.down();
  await page.keyboard.down("Shift");
  await page.mouse.move(center.x + 60, center.y, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up("Shift");

  await expect(rect).toHaveAttribute("style", /--rot: 90deg/);
  await page.waitForFunction(() => {
    const raw = localStorage.getItem("denreport-designer.ir");
    if (raw === null) return false;
    const parsed = JSON.parse(raw) as {
      readonly elements?: readonly { readonly rotate?: number }[];
    };
    return parsed.elements?.some((el) => el.rotate === 90) ?? false;
  });
  expect(await storedRectRotate(page)).toBe(90);

  await page.getByRole("button", { name: "プレビュー" }).click();
  const preview = page.getByRole("dialog", { name: "プレビュー" });
  await expect(preview).toBeVisible();
  await expect(
    preview.locator(".apx-preview-svg g[transform]"),
  ).toHaveAttribute("transform", /^rotate\(90 /);
});

test("プロパティパネルの角度入力で rotate が設定・解除される", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^矩形/, { x: 100, y: 100 });
  const rect = page.locator('.apx-el[data-apx-id="rect1"]');
  await expect(rect).toBeVisible();

  const props = page.getByRole("complementary", { name: "プロパティ" });
  await commitField(props.getByLabel("回転"), "45.04");

  await expect(rect).toHaveAttribute("style", /--rot: 45deg/);
  await page.waitForFunction(() => {
    const raw = localStorage.getItem("denreport-designer.ir");
    if (raw === null) return false;
    const parsed = JSON.parse(raw) as {
      readonly elements?: readonly { readonly rotate?: number }[];
    };
    return parsed.elements?.some((el) => el.rotate === 45) ?? false;
  });
  expect(await storedRectRotate(page)).toBe(45);

  await page.getByRole("button", { name: "プレビュー" }).click();
  const preview = page.getByRole("dialog", { name: "プレビュー" });
  await expect(preview).toBeVisible();
  await expect(
    preview.locator(".apx-preview-svg g[transform]"),
  ).toHaveAttribute("transform", /^rotate\(45 /);
  await preview.getByRole("button", { name: "閉じる" }).click();
  await expect(preview).toBeHidden();

  // 0 に戻すと属性ごと除去される
  await commitField(props.getByLabel("回転"), "0");
  await page.waitForFunction(() => {
    const raw = localStorage.getItem("denreport-designer.ir");
    if (raw === null) return false;
    const parsed = JSON.parse(raw) as {
      readonly elements?: readonly { readonly rotate?: number }[];
    };
    return parsed.elements?.every((el) => el.rotate === undefined) ?? false;
  });
  expect(await storedRectRotate(page)).toBeUndefined();
});

test("回転した要素では選択枠とハンドルが回転に追従する", async ({ page }) => {
  await page.goto("/");
  await dragFromPalette(page, /^矩形/, { x: 100, y: 100 });
  const rect = page.locator('.apx-el[data-apx-id="rect1"]');
  await expect(rect).toBeVisible();

  const props = page.getByRole("complementary", { name: "プロパティ" });
  await commitField(props.getByLabel("回転"), "90");
  await expect(rect).toHaveAttribute("style", /--rot: 90deg/);

  const selBox = page.locator(".apx-sel-box");
  await expect(selBox).toHaveAttribute("style", /--rot: 90deg/);

  // 回転は要素中心周りのため、AABB の寸法が変わっても中心は不変
  const box = await rect.boundingBox();
  if (box === null) throw new Error("矩形が表示されていません");
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  // 90° 回転で上辺中央のハンドルは要素中心の右側（同じ高さ）に移る
  const nHandle = page.locator('.apx-h[data-apx-handle="n"]');
  const nBox = await nHandle.boundingBox();
  if (nBox === null) throw new Error("n ハンドルが表示されていません");
  const nCenter = { x: nBox.x + nBox.width / 2, y: nBox.y + nBox.height / 2 };
  expect(nCenter.x).toBeGreaterThan(center.x + 5);
  expect(Math.abs(nCenter.y - center.y)).toBeLessThanOrEqual(2);

  // 回転ハンドルは同じ方向にさらに浮いた位置にある
  const rotateHandle = page.locator('[data-apx-handle="rotate"]');
  const rotateBox = await rotateHandle.boundingBox();
  if (rotateBox === null) throw new Error("回転ハンドルが表示されていません");
  const rotateCenter = {
    x: rotateBox.x + rotateBox.width / 2,
    y: rotateBox.y + rotateBox.height / 2,
  };
  expect(rotateCenter.x).toBeGreaterThan(nCenter.x);
  expect(Math.abs(rotateCenter.y - center.y)).toBeLessThanOrEqual(3);

  // 0 に戻すと選択枠から --rot が消える
  await commitField(props.getByLabel("回転"), "0");
  await expect(selBox).not.toHaveAttribute("style", /--rot/);
});
