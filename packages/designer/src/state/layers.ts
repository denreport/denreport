import type {
  IrDocument,
  IrElement,
  IrElementType,
  IrFlexChild,
  IrPages,
} from "@denreport/core";
import { IMAGE_PLACEHOLDER_SRC } from "./constants.js";

/** One node in the layer tree. children is non-null only for flex */
export interface LayerNode {
  readonly id: string;
  readonly element: IrElement | IrFlexChild;
  /** Used to switch the page context on selection. null for table (visible in all contexts). A flex child inherits its parent flex's pages */
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

/** Maps IrDocument.elements / IrFlexElement.children into a tree, preserving array order */
export function buildLayerTree(document: IrDocument): readonly LayerNode[] {
  return document.elements.map((element) =>
    buildNode(element, element.type === "table" ? null : element.pages),
  );
}

const TEXT_LABEL_MAX = 12;

/** A tree row's display name (plain string). Prefers name if present */
export function layerLabel(
  element: IrElement | IrFlexChild,
  elementTypes: Record<IrElementType, string>,
  imagePlaceholder: string,
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
      return element.src === IMAGE_PLACEHOLDER_SRC
        ? imagePlaceholder
        : elementTypes.image;
    default:
      return elementTypes[element.type];
  }
}
