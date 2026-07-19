import type {
  IrDocument,
  IrElement,
  IrElementType,
  IrFlexChild,
  IrPages,
} from "@denreport/core";
import { IMAGE_PLACEHOLDER_SRC } from "./constants";

/** レイヤーツリーの1ノード。children は flex のみ非 null */
export interface LayerNode {
  readonly id: string;
  readonly element: IrElement | IrFlexChild;
  /** 選択時のページ文脈切替に使う。table は null（全文脈で可視）。flex 子は親 flex の pages を継承 */
  readonly pages: IrPages | null;
  readonly children: readonly LayerNode[] | null;
}

function buildNode(
  element: IrElement | IrFlexChild,
  pages: IrPages | null,
): LayerNode {
  if (element.type === "flex") {
    return {
      id: element.id,
      element,
      pages,
      children: element.children.map((child) => buildNode(child, pages)),
    };
  }
  return { id: element.id, element, pages, children: null };
}

/** IrDocument.elements / IrFlexElement.children を配列順のままツリーに写す */
export function buildLayerTree(document: IrDocument): readonly LayerNode[] {
  return document.elements.map((element) =>
    buildNode(element, element.type === "table" ? null : element.pages),
  );
}

const TEXT_LABEL_MAX = 12;

/** ツリー行の表示名（プレーン文字列）。name があれば name を優先する */
export function layerLabel(
  element: IrElement | IrFlexChild,
  elementTypes: Record<IrElementType, string>,
): string {
  if (element.name !== undefined && element.name !== "") {
    return element.name;
  }
  switch (element.type) {
    case "text": {
      const text = element.text;
      if (text.length === 0) {
        return elementTypes.text;
      }
      return text.length > TEXT_LABEL_MAX
        ? `${text.slice(0, TEXT_LABEL_MAX)}…`
        : text;
    }
    case "pageNumber":
      return element.format;
    case "image":
      return element.src === IMAGE_PLACEHOLDER_SRC ? "画像未設定" : "画像";
    default:
      return elementTypes[element.type];
  }
}
