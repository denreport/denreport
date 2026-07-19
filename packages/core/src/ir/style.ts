import type {
  IrEllipseElement,
  IrLineElement,
  IrRectElement,
  IrStrokeStyle,
  IrTextElement,
} from "./types";

/**
 * Dash pattern (mm, alternating on/off lengths) for each non-solid stroke
 * style. `solid` has no pattern and renders as a continuous line.
 */
export const STROKE_DASH_MM: Readonly<
  Record<Exclude<IrStrokeStyle, "solid">, readonly number[]>
> = {
  dotted: [0.4, 0.8],
  dashed: [2, 1],
  dashdot: [3, 1, 0.4, 1],
  dashdotdot: [3, 1, 0.4, 1, 0.4, 1],
};

/** A line's color and stroke style with IR's optional fields resolved to concrete defaults. */
export interface ResolvedStroke {
  readonly color: string;
  readonly strokeStyle: IrStrokeStyle;
}

/**
 * A rect or ellipse's border/fill color, stroke style, and corner radius with
 * IR's optional fields resolved to concrete defaults.
 */
export interface ResolvedShapeStyle {
  readonly borderColor: string;
  readonly fillColor: string | null;
  readonly borderStyle: IrStrokeStyle;
  readonly cornerRadius: number;
}

const DEFAULT_COLOR = "#000000";
const DEFAULT_STROKE_STYLE: IrStrokeStyle = "solid";

/** Resolves a line element's optional `color` and `strokeStyle` to concrete defaults (black, solid). */
export function resolveLineStyle(
  el: Pick<IrLineElement, "color" | "strokeStyle">,
): ResolvedStroke {
  return {
    color: el.color ?? DEFAULT_COLOR,
    strokeStyle: el.strokeStyle ?? DEFAULT_STROKE_STYLE,
  };
}

/**
 * Resolves a rect element's optional border/fill/stroke/corner attributes to
 * concrete defaults (black border, no fill, solid, square corners).
 */
export function resolveRectStyle(
  el: Pick<
    IrRectElement,
    "borderColor" | "fillColor" | "borderStyle" | "cornerRadius"
  >,
): ResolvedShapeStyle {
  return {
    borderColor: el.borderColor ?? DEFAULT_COLOR,
    fillColor: el.fillColor ?? null,
    borderStyle: el.borderStyle ?? DEFAULT_STROKE_STYLE,
    cornerRadius: el.cornerRadius ?? 0,
  };
}

/**
 * Resolves an ellipse element's optional border/fill colors to concrete
 * defaults. `borderStyle` is always "solid" and `cornerRadius` is always 0 —
 * ellipses have no such style attributes.
 */
export function resolveEllipseStyle(
  el: Pick<IrEllipseElement, "borderColor" | "fillColor">,
): ResolvedShapeStyle {
  return {
    borderColor: el.borderColor ?? DEFAULT_COLOR,
    fillColor: el.fillColor ?? null,
    borderStyle: DEFAULT_STROKE_STYLE,
    cornerRadius: 0,
  };
}

/** A text or pageNumber element's color with IR's optional field resolved to a concrete default. */
export interface ResolvedTextStyle {
  readonly color: string;
}

/** Resolves a text or pageNumber element's optional `color` to a concrete default (black). */
export function resolveTextStyle(
  el: Pick<IrTextElement, "color">,
): ResolvedTextStyle {
  return {
    color: el.color ?? DEFAULT_COLOR,
  };
}
