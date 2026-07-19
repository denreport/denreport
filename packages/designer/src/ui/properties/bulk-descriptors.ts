import type {
  IrAlign,
  IrElement,
  IrElementType,
  IrFlexChild,
  IrOrientation,
  IrPages,
} from "@denreport/core";
import type { Messages } from "../../i18n/messages";
import type { PlacedElementView } from "../../state/geometry";
import { ALIGN_OPTIONS } from "./align-options";

type AnyElement = IrElement | IrFlexChild;

export type BulkSection = "placement" | "shape" | "text";

export const BULK_SECTION_ORDER: readonly BulkSection[] = [
  "placement",
  "shape",
  "text",
];

export type BulkValue<T> =
  | { readonly kind: "uniform"; readonly value: T }
  | { readonly kind: "mixed" };

export type BulkDescriptor =
  | {
      readonly kind: "number";
      readonly key: string;
      readonly section: BulkSection;
      readonly label: string;
      readonly unit?: "mm" | "pt";
      readonly precision: number;
      readonly types: ReadonlySet<IrElementType>;
      readonly topLevelOnly: boolean;
      readonly read: (el: AnyElement) => number;
      readonly apply: (el: AnyElement, value: number) => AnyElement;
    }
  | {
      readonly kind: "segment";
      readonly key: string;
      readonly section: BulkSection;
      readonly label: string;
      readonly options: readonly {
        readonly value: string;
        readonly label: string;
      }[];
      readonly types: ReadonlySet<IrElementType>;
      readonly topLevelOnly: boolean;
      readonly read: (el: AnyElement) => string;
      readonly apply: (el: AnyElement, value: string) => AnyElement;
    };

