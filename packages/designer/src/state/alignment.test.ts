import type { IrDocument, IrElement, IrTextElement } from "@denreport/core";
import { describe, expect, it } from "vitest";
import {
  alignmentDeltas,
  applyMoveDeltas,
  distributionDeltas,
} from "./alignment";
import { createDefaultElement } from "./defaults";
import type { MmBox, PlacedElementView } from "./geometry";

function view(id: string, box: MmBox): PlacedElementView {
  const element: IrTextElement = {
    type: "text",
    id,
    x: box.x,
    y: box.y,
    pages: "first",
    w: box.w,
    h: box.h,
    text: id,
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  };
  return {
    id,
    element,
    box,
    pages: "first",
    parentFlexId: null,
    childIndex: null,
  };
}

function blankDocument(): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements: [],
  };
}

function textElement(
  id: string,
  x: number,
  y: number,
  w = 20,
  h = 10,
): IrElement {
  return {
    type: "text",
    id,
    x,
    y,
    pages: "first",
    w,
    h,
    text: id,
    fontSize: 10,
    align: "left",
    lineHeight: 1.25,
  };
}

describe("alignmentDeltas", () => {
  it("left: 各箱の左辺を union の左端に揃える", () => {
    const views = [
      view("a", { x: 10, y: 0, w: 20, h: 10 }),
      view("b", { x: 40, y: 0, w: 10, h: 10 }),
    ];
    const deltas = alignmentDeltas(views, "left");
    expect(deltas.get("a")).toBeUndefined();
    expect(deltas.get("b")).toEqual({ dx: -30, dy: 0 });
  });

  it("right: 各箱の右辺を union の右端に揃える", () => {
    const views = [
      view("a", { x: 10, y: 0, w: 20, h: 10 }),
      view("b", { x: 40, y: 0, w: 10, h: 10 }),
    ];
    const deltas = alignmentDeltas(views, "right");
    // union right = 50
    expect(deltas.get("a")).toEqual({ dx: 20, dy: 0 });
    expect(deltas.get("b")).toBeUndefined();
  });

  it("hcenter: 各箱の中心 x を union の中心 x に揃える", () => {
    const views = [
      view("a", { x: 0, y: 0, w: 20, h: 10 }),
      view("b", { x: 40, y: 0, w: 10, h: 10 }),
    ];
    // union: x 0..50, center 25
    const deltas = alignmentDeltas(views, "hcenter");
    expect(deltas.get("a")).toEqual({ dx: 15, dy: 0 });
    expect(deltas.get("b")).toEqual({ dx: -20, dy: 0 });
  });

  it("top / vcenter / bottom は y 軸のみを動かす", () => {
    const views = [
      view("a", { x: 0, y: 0, w: 10, h: 20 }),
      view("b", { x: 0, y: 30, w: 10, h: 10 }),
    ];
    expect(alignmentDeltas(views, "top").get("b")).toEqual({ dx: 0, dy: -30 });
    expect(alignmentDeltas(views, "bottom").get("a")).toEqual({
      dx: 0,
      dy: 20,
    });
    // union: y 0..40, center 20
    expect(alignmentDeltas(views, "vcenter").get("a")).toEqual({
      dx: 0,
      dy: 10,
    });
    expect(alignmentDeltas(views, "vcenter").get("b")).toEqual({
      dx: 0,
      dy: -15,
    });
  });

  it("既に揃っている要素の delta は空（エントリなし）", () => {
    const views = [
      view("a", { x: 10, y: 0, w: 20, h: 10 }),
      view("b", { x: 10, y: 5, w: 10, h: 10 }),
    ];
    expect(alignmentDeltas(views, "left").size).toBe(0);
  });

  it("line（幅/高さ 0 の箱）の中央揃えも算術どおり動く", () => {
    const views = [
      view("a", { x: 0, y: 0, w: 40, h: 10 }),
      view("line", { x: 0, y: 0, w: 0, h: 20 }),
    ];
    // union x: 0..40, center 20; line width 0 → target x = 20
    const deltas = alignmentDeltas(views, "hcenter");
    expect(deltas.get("line")).toEqual({ dx: 20, dy: 0 });
  });
});

