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

/** 上定規から paperBox 内の targetYPx へドラッグし、作成された水平ガイドを返す */
async function dragHorizontalGuideFromRuler(
  page: Page,
  targetYPx: number,
): Promise<Locator> {
  const rulerBox = await page.locator(".apx-ruler-h").boundingBox();
  if (rulerBox === null) {
    throw new Error("上定規が表示されていません");
  }
  const startX = rulerBox.x + rulerBox.width / 2;
  await page.mouse.move(startX, rulerBox.y + rulerBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(startX, targetYPx, { steps: 8 });
  await page.mouse.up();
  return page.locator(".apx-cguide-h");
}

test("上定規からのドラッグで水平ガイドが作成され、離しても消えない", async ({
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
  // 離した後の再描画を経ても存在し続けることを確認する
  await page.mouse.move(paperBox.x + 5, paperBox.y + 5);
  await expect(guide).toBeVisible();
});

test("要素をガイド近傍へドラッグすると、要素の座標がガイド位置へ吸着する", async ({
  page,
}) => {
  await page.goto("/");
  const paperBox = await paper(page).boundingBox();
  if (paperBox === null) {
    throw new Error("キャンバスが表示されていません");
  }
  // ページ中央・端と重ならない位置に作る（紙端・グリッド候補との競合を避ける）
  const guide = await dragHorizontalGuideFromRuler(
    page,
    paperBox.y + paperBox.height / 3,
  );
  const guideMm = await guideYMm(guide);

  // テキスト要素の既定 h=8mm。中心をガイドの 0.2mm 下へ落とし、上端がガイドへ吸着することを見る
  await dragFromPalette(page, /^テキスト/, {
    x: 100,
    y: guideMm + 4.2,
  });

  const props = page.getByRole("complementary", { name: "プロパティ" });
  const yField = props.getByLabel("y", { exact: true });
  await expect(yField).toHaveValue(guideMm.toFixed(1));
});

test("ガイドを定規側へドラッグすると消える", async ({ page }) => {
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

  const hit = guide.locator(".apx-cguide-hit");
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

  await expect(page.locator(".apx-cguide-h")).toHaveCount(0);
});

test("封筒プリセットを選択すると1ページ目文脈で窓枠が表示され、継続ページ文脈では表示されない", async ({
  page,
}) => {
  await page.goto("/");
  const select = page.getByRole("combobox", { name: "封筒窓ガイド" });
  await select.selectOption("l3-w80h45");

  await expect(page.locator(".apx-env-window")).toBeVisible();
  await expect(page.locator(".apx-env-safe")).toBeVisible();

  await page
    .getByRole("group", { name: "ページ文脈" })
    .getByRole("button", { name: "継続ページ" })
    .click();
  await expect(page.locator(".apx-env-window")).toHaveCount(0);
});
