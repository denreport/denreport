import type { IrDocument, IrElement } from "@denreport/core";
import { describe, expect, it } from "vitest";
import { IMAGE_PLACEHOLDER_SRC } from "./constants";
import { layoutDocument } from "./geometry";
import type { LayerNode } from "./layers";
import { buildLayerTree, layerLabel } from "./layers";

function makeDocument(elements: readonly IrElement[]): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: "NotoSansJP" },
    elements,
  };
}

const NESTED_FLEX: IrElement = {
  type: "flex",
  id: "outer",
  x: 20,
  y: 40,
  pages: "rest",
  direction: "column",
  gap: 2,
  justifyContent: "start",
  alignItems: "start",
  children: [
    {
      type: "text",
      id: "t1",
      w: 60,
      h: 6,
      text: "a",
      fontSize: 10,
      align: "left",
      lineHeight: 1.25,
    },
    {
      type: "flex",
      id: "inner",
      direction: "row",
      gap: 1,
      justifyContent: "start",
      alignItems: "end",
      children: [
        { type: "rect", id: "r1", w: 10, h: 8, borderWidth: 0.3 },
        {
          type: "line",
          id: "l1",
          orientation: "vertical",
          length: 12,
          thickness: 0.3,
        },
      ],
    },
  ],
};

const TABLE: IrElement = {
  type: "table",
  id: "tbl1",
  x: 10,
  y: 90,
  bind: "items",
  columns: [{ key: "col1", label: "列1", width: 40, align: "left" }],
  rowHeight: 8,
  headerHeight: 8,
  fontSize: 10,
  maxY: 240,
  continuationY: 20,
  minRows: 3,
};

function flatten(nodes: readonly LayerNode[]): LayerNode[] {
  return nodes.flatMap((node) => [
    node,
    ...(node.children !== null ? flatten(node.children) : []),
  ]);
}

describe("buildLayerTree", () => {
  it("トップレベルの順序を保つ", () => {
    const doc = makeDocument([
      { ...TABLE, id: "a" },
      { ...TABLE, id: "b" },
    ]);
    const tree = buildLayerTree(doc);
    expect(tree.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("ネストした flex を再帰構造として保つ", () => {
    const tree = buildLayerTree(makeDocument([NESTED_FLEX]));
    const outer = tree[0];
    expect(outer?.id).toBe("outer");
    expect(outer?.children?.map((n) => n.id)).toEqual(["t1", "inner"]);
    const inner = outer?.children?.[1];
    expect(inner?.children?.map((n) => n.id)).toEqual(["r1", "l1"]);
  });

  it("flex 子の pages は親 flex の pages を継承する（入れ子でも）", () => {
    const tree = buildLayerTree(makeDocument([NESTED_FLEX]));
    const byId = new Map(flatten(tree).map((n) => [n.id, n]));
    expect(byId.get("outer")?.pages).toBe("rest");
    expect(byId.get("t1")?.pages).toBe("rest");
    expect(byId.get("inner")?.pages).toBe("rest");
    expect(byId.get("r1")?.pages).toBe("rest");
    expect(byId.get("l1")?.pages).toBe("rest");
  });

  it("table の pages は null", () => {
    const tree = buildLayerTree(makeDocument([TABLE]));
    expect(tree[0]?.pages).toBeNull();
  });

  it("葉ノードの children は null、flex ノードの children は非 null", () => {
    const tree = buildLayerTree(makeDocument([NESTED_FLEX, TABLE]));
    expect(tree[0]?.children).not.toBeNull();
    expect(tree[1]?.children).toBeNull();
    const leaf = tree[0]?.children?.[0];
    expect(leaf?.children).toBeNull();
  });

  it("LayerNode.pages は layoutDocument の pages と全 id で一致する", () => {
    const doc = makeDocument([NESTED_FLEX, TABLE]);
    const tree = flatten(buildLayerTree(doc));
    const views = layoutDocument(doc, "first");
    const viewPagesById = new Map(views.map((v) => [v.id, v.pages]));
    for (const node of tree) {
      expect(node.pages, node.id).toBe(viewPagesById.get(node.id));
    }
  });
});

describe("layerLabel", () => {
  const base = {
    type: "text" as const,
    id: "t1",
    w: 40,
    h: 8,
    fontSize: 10,
    align: "left" as const,
    lineHeight: 1.25,
  };

  it("トークンを含む text も先頭12文字を超えると … で切り詰める", () => {
    expect(layerLabel({ ...base, text: "{customerName}" })).toBe(
      "{customerNam…",
    );
  });

  it("静的 text は先頭12文字を超えると … で切り詰める", () => {
    expect(layerLabel({ ...base, text: "123456789012345" })).toBe(
      "123456789012…",
    );
    expect(layerLabel({ ...base, text: "短い本文" })).toBe("短い本文");
  });

  it("空の text は型ラベル「テキスト」", () => {
    expect(layerLabel({ ...base, text: "" })).toBe("テキスト");
  });

  it("pageNumber は format 文字列", () => {
    expect(
      layerLabel({
        type: "pageNumber",
        id: "p1",
        w: 30,
        h: 6,
        format: "{page}/{total}",
        fontSize: 10,
        align: "left",
        lineHeight: 1.25,
      }),
    ).toBe("{page}/{total}");
  });

  it("image はプレースホルダなら「画像未設定」、設定済みなら「画像」", () => {
    expect(
      layerLabel({
        type: "image",
        id: "img1",
        w: 30,
        h: 30,
        src: IMAGE_PLACEHOLDER_SRC,
      }),
    ).toBe("画像未設定");
    expect(
      layerLabel({
        type: "image",
        id: "img1",
        w: 30,
        h: 30,
        src: "data:image/png;base64,xxx",
      }),
    ).toBe("画像");
  });

  it("line / rect / table / flex は型の日本語ラベル", () => {
    expect(
      layerLabel({
        type: "line",
        id: "l1",
        orientation: "horizontal",
        length: 10,
        thickness: 0.3,
      }),
    ).toBe("直線");
    expect(
      layerLabel({ type: "rect", id: "r1", w: 10, h: 10, borderWidth: 0.3 }),
    ).toBe("矩形");
    expect(layerLabel(TABLE)).toBe("表");
    expect(
      layerLabel({
        type: "flex",
        id: "f1",
        direction: "row",
        gap: 0,
        justifyContent: "start",
        alignItems: "start",
        children: [],
      }),
    ).toBe("フレックス");
  });

  it("name が指定されていれば自動ラベルより優先する", () => {
    expect(layerLabel({ ...base, text: "見出し", name: "表題" })).toBe("表題");
    expect(layerLabel(TABLE)).toBe("表");
    expect(layerLabel({ ...TABLE, name: "明細表" })).toBe("明細表");
  });

  it("name が空文字なら自動ラベルへフォールバックする", () => {
    expect(layerLabel({ ...base, text: "見出し", name: "" })).toBe("見出し");
  });
});
