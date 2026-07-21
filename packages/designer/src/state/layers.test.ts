import type { IrDocument, IrElement } from "@denreport/core";
import { describe, expect, it } from "vitest";
import { en } from "../i18n/messages/en";
import { ja } from "../i18n/messages/ja";
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
  it("preserves top-level order", () => {
    const doc = makeDocument([
      { ...TABLE, id: "a" },
      { ...TABLE, id: "b" },
    ]);
    const tree = buildLayerTree(doc);
    expect(tree.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("preserves nested flex as a recursive structure", () => {
    const tree = buildLayerTree(makeDocument([NESTED_FLEX]));
    const outer = tree[0];
    expect(outer?.id).toBe("outer");
    expect(outer?.children?.map((n) => n.id)).toEqual(["t1", "inner"]);
    const inner = outer?.children?.[1];
    expect(inner?.children?.map((n) => n.id)).toEqual(["r1", "l1"]);
  });

  it("flex children inherit the parent flex's pages (even when nested)", () => {
    const tree = buildLayerTree(makeDocument([NESTED_FLEX]));
    const byId = new Map(flatten(tree).map((n) => [n.id, n]));
    expect(byId.get("outer")?.pages).toBe("rest");
    expect(byId.get("t1")?.pages).toBe("rest");
    expect(byId.get("inner")?.pages).toBe("rest");
    expect(byId.get("r1")?.pages).toBe("rest");
    expect(byId.get("l1")?.pages).toBe("rest");
  });

  it("table's pages is null", () => {
    const tree = buildLayerTree(makeDocument([TABLE]));
    expect(tree[0]?.pages).toBeNull();
  });

  it("leaf node children is null, flex node children is non-null", () => {
    const tree = buildLayerTree(makeDocument([NESTED_FLEX, TABLE]));
    expect(tree[0]?.children).not.toBeNull();
    expect(tree[1]?.children).toBeNull();
    const leaf = tree[0]?.children?.[0];
    expect(leaf?.children).toBeNull();
  });

  it("LayerNode.pages matches layoutDocument's pages for every id", () => {
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

  function label(element: Parameters<typeof layerLabel>[0]): string {
    return layerLabel(element, ja.elementTypes, ja.layers.imagePlaceholder);
  }

  it("text containing a token is also truncated with … past the first 12 characters", () => {
    expect(label({ ...base, text: "{customerName}" })).toBe("{customerNam…");
  });

  it("static text is truncated with … past the first 12 characters", () => {
    expect(label({ ...base, text: "123456789012345" })).toBe("123456789012…");
    expect(label({ ...base, text: "短い本文" })).toBe("短い本文");
  });

  it('empty text falls back to the type label "テキスト"', () => {
    expect(label({ ...base, text: "" })).toBe("テキスト");
  });

  it("pageNumber is the format string", () => {
    expect(
      label({
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

  it('image is "画像未設定" for the placeholder and "画像" once set', () => {
    expect(
      label({
        type: "image",
        id: "img1",
        w: 30,
        h: 30,
        src: IMAGE_PLACEHOLDER_SRC,
      }),
    ).toBe("画像未設定");
    expect(
      label({
        type: "image",
        id: "img1",
        w: 30,
        h: 30,
        src: "data:image/png;base64,xxx",
      }),
    ).toBe("画像");
  });

  it("line / rect / table / flex use the type's Japanese label", () => {
    expect(
      label({
        type: "line",
        id: "l1",
        orientation: "horizontal",
        length: 10,
        thickness: 0.3,
      }),
    ).toBe("直線");
    expect(
      label({ type: "rect", id: "r1", w: 10, h: 10, borderWidth: 0.3 }),
    ).toBe("矩形");
    expect(label(TABLE)).toBe("表");
    expect(
      label({
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

  it("name, when specified, takes priority over the automatic label", () => {
    expect(label({ ...base, text: "見出し", name: "表題" })).toBe("表題");
    expect(label(TABLE)).toBe("表");
    expect(label({ ...TABLE, name: "明細表" })).toBe("明細表");
  });

  it("name falls back to the automatic label when it's an empty string", () => {
    expect(label({ ...base, text: "見出し", name: "" })).toBe("見出し");
  });

  it("the image label is also in English with en messages", () => {
    const image = {
      type: "image" as const,
      id: "img1",
      w: 30,
      h: 30,
      src: IMAGE_PLACEHOLDER_SRC,
    };
    expect(layerLabel(image, en.elementTypes, en.layers.imagePlaceholder)).toBe(
      "No image set",
    );
    expect(
      layerLabel(
        { ...image, src: "data:image/png;base64,xxx" },
        en.elementTypes,
        en.layers.imagePlaceholder,
      ),
    ).toBe("Image");
  });
});
