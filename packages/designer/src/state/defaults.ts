import type {
  IrDocument,
  IrElement,
  IrElementType,
  IrFlexChild,
} from "@denreport/core";
import type { Messages } from "../i18n/messages";
import { IMAGE_PLACEHOLDER_SRC } from "./constants";
import { roundMm } from "./geometry";

/** 既定テキスト・シナリオ命名に使う文言。designer state 層の関数はこの部分名前空間のみを受け取る */
export type DefaultsMessages = Messages["defaults"];

function collectIds(document: IrDocument): Set<string> {
  const ids = new Set<string>();
  function visit(el: IrElement | IrFlexChild): void {
    ids.add(el.id);
    if (el.type === "flex") {
      for (const child of el.children) {
        visit(child);
      }
    }
  }
  for (const el of document.elements) {
    visit(el);
  }
  return ids;
}

/** 文書内（flex 子孫含む）で未使用の "<type><n>"（n は 1 から最小空き）を返す */
export function nextElementId(
  document: IrDocument,
  type: IrElementType,
): string {
  const used = collectIds(document);
  let n = 1;
  while (used.has(`${type}${n}`)) {
    n += 1;
  }
  return `${type}${n}`;
}

/** パレット表示・配置ゴーストに使う型別の初期寸法（mm）。line は length×0 相当 */
export function defaultSizeMm(type: IrElementType): {
  readonly w: number;
  readonly h: number;
} {
  switch (type) {
    case "text":
      return { w: 40, h: 8 };
    case "line":
      return { w: 50, h: 0 };
    case "rect":
      return { w: 40, h: 20 };
    case "ellipse":
      return { w: 30, h: 20 };
    case "table":
      return { w: 80, h: 32 };
    case "image":
      return { w: 30, h: 30 };
    case "flex":
      return { w: 40, h: 8 };
    case "pageNumber":
      return { w: 30, h: 6 };
    case "barcode":
      return { w: 30, h: 30 };
  }
}

/**
 * 左上 (x, y) に置く正規化済み完全形（任意属性のデフォルト明示済み）の新規要素を返す。
 * flex は text 子1個つきで生成する（子 id も document から採番）。
 */
export function createDefaultElement(
  document: IrDocument,
  type: IrElementType,
  x: number,
  y: number,
  m: DefaultsMessages,
): IrElement {
  const id = nextElementId(document, type);
  const px = roundMm(x);
  const py = roundMm(y);
  switch (type) {
    case "text":
      return {
        type,
        id,
        x: px,
        y: py,
        pages: "first",
        w: 40,
        h: 8,
        text: m.text,
        fontSize: 10,
        align: "left",
        lineHeight: 1.25,
      };
    case "line":
      return {
        type,
        id,
        x: px,
        y: py,
        pages: "first",
        orientation: "horizontal",
        length: 50,
        thickness: 0.3,
      };
    case "rect":
      return {
        type,
        id,
        x: px,
        y: py,
        pages: "first",
        w: 40,
        h: 20,
        borderWidth: 0.3,
      };
    case "ellipse":
      return {
        type,
        id,
        x: px,
        y: py,
        pages: "first",
        w: 30,
        h: 20,
        borderWidth: 0.3,
      };
    case "table":
      return {
        type,
        id,
        x: px,
        y: py,
        bind: "items",
        columns: [
          { key: "col1", label: m.columnName(1), width: 40, align: "left" },
          { key: "col2", label: m.columnName(2), width: 40, align: "left" },
        ],
        rowHeight: 8,
        headerHeight: 8,
        fontSize: 10,
        maxY: document.page.height,
        continuationY: py,
        minRows: 3,
      };
    case "image":
      return {
        type,
        id,
        x: px,
        y: py,
        pages: "first",
        w: 30,
        h: 30,
        src: IMAGE_PLACEHOLDER_SRC,
      };
    case "flex": {
      const child: IrFlexChild = {
        type: "text",
        id: nextElementId(document, "text"),
        w: 40,
        h: 8,
        text: m.text,
        fontSize: 10,
        align: "left",
        lineHeight: 1.25,
      };
      return {
        type,
        id,
        x: px,
        y: py,
        pages: "first",
        direction: "column",
        gap: 2,
        justifyContent: "start",
        alignItems: "start",
        children: [child],
      };
    }
    case "pageNumber":
      return {
        type,
        id,
        x: px,
        y: py,
        pages: "all",
        w: 30,
        h: 6,
        format: "{n} / {N}",
        fontSize: 10,
        align: "left",
        lineHeight: 1.25,
      };
    case "barcode":
      return {
        type,
        id,
        x: px,
        y: py,
        pages: "first",
        w: 30,
        h: 30,
        symbology: "qrcode",
        value: "{code}",
      };
  }
}

/** ページ中央に defaultSizeMm で置く新規要素。左上座標は 0 未満にしない（極小用紙対策） */
export function createCenteredElement(
  document: IrDocument,
  type: IrElementType,
  m: DefaultsMessages,
): IrElement {
  const size = defaultSizeMm(type);
  const x = Math.max(0, (document.page.width - size.w) / 2);
  const y = Math.max(0, (document.page.height - size.h) / 2);
  return createDefaultElement(document, type, x, y, m);
}
