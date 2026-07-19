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

/** `point` を `center` 周りに時計回り `deg` 度（IR の座標系は y 下向き）回転した点を返す */
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

// pdfme は各スキーマをスキーマ中心周りに回転するため、分割で生じた子の中心を
// 親要素の回転中心周りに回転写像した位置へ置けば、全体を1回で回すのと等価になる
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

// M17 により borderStyle が非 solid の rect は cornerRadius = 0 が保証されるため、
// 4辺を直角のまま線分化してよい。回転写像は expandRect が rect 中心周りに一括で行う
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
