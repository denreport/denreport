import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { dragFromPalette } from "./helpers/designer-actions";

// Cell-center px for the default table (col1/col2 each 40mm, header 8mm, row 8mm), computed
// from the table's measured boundingBox so it doesn't depend on snap-position jitter
async function cellCenter(
  page: Page,
  row: number,
  col: number,
): Promise<{ readonly x: number; readonly y: number }> {
  const table = page.locator('.dr-el[data-dr-id="table1"]');
  const tableBox = await table.boundingBox();
  const paper = page.getByRole("application", { name: "キャンバス" });
  const paperBox = await paper.boundingBox();
  if (tableBox === null || paperBox === null) {
    throw new Error("表またはキャンバスが表示されていません");
  }
  const pxPerMm = paperBox.width / 210;
  return {
    x: tableBox.x + (col * 40 + 20) * pxPerMm,
    y: tableBox.y + (8 + row * 8 + 4) * pxPerMm,
  };
}

test("dragging the selected table from the top-edge move band moves it", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^表/, { x: 130, y: 150 });
  const table = page.locator('.dr-el[data-dr-id="table1"]');
  await expect(table).toBeVisible();

  const beforeDrag = await table.boundingBox();
  if (beforeDrag === null) {
    throw new Error("表が表示されていません");
  }
  const startX = beforeDrag.x + beforeDrag.width / 2;
  // The move band spans the table's edge inward by max(4px, 2mm), so start well inside it
  const startY = beforeDrag.y + 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 20, startY + 20, { steps: 4 });
  await page.mouse.up();

  const afterDrag = await table.boundingBox();
  if (afterDrag === null) {
    throw new Error("表が表示されていません");
  }
  expect(Math.abs(afterDrag.x - beforeDrag.x)).toBeGreaterThan(5);
  expect(Math.abs(afterDrag.y - beforeDrag.y)).toBeGreaterThan(5);
  await expect(page.locator(".dr-cell-sel")).toHaveCount(0);
});

test("dragging inside the table selects a cell range without moving the table (regression check)", async ({
  page,
}) => {
  await page.goto("/");
  await dragFromPalette(page, /^表/, { x: 130, y: 150 });
  const table = page.locator('.dr-el[data-dr-id="table1"]');
  await expect(table).toBeVisible();
  const beforeDrag = await table.boundingBox();

  const start = await cellCenter(page, 0, 0);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const end = await cellCenter(page, 1, 0);
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();

  await expect(page.locator(".dr-cell-sel")).toBeVisible();
  const afterDrag = await table.boundingBox();
  expect(afterDrag).toEqual(beforeDrag);
});
