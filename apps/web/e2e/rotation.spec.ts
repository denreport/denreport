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
  const rect = page.locator('.dr-el[data-dr-id="rect1"]');
  await expect(rect).toBeVisible();

  const handle = page.locator('[data-dr-handle="rotate"]');
  await expect(handle).toBeVisible();

  const box = await rect.boundingBox();
  if (box === null) throw new Error("矩形が表示されていません");
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  // From the top-center handle to directly beside the center = about 90° clockwise
  // (Shift snaps it to 90° in 15° increments)
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
  await expect(preview.locator(".dr-preview-svg g[transform]")).toHaveAttribute(
    "transform",
    /^rotate\(90 /,
  );
});

test("プロパティパネルの角度入力で rotate が設定・解除される", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^矩形/, { x: 100, y: 100 });
  const rect = page.locator('.dr-el[data-dr-id="rect1"]');
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
  await expect(preview.locator(".dr-preview-svg g[transform]")).toHaveAttribute(
    "transform",
    /^rotate\(45 /,
  );
  await preview.getByRole("button", { name: "閉じる" }).click();
  await expect(preview).toBeHidden();

  // Resetting to 0 removes the attribute entirely
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
  const rect = page.locator('.dr-el[data-dr-id="rect1"]');
  await expect(rect).toBeVisible();

  const props = page.getByRole("complementary", { name: "プロパティ" });
  await commitField(props.getByLabel("回転"), "90");
  await expect(rect).toHaveAttribute("style", /--rot: 90deg/);

  const selBox = page.locator(".dr-sel-box");
  await expect(selBox).toHaveAttribute("style", /--rot: 90deg/);

  // Rotation is around the element center, so the center stays fixed even when the AABB dimensions change
  const box = await rect.boundingBox();
  if (box === null) throw new Error("矩形が表示されていません");
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  // With a 90° rotation, the top-center handle moves to the right of the element center (same height)
  const nHandle = page.locator('.dr-h[data-dr-handle="n"]');
  const nBox = await nHandle.boundingBox();
  if (nBox === null) throw new Error("n ハンドルが表示されていません");
  const nCenter = { x: nBox.x + nBox.width / 2, y: nBox.y + nBox.height / 2 };
  expect(nCenter.x).toBeGreaterThan(center.x + 5);
  expect(Math.abs(nCenter.y - center.y)).toBeLessThanOrEqual(2);

  // The rotate handle sits further out in the same direction
  const rotateHandle = page.locator('[data-dr-handle="rotate"]');
  const rotateBox = await rotateHandle.boundingBox();
  if (rotateBox === null) throw new Error("回転ハンドルが表示されていません");
  const rotateCenter = {
    x: rotateBox.x + rotateBox.width / 2,
    y: rotateBox.y + rotateBox.height / 2,
  };
  expect(rotateCenter.x).toBeGreaterThan(nCenter.x);
  expect(Math.abs(rotateCenter.y - center.y)).toBeLessThanOrEqual(3);

  // Resetting to 0 removes --rot from the selection box
  await commitField(props.getByLabel("回転"), "0");
  await expect(selBox).not.toHaveAttribute("style", /--rot/);
});

test("回転した要素をリサイズ中、ドラッグゴーストが回転角に追従する", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^矩形/, { x: 100, y: 100 });
  const rect = page.locator('.dr-el[data-dr-id="rect1"]');
  await expect(rect).toBeVisible();

  const props = page.getByRole("complementary", { name: "プロパティ" });
  await commitField(props.getByLabel("回転"), "90");
  await expect(rect).toHaveAttribute("style", /--rot: 90deg/);

  const seHandle = page.locator(
    '.dr-h[data-dr-handle="se"][data-dr-id="rect1"]',
  );
  await expect(seHandle).toBeVisible();
  const handleBox = await seHandle.boundingBox();
  if (handleBox === null) throw new Error("se ハンドルが表示されていません");

  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 40, handleBox.y + 40, { steps: 8 });

  const ghost = page.locator(".dr-drag-ghost");
  await expect(ghost).toHaveClass(/dr-drag-ghost--rotated/);
  await expect(ghost).toHaveAttribute("style", /--rot: 90deg/);

  await page.mouse.up();
});

test("90° 回転した矩形のリサイズがドラッグ方向に追従し、反対側の辺が動かない", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^矩形/, { x: 100, y: 100 });
  const rect = page.locator('.dr-el[data-dr-id="rect1"]');
  await expect(rect).toBeVisible();

  const props = page.getByRole("complementary", { name: "プロパティ" });
  await commitField(props.getByLabel("回転"), "90");
  await expect(rect).toHaveAttribute("style", /--rot: 90deg/);
  // Grid snapping is based on the unrotated model box (out of scope here), so verify the drag amount itself instead
  await page.getByRole("button", { name: "スナップ" }).click();

  const before = await rect.boundingBox();
  if (before === null) throw new Error("矩形が表示されていません");

  // Due to the 90° rotation, the actual handle is "e" but it visually sits at the bottom-center
  const eHandle = page.locator('.dr-h[data-dr-handle="e"][data-dr-id="rect1"]');
  const handleBox = await eHandle.boundingBox();
  if (handleBox === null) throw new Error("e ハンドルが表示されていません");

  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2 + 40,
    { steps: 8 },
  );
  await page.mouse.up();

  const after = await rect.boundingBox();
  if (after === null) throw new Error("矩形が表示されていません");

  // The height grows by exactly the visually-downward drag distance, and the other edges (anchors) stay fixed
  expect(after.height - before.height).toBeGreaterThan(37);
  expect(after.height - before.height).toBeLessThan(43);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(2);

  await page.waitForFunction(() => {
    const raw = localStorage.getItem("denreport-designer.ir");
    if (raw === null) return false;
    const parsed = JSON.parse(raw) as {
      readonly elements?: readonly {
        readonly type: string;
        readonly w?: number;
        readonly h?: number;
      }[];
    };
    const rectEl = parsed.elements?.find((el) => el.type === "rect");
    return rectEl !== undefined && rectEl.h === 20 && (rectEl.w ?? 0) > 40;
  });
});
