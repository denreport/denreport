import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { dragFromPalette } from "./helpers/designer-actions";

function paper(page: Page): Locator {
  return page.getByRole("application", { name: "キャンバス" });
}

async function guideYMm(guide: Locator): Promise<number> {
  const raw = await guide.evaluate((el) =>
    getComputedStyle(el).getPropertyValue("--gy"),
  );
  return Number.parseFloat(raw);
}

/** Drags from the top ruler to targetYPx inside paperBox and returns the created horizontal guide */
async function dragHorizontalGuideFromRuler(
  page: Page,
  targetYPx: number,
): Promise<Locator> {
  const rulerBox = await page.locator(".dr-ruler-h").boundingBox();
  if (rulerBox === null) {
    throw new Error("上定規が表示されていません");
  }
  const startX = rulerBox.x + rulerBox.width / 2;
  await page.mouse.move(startX, rulerBox.y + rulerBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(startX, targetYPx, { steps: 8 });
  await page.mouse.up();
  return page.locator(".dr-cguide-h");
}

test("dragging from the top ruler creates a horizontal guide that persists after release", async ({
  page,
}) => {
  await page.goto("/");
  const paperBox = await paper(page).boundingBox();
  if (paperBox === null) {
    throw new Error("キャンバスが表示されていません");
  }
  const guide = await dragHorizontalGuideFromRuler(
    page,
    paperBox.y + paperBox.height / 3,
  );
  await expect(guide).toBeVisible();
  // Confirm it stays present through a re-render after the release
  await page.mouse.move(paperBox.x + 5, paperBox.y + 5);
  await expect(guide).toBeVisible();
});

test("dragging an element near a guide snaps its coordinates to the guide position", async ({
  page,
}) => {
  await page.goto("/");
  const paperBox = await paper(page).boundingBox();
  if (paperBox === null) {
    throw new Error("キャンバスが表示されていません");
  }
  // Create it at a position that doesn't overlap the page center or edges
  // (to avoid conflicting with paper-edge or grid snap candidates)
  const guide = await dragHorizontalGuideFromRuler(
    page,
    paperBox.y + paperBox.height / 3,
  );
  const guideMm = await guideYMm(guide);

  // The text element's default h=8mm. Drop its center 0.2mm below the guide and check
  // that the top edge snaps to the guide
  await dragFromPalette(page, /^テキスト/, {
    x: 100,
    y: guideMm + 4.2,
  });

  const props = page.getByRole("complementary", { name: "プロパティ" });
  const yField = props.getByLabel("y", { exact: true });
  await expect(yField).toHaveValue(guideMm.toFixed(1));
});

test("dragging a guide back toward the ruler removes it", async ({ page }) => {
  await page.goto("/");
  const paperBox = await paper(page).boundingBox();
  if (paperBox === null) {
    throw new Error("キャンバスが表示されていません");
  }
  const guide = await dragHorizontalGuideFromRuler(
    page,
    paperBox.y + paperBox.height / 2,
  );
  await expect(guide).toBeVisible();

  const hit = guide.locator(".dr-cguide-hit");
  const hitBox = await hit.boundingBox();
  if (hitBox === null) {
    throw new Error("ガイドの掴みハンドルが表示されていません");
  }
  await page.mouse.move(
    hitBox.x + hitBox.width / 2,
    hitBox.y + hitBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(paperBox.x + 20, paperBox.y - 20, { steps: 8 });
  await page.mouse.up();

  await expect(page.locator(".dr-cguide-h")).toHaveCount(0);
});

test("selecting an envelope preset shows the window frame in the first-page context and hides it in the continuation-page context", async ({
  page,
}) => {
  await page.goto("/");
  const select = page.getByRole("combobox", { name: "封筒窓ガイド" });
  await select.selectOption("l3-w80h45");

  await expect(page.locator(".dr-env-window")).toBeVisible();
  await expect(page.locator(".dr-env-safe")).toBeVisible();

  await page
    .getByRole("group", { name: "ページ文脈" })
    .getByRole("button", { name: "継続ページ" })
    .click();
  await expect(page.locator(".dr-env-window")).toHaveCount(0);
});
