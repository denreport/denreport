import { expect, type Page, test } from "@playwright/test";
import { commitField, dragFromPalette } from "./helpers/designer-actions";

const PAGE_WIDTH_MM = 210;

const TEXT_PALETTE = /^テキスト/;
const FLEX_PALETTE = /^フレックス/;

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

/** Returns the element's current rendered center in mm coordinates. Used to track its actual position after resize/reorder */
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

async function clickCanvas(page: Page, mm: Mm): Promise<void> {
  const at = await toPx(page, mm);
  await page.mouse.click(at.x, at.y);
}

async function dragOnCanvas(page: Page, from: Mm, to: Mm): Promise<void> {
  const start = await toPx(page, from);
  const end = await toPx(page, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

test("flex 編集: 段階的選択・既存要素の出し入れ・子のリサイズ", async ({
  page,
}) => {
  await page.goto("/");
  const props = page.getByRole("complementary", { name: "プロパティ" });

  await test.step("配置: flex（子 text1 つき）と、別のトップレベル text2", async () => {
    await dragFromPalette(page, FLEX_PALETTE, { x: 60, y: 60 });
    await expect(page.locator('.dr-el[data-dr-id="flex1"]')).toBeVisible();
    await commitField(props.getByLabel("x", { exact: true }), "60");
    await commitField(props.getByLabel("y", { exact: true }), "60");

    await dragFromPalette(page, TEXT_PALETTE, { x: 150, y: 150 });
    await expect(page.locator('.dr-el[data-dr-id="text2"]')).toBeVisible();
    await commitField(props.getByLabel("x", { exact: true }), "150");
    await commitField(props.getByLabel("y", { exact: true }), "150");
  });

  await test.step("段階的選択: 同じ矩形への1クリック目で flex、2クリック目で子", async () => {
    // flex1 has only one child, text1, and no gap, so the two boxes fully overlap
    await clickCanvas(page, { x: 70, y: 63 });
    await expect(props.locator(".dr-props-id")).toHaveText("flex1");

    await clickCanvas(page, { x: 70, y: 63 });
    await expect(props.locator(".dr-props-id")).toHaveText("text1");
  });

  await test.step("既存要素のドラッグ挿入: text2 を flex1 へ", async () => {
    // Drop it toward the bottom of flex1's current box (y60-68) to insert it after text1
    await dragOnCanvas(page, await elementCenterMm(page, "text2"), {
      x: 80,
      y: 67,
    });
    await expect(props.locator(".dr-props-id")).toHaveText("text2");

    // Autosave is debounced 500ms, so wait until the change is written to flex1.children
    await page.waitForFunction(() => {
      const raw = localStorage.getItem("denreport-designer.ir");
      if (raw === null) {
        return false;
      }
      try {
        const parsed = JSON.parse(raw) as {
          readonly elements: readonly {
            readonly id: string;
            readonly children?: readonly { readonly id: string }[];
          }[];
        };
        const flex = parsed.elements.find((el) => el.id === "flex1");
        return (
          (flex?.children?.map((c) => c.id) ?? []).join(",") === "text1,text2"
        );
      } catch {
        return false;
      }
    });
    const ir = await page.evaluate(() =>
      localStorage.getItem("denreport-designer.ir"),
    );
    const flex = (
      JSON.parse(ir ?? "{}") as {
        readonly elements: readonly { readonly id: string }[];
      }
    ).elements.find(
      (
        el,
      ): el is {
        readonly id: string;
        readonly children: readonly { readonly id: string }[];
      } => el.id === "flex1",
    );
    expect(flex?.children.map((c) => c.id)).toEqual(["text1", "text2"]);
  });

  await test.step("子のキャンバスリサイズ: text1 の se ハンドルで w/h を広げると text2 が再解決される", async () => {
    // From the previous selection (sibling text2), clicking directly on text1's exclusive area selects text1 in one step
    await clickCanvas(page, { x: 70, y: 63 });
    await expect(props.locator(".dr-props-id")).toHaveText("text1");

    const before = await elementCenterMm(page, "text2");
    const handle = page.locator(
      '.dr-h[data-dr-handle="se"][data-dr-id="text1"]',
    );
    await expect(handle).toBeVisible();
    const handleBox = await handle.boundingBox();
    if (handleBox === null) {
      throw new Error("se ハンドルが見つかりません");
    }
    const target = await toPx(page, { x: 115, y: 85 });
    await page.mouse.move(
      handleBox.x + handleBox.width / 2,
      handleBox.y + handleBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 8 });
    await page.mouse.up();

    const after = await elementCenterMm(page, "text2");
    expect(after.y).toBeGreaterThan(before.y);

    // Autosave is debounced 500ms, so wait until the post-resize w/h is written
    await page.waitForFunction(() => {
      const raw = localStorage.getItem("denreport-designer.ir");
      if (raw === null) {
        return false;
      }
      try {
        const parsed = JSON.parse(raw) as {
          readonly elements: readonly {
            readonly id: string;
            readonly children?: readonly {
              readonly id: string;
              readonly w?: number;
            }[];
          }[];
        };
        const flex = parsed.elements.find((el) => el.id === "flex1");
        const text1 = flex?.children?.find((c) => c.id === "text1");
        return (text1?.w ?? 0) > 40;
      } catch {
        return false;
      }
    });
    const ir = await page.evaluate(() =>
      localStorage.getItem("denreport-designer.ir"),
    );
    const flex = (
      JSON.parse(ir ?? "{}") as {
        readonly elements: readonly {
          readonly id: string;
          readonly children?: readonly {
            readonly id: string;
            readonly w?: number;
            readonly h?: number;
          }[];
        }[];
      }
    ).elements.find((el) => el.id === "flex1");
    const text1 = flex?.children?.find((c) => c.id === "text1");
    expect(text1?.w).toBeGreaterThan(40);
    expect(text1?.h).toBeGreaterThan(8);
  });

  await test.step("flex からの取り出し: text2 をキャンバス外周へドラッグするとトップレベル化する", async () => {
    const from = await elementCenterMm(page, "text2");
    await dragOnCanvas(page, from, { x: 150, y: 200 });

    // Autosave is debounced 500ms, so wait until text2's promotion to top-level is written
    await page.waitForFunction(() => {
      const raw = localStorage.getItem("denreport-designer.ir");
      if (raw === null) {
        return false;
      }
      try {
        const parsed = JSON.parse(raw) as {
          readonly elements: readonly { readonly id: string }[];
        };
        return parsed.elements.some((el) => el.id === "text2");
      } catch {
        return false;
      }
    });
    const ir = await page.evaluate(() =>
      localStorage.getItem("denreport-designer.ir"),
    );
    const parsed = JSON.parse(ir ?? "{}") as {
      readonly elements: readonly {
        readonly id: string;
        readonly x?: number;
        readonly y?: number;
        readonly children?: readonly { readonly id: string }[];
      }[];
    };
    // The drag start point is text2's center (a 40x8 box, so grabOffset=(20,4)), so the
    // committed x/y is the drop point minus that offset
    const text2 = parsed.elements.find((el) => el.id === "text2");
    expect(text2?.x).toBeCloseTo(130, 0);
    expect(text2?.y).toBeCloseTo(196, 0);

    const flex = parsed.elements.find((el) => el.id === "flex1");
    expect(flex?.children?.map((c) => c.id)).toEqual(["text1"]);
  });
});
