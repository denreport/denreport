import { expect, type Page, test } from "@playwright/test";
import { dragFromPalette } from "./helpers/designer-actions";

const PAGE_WIDTH_MM = 210;
const TEXT_PALETTE = /^テキスト/;

interface Mm {
  readonly x: number;
  readonly y: number;
}

async function paperBox(page: Page) {
  const box = await page
    .getByRole("application", { name: "キャンバス" })
    .boundingBox();
  if (box === null) {
    throw new Error("キャンバスが表示されていません");
  }
  return box;
}

async function toPx(page: Page, mm: Mm): Promise<Mm> {
  const box = await paperBox(page);
  const pxPerMm = box.width / PAGE_WIDTH_MM;
  return { x: box.x + mm.x * pxPerMm, y: box.y + mm.y * pxPerMm };
}

async function clickBackground(page: Page): Promise<void> {
  const box = await paperBox(page);
  await page
    .getByRole("application", { name: "キャンバス" })
    .click({ position: { x: box.width - 10, y: box.height - 10 } });
}

async function dragOnCanvas(page: Page, from: Mm, to: Mm): Promise<void> {
  const start = await toPx(page, from);
  const end = await toPx(page, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

/** Returns the element's current rendered center in mm coordinates */
async function elementCenterMm(page: Page, id: string): Promise<Mm> {
  const el = await page.locator(`.dr-el[data-dr-id="${id}"]`).boundingBox();
  if (el === null) {
    throw new Error(`${id} が表示されていません`);
  }
  const box = await paperBox(page);
  const pxPerMm = box.width / PAGE_WIDTH_MM;
  return {
    x: (el.x + el.width / 2 - box.x) / pxPerMm,
    y: (el.y + el.height / 2 - box.y) / pxPerMm,
  };
}

interface IrElementXY {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/** Autosave is debounced 500ms, so wait until the id is written before reading */
async function waitForElementXY(page: Page, id: string): Promise<IrElementXY> {
  await page.waitForFunction((id) => {
    const raw = localStorage.getItem("denreport-designer.ir");
    if (raw === null) {
      return false;
    }
    try {
      const parsed = JSON.parse(raw) as { elements: { id: string }[] };
      return parsed.elements.some((e) => e.id === id);
    } catch {
      return false;
    }
  }, id);
  const ir = await page.evaluate(() =>
    localStorage.getItem("denreport-designer.ir"),
  );
  const parsed = JSON.parse(ir ?? "{}") as {
    readonly elements: readonly IrElementXY[];
  };
  const el = parsed.elements.find((e) => e.id === id);
  if (el === undefined) {
    throw new Error(`${id} が IR に見つかりません`);
  }
  return el;
}

async function waitForXChange(
  page: Page,
  id: string,
  before: number,
): Promise<void> {
  await page.waitForFunction(
    ({ id, before }) => {
      const raw = localStorage.getItem("denreport-designer.ir");
      if (raw === null) {
        return false;
      }
      try {
        const parsed = JSON.parse(raw) as {
          readonly elements: readonly {
            readonly id: string;
            readonly x: number;
          }[];
        };
        const el = parsed.elements.find((e) => e.id === id);
        return el !== undefined && el.x !== before;
      } catch {
        return false;
      }
    },
    { id, before },
  );
}

test("element grouping: click select, move, duplicate, ungroup", async ({
  page,
}) => {
  await page.goto("/");
  const props = page.getByRole("complementary", { name: "プロパティ" });

  await dragFromPalette(page, TEXT_PALETTE, { x: 60, y: 60 });
  await expect(page.locator('.dr-el[data-dr-id="text1"]')).toBeVisible();
  await dragFromPalette(page, TEXT_PALETTE, { x: 120, y: 60 });
  await expect(page.locator('.dr-el[data-dr-id="text2"]')).toBeVisible();

  await page
    .locator('.dr-el[data-dr-id="text1"]')
    .click({ modifiers: ["Shift"] });
  await expect(props.locator(".dr-props-id")).toHaveText("2 個の要素を選択中");

  await page.keyboard.press("ControlOrMeta+g");

  await clickBackground(page);
  await page.locator('.dr-el[data-dr-id="text1"]').click();
  await expect(props.locator(".dr-props-id")).toHaveText("2 個の要素を選択中");

  const before1 = await waitForElementXY(page, "text1");
  const before2 = await waitForElementXY(page, "text2");
  const dragStart = await elementCenterMm(page, "text1");
  await dragOnCanvas(page, dragStart, {
    x: dragStart.x + 20,
    y: dragStart.y + 10,
  });
  await waitForXChange(page, "text1", before1.x);
  const after1 = await waitForElementXY(page, "text1");
  const after2 = await waitForElementXY(page, "text2");
  expect(after1.x - before1.x).toBeCloseTo(after2.x - before2.x, 1);
  expect(after1.y - before1.y).toBeCloseTo(after2.y - before2.y, 1);

  await page.keyboard.press("ControlOrMeta+d");
  await expect(page.locator('.dr-el[data-dr-id="text3"]')).toBeVisible();
  await expect(page.locator('.dr-el[data-dr-id="text4"]')).toBeVisible();
  await expect(props.locator(".dr-props-id")).toHaveText("2 個の要素を選択中");

  await clickBackground(page);
  await page.locator('.dr-el[data-dr-id="text3"]').click();
  await expect(props.locator(".dr-props-id")).toHaveText("2 個の要素を選択中");

  await page.keyboard.press("ControlOrMeta+Shift+g");
  await clickBackground(page);
  await page.locator('.dr-el[data-dr-id="text3"]').click();
  await expect(props.locator(".dr-props-id")).toHaveText("text3");
});

test("element grouping: group is preserved across save and reload", async ({
  page,
}) => {
  await page.goto("/");
  const props = page.getByRole("complementary", { name: "プロパティ" });

  await dragFromPalette(page, TEXT_PALETTE, { x: 60, y: 60 });
  await expect(page.locator('.dr-el[data-dr-id="text1"]')).toBeVisible();
  await dragFromPalette(page, TEXT_PALETTE, { x: 120, y: 60 });
  await expect(page.locator('.dr-el[data-dr-id="text2"]')).toBeVisible();

  // Let the autosave debounce for the element placement finish first. If it hasn't finished,
  // the subsequent timer firing lazily evaluates saveIr(), which would mask a missed
  // notification for the grouping itself
  await waitForElementXY(page, "text2");
  expect(
    await page.evaluate(() =>
      (localStorage.getItem("denreport-designer.ir") ?? "").includes(
        '"groups"',
      ),
    ),
  ).toBe(false);

  await page
    .locator('.dr-el[data-dr-id="text1"]')
    .click({ modifiers: ["Shift"] });
  await page.keyboard.press("ControlOrMeta+g");

  await page.waitForFunction(() =>
    (localStorage.getItem("denreport-designer.ir") ?? "").includes('"groups"'),
  );

  await page.reload();

  await clickBackground(page);
  await page.locator('.dr-el[data-dr-id="text1"]').click();
  await expect(props.locator(".dr-props-id")).toHaveText("2 個の要素を選択中");
});
