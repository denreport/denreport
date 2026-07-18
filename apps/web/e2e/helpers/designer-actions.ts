import type { Locator, Page } from "@playwright/test";

const PAGE_WIDTH_MM = 210;

export async function dragFromPalette(
  page: Page,
  itemName: RegExp,
  mm: { readonly x: number; readonly y: number },
): Promise<void> {
  const paper = page.getByRole("application", { name: "キャンバス" });
  const box = await paper.boundingBox();
  if (box === null) {
    throw new Error("キャンバスが表示されていません");
  }
  const pxPerMm = box.width / PAGE_WIDTH_MM;
  await page
    .getByRole("navigation", { name: "要素パレット" })
    .getByRole("button", { name: itemName })
    .hover();
  await page.mouse.down();
  await page.mouse.move(box.x + mm.x * pxPerMm, box.y + mm.y * pxPerMm, {
    steps: 8,
  });
  await page.mouse.up();
}

export async function commitField(
  field: Locator,
  value: string,
): Promise<void> {
  await field.fill(value);
  await field.press("Enter");
}