describe("distributionDeltas", () => {
  it("3要素以上で gap が均等になり、両端は動かない", () => {
    const views = [
      view("a", { x: 0, y: 0, w: 10, h: 10 }),
      view("b", { x: 20, y: 0, w: 10, h: 10 }),
      view("c", { x: 60, y: 0, w: 10, h: 10 }),
    ];
    // span = 60+10-0 = 70, sumSizes = 30, gap = 40/2 = 20
    const deltas = distributionDeltas(views, "horizontal");
    expect(deltas.get("a")).toBeUndefined();
    expect(deltas.get("c")).toBeUndefined();
    // b の目標開始位置 = 0 + 10 + 20 = 30 → delta = 10
    expect(deltas.get("b")).toEqual({ dx: 10, dy: 0 });
  });

  it("垂直方向も同様に動く", () => {
    const views = [
      view("a", { x: 0, y: 0, w: 10, h: 10 }),
      view("b", { x: 0, y: 20, w: 10, h: 10 }),
      view("c", { x: 0, y: 60, w: 10, h: 10 }),
    ];
    const deltas = distributionDeltas(views, "vertical");
    expect(deltas.get("b")).toEqual({ dx: 0, dy: 10 });
  });

  it("同位置要素は文書順（配列順）を保つ安定ソート", () => {
    const views = [
      view("a", { x: 0, y: 0, w: 10, h: 10 }),
      view("b", { x: 20, y: 0, w: 10, h: 10 }),
      view("c", { x: 20, y: 0, w: 10, h: 10 }),
      view("d", { x: 60, y: 0, w: 10, h: 10 }),
    ];
    // b と c は同位置。文書順(b→c)を保てば b が2番目、c が3番目のまま並ぶ
    const deltas = distributionDeltas(views, "horizontal");
    // sumSizes = 40, span = 60+10-0 = 70, gap = 30/3 = 10
    // b target = 0+10+10 = 20 → delta 0（既に20）→エントリなし
    expect(deltas.get("b")).toBeUndefined();
    // c target = 20+10+10 = 40 → delta 20
    expect(deltas.get("c")).toEqual({ dx: 20, dy: 0 });
  });

  it("重なり（負 gap）でも例外なく適用される", () => {
    const views = [
      view("a", { x: 0, y: 0, w: 30, h: 10 }),
      view("b", { x: 15, y: 0, w: 30, h: 10 }),
      view("c", { x: 25, y: 0, w: 30, h: 10 }),
    ];
    // span = 25+30-0 = 55, sumSizes = 90, gap = -35/2 = -17.5
    const deltas = distributionDeltas(views, "horizontal");
    // b target = 0+30-17.5 = 12.5 → delta -2.5
    expect(deltas.get("b")).toEqual({ dx: -2.5, dy: 0 });
  });
});

describe("applyMoveDeltas", () => {
  it("roundMm で丸めて x/y を書き戻す", () => {
    const doc: IrDocument = {
      ...blankDocument(),
      elements: [textElement("a", 10, 10)],
    };
    const deltas = new Map([["a", { dx: 0.12345, dy: 0.06 }]]);
    const next = applyMoveDeltas(doc, "first", deltas);
    expect(next.elements[0]).toMatchObject({ x: 10.1, y: 10.1 });
  });

  it("deltas にないエントリは変更しない（同一参照）", () => {
    const a = textElement("a", 10, 10);
    const doc: IrDocument = { ...blankDocument(), elements: [a] };
    const next = applyMoveDeltas(doc, "first", new Map());
    expect(next.elements[0]).toBe(a);
  });

  it("table: first 文脈では y を動かし、未分離の continuationY が追従する", () => {
    const table = createDefaultElement(blankDocument(), "table", 15, 90);
    const doc: IrDocument = { ...blankDocument(), elements: [table] };
    const deltas = new Map([[table.id, { dx: 5, dy: 10 }]]);
    const next = applyMoveDeltas(doc, "first", deltas);
    expect(next.elements[0]).toMatchObject({
      x: 20,
      y: 100,
      continuationY: 100,
    });
  });

  it("table: first 文脈で分離済み continuationY は追従しない", () => {
    const table = {
      ...createDefaultElement(blankDocument(), "table", 15, 90),
      continuationY: 30,
    };
    const doc: IrDocument = { ...blankDocument(), elements: [table] };
    const deltas = new Map([[table.id, { dx: 0, dy: 10 }]]);
    const next = applyMoveDeltas(doc, "first", deltas);
    expect(next.elements[0]).toMatchObject({ y: 100, continuationY: 30 });
  });

  it("table: rest/last 文脈では continuationY のみ動き、y は不変", () => {
    const table = createDefaultElement(blankDocument(), "table", 15, 90);
    const doc: IrDocument = { ...blankDocument(), elements: [table] };
    const deltas = new Map([[table.id, { dx: 5, dy: 10 }]]);
    const next = applyMoveDeltas(doc, "rest", deltas);
    expect(next.elements[0]).toMatchObject({
      x: 20,
      y: 90,
      continuationY: 100,
    });
  });
});
