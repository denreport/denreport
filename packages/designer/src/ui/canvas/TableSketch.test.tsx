import type { CharWidthEm, IrTableElement } from "@denreport/core";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MmBox } from "../../state/geometry";
import type { TableCellSource } from "../../state/table-cells";
import { TableSketch } from "./TableSketch";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function table(overrides: Partial<IrTableElement> = {}): IrTableElement {
  return {
    type: "table",
    id: "tbl1",
    x: 0,
    y: 0,
    bind: "items",
    columns: [{ key: "a", label: "A", width: 40, align: "left" }],
    rowHeight: 10,
    headerHeight: 10,
    fontSize: 10,
    maxY: 100,
    continuationY: 0,
    minRows: 0,
    ...overrides,
  };
}

function renderSketch(
  element: IrTableElement,
  box: MmBox,
  cells?: TableCellSource,
  charWidths?: CharWidthEm | null,
): void {
  act(() => {
    root.render(
      <div>
        <TableSketch
          element={element}
          box={box}
          cells={cells}
          charWidths={charWidths}
        />
      </div>,
    );
  });
}

describe("TableSketch — stripeColor", () => {
  it("stripeColor がなければ縞を描画しない", () => {
    renderSketch(table(), { x: 0, y: 0, w: 40, h: 10 + 4 * 10 });
    expect(container.querySelectorAll(".apx-tbl-stripe")).toHaveLength(0);
  });

  it("奇数行インデックス（表示上の2, 4行目）にのみ縞を描画する", () => {
    renderSketch(table({ stripeColor: "#f0f0f0" }), {
      x: 0,
      y: 0,
      w: 40,
      h: 10 + 4 * 10,
    });
    const stripes = [...container.querySelectorAll(".apx-tbl-stripe")];
    expect(stripes).toHaveLength(2); // rows=4 → q=1,3 のみ縞
    expect(
      stripes.map((s) => (s as HTMLElement).style.getPropertyValue("--sy")),
    ).toEqual(["20", "40"]);
    expect(
      stripes.map((s) => (s as HTMLElement).style.getPropertyValue("--sh")),
    ).toEqual(["10", "10"]);
    expect(
      stripes.map((s) => (s as HTMLElement).style.getPropertyValue("--sc")),
    ).toEqual(["#f0f0f0", "#f0f0f0"]);
  });

  it("縞は罫線より先（背後）に描画される", () => {
    renderSketch(table({ stripeColor: "#f0f0f0" }), {
      x: 0,
      y: 0,
      w: 40,
      h: 10 + 2 * 10,
    });
    const nodes = [
      ...container.querySelectorAll(".apx-tbl-stripe, .apx-tbl-hline"),
    ];
    expect(nodes[0]?.classList.contains("apx-tbl-stripe")).toBe(true);
  });

  it("行数0（ヘッダのみ）では縞を描画しない", () => {
    renderSketch(table({ stripeColor: "#f0f0f0" }), {
      x: 0,
      y: 0,
      w: 40,
      h: 10,
    });
    expect(container.querySelectorAll(".apx-tbl-stripe")).toHaveLength(0);
  });
});

describe("TableSketch — セル結合", () => {
  const TWO_COLUMNS: IrTableElement["columns"] = [
    { key: "a", label: "A", width: 40, align: "left" },
    { key: "b", label: "B", width: 30, align: "right" },
  ];

  function sourceOf(
    rows: readonly Readonly<Record<string, string>>[],
  ): TableCellSource {
    return { rows, overrides: new Map() };
  }

  it("mergeSameValue の連続同一値で被覆セルを描画せず、起点セルだけが残る", () => {
    const el = table({
      columns: [
        {
          key: "a",
          label: "A",
          width: 40,
          align: "left",
          mergeSameValue: true,
        },
        { key: "b", label: "B", width: 30, align: "right" },
      ],
    });
    renderSketch(
      el,
      { x: 0, y: 0, w: 70, h: 10 + 2 * 10 },
      sourceOf([
        { a: "同じ", b: "1" },
        { a: "同じ", b: "2" },
      ]),
    );
    const colA = [
      ...container.querySelectorAll('.apx-tbl-td[data-apx-col="0"]'),
    ];
    expect(colA).toHaveLength(1);
    expect(colA[0]?.getAttribute("data-apx-row")).toBe("0");
    expect(
      container.querySelectorAll('.apx-tbl-td[data-apx-col="1"]'),
    ).toHaveLength(2);
    // 結合内部の水平罫線は b 列側の区間だけ残る
    const innerLine = [...container.querySelectorAll(".apx-tbl-hline")].find(
      (line) => (line as HTMLElement).style.getPropertyValue("--ly") === "20",
    ) as HTMLElement | undefined;
    expect(innerLine?.style.left).toBe("calc(40 * var(--mm))");
    expect(innerLine?.style.width).toBe("calc(30 * var(--mm))");
  });

  it("ヘッダの colSpan で被覆ヘッダを描画せず、起点ヘッダが結合幅になる", () => {
    const el = table({
      columns: TWO_COLUMNS,
      cellSpans: [{ row: "header", key: "a", colSpan: 2 }],
    });
    renderSketch(el, { x: 0, y: 0, w: 70, h: 10 + 2 * 10 });
    const ths = [...container.querySelectorAll(".apx-tbl-th")];
    expect(ths).toHaveLength(1);
    expect((ths[0] as HTMLElement).style.getPropertyValue("--cw")).toBe("67");
    // ヘッダ帯の垂直罫線は明細側だけ残る
    const vline = container.querySelector(".apx-tbl-vline") as HTMLElement;
    expect(vline.style.top).toBe("calc(10 * var(--mm))");
    expect(vline.style.height).toBe("calc(20 * var(--mm))");
  });

  it("静的 colSpan の起点セルは結合幅で描画される", () => {
    const el = table({
      columns: TWO_COLUMNS,
      cellSpans: [{ row: 0, key: "a", colSpan: 2 }],
    });
    renderSketch(
      el,
      { x: 0, y: 0, w: 70, h: 10 + 2 * 10 },
      sourceOf([
        { a: "結合", b: "隠れる" },
        { a: "通常", b: "見える" },
      ]),
    );
    const origin = container.querySelector(
      '.apx-tbl-td[data-apx-row="0"][data-apx-col="0"]',
    ) as HTMLElement;
    expect(origin.style.getPropertyValue("--cw")).toBe("67");
    expect(
      container.querySelector(
        '.apx-tbl-td[data-apx-row="0"][data-apx-col="1"]',
      ),
    ).toBeNull();
    expect(
      container.querySelector(
        '.apx-tbl-td[data-apx-row="1"][data-apx-col="1"]',
      ),
    ).not.toBeNull();
  });

  it("被覆セルを指す上書きは表示されない（不活性）", () => {
    const el = table({
      columns: TWO_COLUMNS,
      cellSpans: [{ row: 0, key: "a", colSpan: 2 }],
      cellOverrides: [{ row: 0, key: "b", value: "無効な上書き" }],
    });
    renderSketch(
      el,
      { x: 0, y: 0, w: 70, h: 10 + 2 * 10 },
      {
        rows: [{ a: "結合", b: "1" }],
        overrides: new Map([[0, new Map([["b", "無効な上書き"]])]]),
      },
    );
    expect(container.textContent).not.toContain("無効な上書き");
  });
});