// pages/x/y は IrPositioned 由来の属性なので "in" 判定だけで table・flex 子要素を自然に除外できる
export function buildBulkDescriptors(
  m: Messages["propertiesBulk"],
): readonly BulkDescriptor[] {
  const pagesOptions: readonly { value: IrPages; label: string }[] = [
    { value: "first", label: m.pagesOptions.first },
    { value: "rest", label: m.pagesOptions.rest },
    { value: "last", label: m.pagesOptions.last },
    { value: "all", label: m.pagesOptions.all },
  ];
  return [
    {
      kind: "segment",
      key: "pages",
      section: "placement",
      label: m.fields.pages,
      options: pagesOptions,
      types: new Set<IrElementType>([
        "text",
        "line",
        "rect",
        "image",
        "pageNumber",
        "flex",
      ]),
      topLevelOnly: true,
      read: (el) => {
        if (!("pages" in el)) {
          throw new Error(`pages 未対応の要素: ${el.type}`);
        }
        return el.pages;
      },
      apply: (el, value) =>
        "pages" in el && el.pages !== value
          ? { ...el, pages: value as IrPages }
          : el,
    },
    {
      kind: "number",
      key: "x",
      section: "placement",
      label: m.fields.x,
      unit: "mm",
      precision: 0.1,
      types: new Set<IrElementType>([
        "text",
        "line",
        "rect",
        "table",
        "image",
        "flex",
        "pageNumber",
      ]),
      topLevelOnly: true,
      read: (el) => {
        if (!("x" in el)) {
          throw new Error(`x 未対応の要素: ${el.type}`);
        }
        return el.x;
      },
      apply: (el, value) =>
        "x" in el && el.x !== value ? { ...el, x: value } : el,
    },
    {
      kind: "number",
      key: "y",
      section: "placement",
      label: m.fields.y,
      unit: "mm",
      precision: 0.1,
      types: new Set<IrElementType>([
        "text",
        "line",
        "rect",
        "table",
        "image",
        "flex",
        "pageNumber",
      ]),
      topLevelOnly: true,
      read: (el) => {
        if (!("y" in el)) {
          throw new Error(`y 未対応の要素: ${el.type}`);
        }
        return el.y;
      },
      apply: (el, value) =>
        "y" in el && el.y !== value ? { ...el, y: value } : el,
    },
    {
      kind: "number",
      key: "w",
      section: "placement",
      label: m.fields.w,
      unit: "mm",
      precision: 0.1,
      types: new Set<IrElementType>(["text", "rect", "image", "pageNumber"]),
      topLevelOnly: false,
      read: (el) => {
        switch (el.type) {
          case "text":
          case "rect":
          case "image":
          case "pageNumber":
            return el.w;
          default:
            throw new Error(`w 未対応の要素: ${el.type}`);
        }
      },
      apply: (el, value) => {
        switch (el.type) {
          case "text":
          case "rect":
          case "image":
          case "pageNumber":
            return el.w === value ? el : { ...el, w: value };
          default:
            return el;
        }
      },
    },
    {
      kind: "number",
      key: "h",
      section: "placement",
      label: m.fields.h,
      unit: "mm",
      precision: 0.1,
      types: new Set<IrElementType>(["text", "rect", "image", "pageNumber"]),
      topLevelOnly: false,
      read: (el) => {
        switch (el.type) {
          case "text":
          case "rect":
          case "image":
          case "pageNumber":
            return el.h;
          default:
            throw new Error(`h 未対応の要素: ${el.type}`);
        }
      },
      apply: (el, value) => {
        switch (el.type) {
          case "text":
          case "rect":
          case "image":
          case "pageNumber":
            return el.h === value ? el : { ...el, h: value };
          default:
            return el;
        }
      },
    },
    {
      kind: "segment",
      key: "orientation",
      section: "shape",
      label: m.fields.orientation,
      options: [
        { value: "horizontal", label: m.orientationOptions.horizontal },
        { value: "vertical", label: m.orientationOptions.vertical },
      ],
      types: new Set<IrElementType>(["line"]),
      topLevelOnly: false,
      read: (el) => {
        if (el.type !== "line") {
          throw new Error(`orientation 未対応の要素: ${el.type}`);
        }
        return el.orientation;
      },
      apply: (el, value) =>
        el.type === "line" && el.orientation !== value
          ? { ...el, orientation: value as IrOrientation }
          : el,
    },
    {
      kind: "number",
      key: "length",
      section: "shape",
      label: m.fields.length,
      unit: "mm",
      precision: 0.1,
      types: new Set<IrElementType>(["line"]),
      topLevelOnly: false,
      read: (el) => {
        if (el.type !== "line") {
          throw new Error(`length 未対応の要素: ${el.type}`);
        }
        return el.length;
      },
      apply: (el, value) =>
        el.type === "line" && el.length !== value
          ? { ...el, length: value }
          : el,
    },
    {
      kind: "number",
      key: "thickness",
      section: "shape",
      label: m.fields.thickness,
      unit: "mm",
      precision: 0.1,
      types: new Set<IrElementType>(["line"]),
      topLevelOnly: false,
      read: (el) => {
        if (el.type !== "line") {
          throw new Error(`thickness 未対応の要素: ${el.type}`);
        }
        return el.thickness;
      },
      apply: (el, value) =>
        el.type === "line" && el.thickness !== value
          ? { ...el, thickness: value }
          : el,
    },
    {
      kind: "number",
      key: "borderWidth",
      section: "shape",
      label: m.fields.borderWidth,
      unit: "mm",
      precision: 0.1,
      types: new Set<IrElementType>(["rect"]),
      topLevelOnly: false,
      read: (el) => {
        if (el.type !== "rect") {
          throw new Error(`borderWidth 未対応の要素: ${el.type}`);
        }
        return el.borderWidth;
      },
      apply: (el, value) =>
        el.type === "rect" && el.borderWidth !== value
          ? { ...el, borderWidth: value }
          : el,
    },
    {
      kind: "number",
      key: "fontSize",
      section: "text",
      label: m.fields.fontSize,
      unit: "pt",
      precision: 0.1,
      types: new Set<IrElementType>(["text", "table", "pageNumber"]),
      topLevelOnly: false,
      read: (el) => {
        switch (el.type) {
          case "text":
          case "table":
          case "pageNumber":
            return el.fontSize;
          default:
            throw new Error(`fontSize 未対応の要素: ${el.type}`);
        }
      },
      apply: (el, value) => {
        switch (el.type) {
          case "text":
          case "table":
          case "pageNumber":
            return el.fontSize === value ? el : { ...el, fontSize: value };
          default:
            return el;
        }
      },
    },
    {
      kind: "segment",
      key: "align",
      section: "text",
      label: m.fields.align,
      options: ALIGN_OPTIONS,
      types: new Set<IrElementType>(["text", "pageNumber"]),
      topLevelOnly: false,
      read: (el) => {
        switch (el.type) {
          case "text":
          case "pageNumber":
            return el.align;
          default:
            throw new Error(`align 未対応の要素: ${el.type}`);
        }
      },
      apply: (el, value) => {
        switch (el.type) {
          case "text":
          case "pageNumber":
            return el.align === value ? el : { ...el, align: value as IrAlign };
          default:
            return el;
        }
      },
    },
    {
      kind: "number",
      key: "lineHeight",
      section: "text",
      label: m.fields.lineHeight,
      precision: 0.01,
      types: new Set<IrElementType>(["text", "pageNumber"]),
      topLevelOnly: false,
      read: (el) => {
        switch (el.type) {
          case "text":
          case "pageNumber":
            return el.lineHeight;
          default:
            throw new Error(`lineHeight 未対応の要素: ${el.type}`);
        }
      },
      apply: (el, value) => {
        switch (el.type) {
          case "text":
          case "pageNumber":
            return el.lineHeight === value ? el : { ...el, lineHeight: value };
          default:
            return el;
        }
      },
    },
  ];
}

/** 選択全 view に適用可能なディスクリプタ（型交差 + topLevelOnly 判定） */
export function applicableDescriptors(
  views: readonly PlacedElementView[],
  descriptors: readonly BulkDescriptor[],
): readonly BulkDescriptor[] {
  return descriptors.filter((descriptor) => {
    if (
      descriptor.topLevelOnly &&
      views.some((view) => view.parentFlexId !== null)
    ) {
      return false;
    }
    return views.every((view) => descriptor.types.has(view.element.type));
  });
}

function uniformOrMixed<T>(values: readonly T[]): BulkValue<T> {
  const first = values[0];
  return first !== undefined && values.every((value) => value === first)
    ? { kind: "uniform", value: first }
    : { kind: "mixed" };
}

/** 選択全要素から read した値の uniform / mixed 集約 */
export function bulkValueFor(
  descriptor: BulkDescriptor,
  elements: readonly AnyElement[],
): BulkValue<number> | BulkValue<string> {
  if (descriptor.kind === "number") {
    return uniformOrMixed(elements.map((el) => descriptor.read(el)));
  }
  return uniformOrMixed(elements.map((el) => descriptor.read(el)));
}
