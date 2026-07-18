import type {
  IrStrokeStyle,
  LoweredElement,
  LoweredLineElement,
  LoweredRectElement,
} from "@denreport/core";
import { STROKE_DASH_MM } from "@denreport/core";

function onSegments(
  strokeStyle: Exclude<IrStrokeStyle, "solid">,
  length: number,
): readonly { readonly start: number; readonly end: number }[] {
  const pattern = STROKE_DASH_MM[strokeStyle];
  const segments: { start: number; end: number }[] = [];
  let pos = 0;
  let index = 0;
  let on = true;
  while (pos < length) {
    const step = pattern[index % pattern.length] ?? length;
    const end = Math.min(pos + step, length);
    if (on) segments.push({ start: pos, end });
    pos = end;
    index += 1;
    on = !on;
  }
  return segments;
}

function expandLine(el: LoweredLineElement): readonly LoweredLineElement[] {
  if (el.strokeStyle === "solid") return [el];
  return onSegments(el.strokeStyle, el.length).map(({ start, end }) => ({
    ...el,
    strokeStyle: "solid",
    x: el.orientation === "horizontal" ? el.x + start : el.x,
    y: el.orientation === "vertical" ? el.y + start : el.y,
    length: end - start,
  }));
}

// M17 により borderStyle が非 solid の rect は cornerRadius = 0 が保証されるため、
// 4辺を直角のまま線分化してよい
function rectEdges(el: LoweredRectElement): readonly LoweredLineElement[] {
  const base = {
    sourceId: el.sourceId,
    thickness: el.borderWidth,
    color: el.borderColor,
    strokeStyle: el.borderStyle,
  } as const;
  return [
    {
      type: "line",
      ...base,
      x: el.x,
      y: el.y,
      orientation: "horizontal",
      length: el.w,
    },
    {
      type: "line",
      ...base,
      x: el.x + el.w,
      y: el.y,
      orientation: "vertical",
      length: el.h,
    },
    {
      type: "line",
      ...base,
      x: el.x,
      y: el.y + el.h,
      orientation: "horizontal",
      length: el.w,
    },
    {
      type: "line",
      ...base,
      x: el.x,
      y: el.y,
      orientation: "vertical",
      length: el.h,
    },
  ];
}

function expandRect(el: LoweredRectElement): readonly LoweredElement[] {
  if (el.borderStyle === "solid") return [el];
  const fill: readonly LoweredRectElement[] =
    el.fillColor === null
      ? []
      : [{ ...el, borderWidth: 0, borderStyle: "solid" }];
  return [...fill, ...rectEdges(el).flatMap(expandLine)];
}

/** 非実線の line / rect を、実線の線分・塗りのみ矩形へ静的に展開する。
    実線要素・ellipse・text 等はそのまま返す */
export function expandStrokes(
  elements: readonly LoweredElement[],
): readonly LoweredElement[] {
  return elements.flatMap((element) => {
    switch (element.type) {
      case "line":
        return expandLine(element);
      case "rect":
        return expandRect(element);
      default:
        return [element];
    }
  });
}