describe("TableSketch — 外枠", () => {
  it(".apx-tbl-frame をちょうど1個描画する", () => {
    renderSketch(table(), { x: 0, y: 0, w: 40, h: 10 + 2 * 10 });
    expect(container.querySelectorAll(".apx-tbl-frame")).toHaveLength(1);
  });

  it("描画順は 縞 → 外枠 → 内部罫線", () => {
    renderSketch(table({ stripeColor: "#f0f0f0" }), {
      x: 0,
      y: 0,
      w: 40,
      h: 10 + 2 * 10,
    });
    const classes = [
      ...container.querySelectorAll(
        ".apx-tbl-stripe, .apx-tbl-frame, .apx-tbl-hline",
      ),
    ].map((node) =>
      node.classList.contains("apx-tbl-stripe")
        ? "stripe"
        : node.classList.contains("apx-tbl-frame")
          ? "frame"
          : "hline",
    );
    expect(classes).toEqual(["stripe", "frame", "hline", "hline"]);
  });
});

describe("TableSketch — 明細セルの均等割付", () => {
  const CONST_WIDTHS: CharWidthEm = () => 0.1;
  const PT_TO_MM = 25.4 / 72;

  function widthMmFor(widthPt: number): number {
    return widthPt * PT_TO_MM;
  }

  it("1行に収まる justify セルは --cs に charSpacePt を持つ", () => {
    const cellW = widthMmFor(4);
    const el = table({
      columns: [{ key: "a", label: "A", width: cellW + 3, align: "justify" }],
      fontSize: 10,
    });
    renderSketch(
      el,
      { x: 0, y: 0, w: cellW + 3, h: 10 + 10 },
      { rows: [{ a: "abc" }], overrides: new Map() },
      CONST_WIDTHS,
    );
    const cell = container.querySelector(".apx-tbl-td") as HTMLElement;
    const expectedCharSpacePt = (4 - 3) / (3 - 1);
    expect(Number(cell.style.getPropertyValue("--cs"))).toBeCloseTo(
      expectedCharSpacePt,
      6,
    );
  });

  it("折り返しが必要な長さの justify セルは --cs を出さない（字間0）", () => {
    const cellW = widthMmFor(3.2);
    const el = table({
      columns: [{ key: "a", label: "A", width: cellW + 3, align: "justify" }],
      fontSize: 10,
    });
    renderSketch(
      el,
      { x: 0, y: 0, w: cellW + 3, h: 10 + 10 },
      { rows: [{ a: "abcdef" }], overrides: new Map() },
      CONST_WIDTHS,
    );
    const cell = container.querySelector(".apx-tbl-td") as HTMLElement;
    expect(cell.style.getPropertyValue("--cs")).toBe("");
  });

  it("align: left の列は charWidths があっても --cs を出さない", () => {
    const cellW = widthMmFor(4);
    const el = table({
      columns: [{ key: "a", label: "A", width: cellW + 3, align: "left" }],
      fontSize: 10,
    });
    renderSketch(
      el,
      { x: 0, y: 0, w: cellW + 3, h: 10 + 10 },
      { rows: [{ a: "abc" }], overrides: new Map() },
      CONST_WIDTHS,
    );
    const cell = container.querySelector(".apx-tbl-td") as HTMLElement;
    expect(cell.style.getPropertyValue("--cs")).toBe("");
  });

  it("charWidths 未指定の justify 列は従来どおり --cs を出さない", () => {
    const cellW = widthMmFor(4);
    const el = table({
      columns: [{ key: "a", label: "A", width: cellW + 3, align: "justify" }],
      fontSize: 10,
    });
    renderSketch(
      el,
      { x: 0, y: 0, w: cellW + 3, h: 10 + 10 },
      {
        rows: [{ a: "abc" }],
        overrides: new Map(),
      },
    );
    const cell = container.querySelector(".apx-tbl-td") as HTMLElement;
    expect(cell.style.getPropertyValue("--cs")).toBe("");
  });
});
