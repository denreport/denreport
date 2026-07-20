import type {
  IrStrokeStyle,
  LoweredElement,
  LoweredLineElement,
  LoweredRectElement,
} from "@denreport/core";
import { STROKE_DASH_MM } from "@denreport/core";

interface Point {
  readonly x: number;
  readonly y: number;
}

/** Returns `point` rotated clockwise `deg` degrees around `center` (the IR's coordinate system has y pointing downward). */
export function rotatePointCw(point: Point, center: Point, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

function lineCenter(el: LoweredLineElement): Point {
  return el.orientation === "horizontal"
    ? { x: el.x + el.length / 2, y: el.y }
    : { x: el.x, y: el.y + el.length / 2 };
}

// pdfme rotates each schema around the schema's own center, so mapping the
// center of a child produced by splitting through a rotation around the
// parent element's rotation center, and placing it there, is equivalent to
// rotating the whole thing once.
function placeRotatedLine(
  child: LoweredLineElement,
  parentCenter: Point,
  rotate: number,
): LoweredLineElement {
  if (rotate === 0) return child;
  const mapped = rotatePointCw(lineCenter(child), parentCenter, rotate);
  return child.orientation === "horizontal"
    ? { ...child, x: mapped.x - child.length / 2, y: mapped.y }
    : { ...child, x: mapped.x, y: mapped.y - child.length / 2 };
}

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
  const center = lineCenter(el);
  return onSegments(el.strokeStyle, el.length).map(({ start, end }) =>
    placeRotatedLine(
      {
        ...el,
        strokeStyle: "solid",
        x: el.orientation === "horizontal" ? el.x + start : el.x,
        y: el.orientation === "vertical" ? el.y + start : el.y,
        length: end - start,
      },
      center,
      el.rotate,
    ),
  );
}

// M17 guarantees that a rect with a non-solid borderStyle has cornerRadius =
// 0, so it's fine to turn the 4 sides into line segments with right angles
// intact. The rotation mapping is done all at once by expandRect, around the rect's center.
function rectEdges(el: LoweredRectElement): readonly LoweredLineElement[] {
  const base = {
    sourceId: el.sourceId,
    thickness: el.borderWidth,
    color: el.borderColor,
    strokeStyle: el.borderStyle,
    rotate: 0,
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
  const center = { x: el.x + el.w / 2, y: el.y + el.h / 2 };
  const edges = rectEdges(el)
    .flatMap(expandLine)
    .map((segment) =>
      placeRotatedLine({ ...segment, rotate: el.rotate }, center, el.rotate),
    );
  return [...fill, ...edges];
}

/** Statically expands non-solid line / rect elements into solid line
    segments and fill-only rectangles. Solid elements, ellipse, text, etc.
    are returned unchanged. */
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
