import type {
  IrDocument,
  IrElement,
  IrElementType,
  IrFlexChild,
} from "@denreport/core";
import { IMAGE_PLACEHOLDER_SRC } from "./constants.js";
import { roundMm } from "./geometry.js";

// A document's initial content is user data and must not depend on locale
const DEFAULT_TEXT = "text1";

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

/** Returns "<type><n>" unused within the document (including flex descendants), where n is the smallest free number starting from 1 */
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

/** Initial dimensions (mm) per type, used for palette display and placement ghosts. line is equivalent to length x 0 */
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
 * Returns a new element in normalized full form (all optional attributes given explicit
 * defaults), placed with its top-left at (x, y).
 * flex is generated with one text child (whose id is also numbered from document).
 */
export function createDefaultElement(
  document: IrDocument,
  type: IrElementType,
  x: number,
  y: number,
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
        text: DEFAULT_TEXT,
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
          { key: "col1", label: "column1", width: 40, align: "left" },
          { key: "col2", label: "column2", width: 40, align: "left" },
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
        text: DEFAULT_TEXT,
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

/** A new element placed at the page center, sized via defaultSizeMm. The top-left coordinate is never negative (a safeguard for very small paper) */
export function createCenteredElement(
  document: IrDocument,
  type: IrElementType,
): IrElement {
  const size = defaultSizeMm(type);
  const x = Math.max(0, (document.page.width - size.w) / 2);
  const y = Math.max(0, (document.page.height - size.h) / 2);
  return createDefaultElement(document, type, x, y);
}
