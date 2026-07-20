import type {
  CharWidthEm,
  IrAlign,
  IrFont,
  IrPage,
  IrStrokeStyle,
  LoweredElement,
  LoweredTextElement,
} from "@denreport/core";
import {
  layoutTextLines,
  resolveFontSlot,
  STROKE_DASH_MM,
} from "@denreport/core";
import type { ReactNode } from "react";
import { useMessages } from "../../i18n/context";
import { PT_TO_MM, textBaselinesMm } from "../../state/preview";
import type { PreviewFont, PreviewFontSet } from "./preview-font";

// Approximate value used for system-font fallback rendering before the font loads or on failure. PreviewFont supplies the measured value
const FALLBACK_ASCENT_PER_EM = 0.88;
// When there's no measured char width, don't wrap (prefer the traditional overflow over wrapping at the wrong position)
const FALLBACK_CHAR_WIDTH_EM: CharWidthEm = () => 0;

const FALLBACK_PREVIEW_FONT: PreviewFont = {
  family: "",
  ascentPerEm: FALLBACK_ASCENT_PER_EM,
  charWidths: FALLBACK_CHAR_WIDTH_EM,
};

/** To reuse core's degradation rules as-is, map to a pseudo IrFont that has only the defined slots and resolve against it */
function previewFontFor(
  fonts: PreviewFontSet,
  el: LoweredTextElement,
): PreviewFont {
  const pseudoFont: IrFont = {
    regular: "regular",
    ...(fonts.bold !== undefined ? { bold: "bold" } : {}),
    ...(fonts.italic !== undefined ? { italic: "italic" } : {}),
    ...(fonts.boldItalic !== undefined ? { boldItalic: "boldItalic" } : {}),
  };
  const slot = resolveFontSlot(pseudoFont, el.fontWeight, el.fontStyle);
  return fonts[slot] ?? fonts.regular;
}

const TEXT_ANCHORS: Readonly<Record<IrAlign, "start" | "middle" | "end">> = {
  left: "start",
  center: "middle",
  right: "end",
  justify: "start",
};

function dasharrayOf(strokeStyle: IrStrokeStyle): string | undefined {
  if (strokeStyle === "solid") return undefined;
  return STROKE_DASH_MM[strokeStyle].join(" ");
}

// SVG's rotate(θ cx cy) is clockwise in a y-down coordinate system = same direction as IR's rotate
function rotationTransform(el: LoweredElement): string | undefined {
  if (el.rotate === 0) return undefined;
  const center =
    el.type === "line"
      ? el.orientation === "horizontal"
        ? { x: el.x + el.length / 2, y: el.y }
        : { x: el.x, y: el.y + el.length / 2 }
      : { x: el.x + el.w / 2, y: el.y + el.h / 2 };
  return `rotate(${el.rotate} ${center.x} ${center.y})`;
}

function anchorX(el: LoweredTextElement): number {
  switch (el.align) {
    case "left":
    case "justify":
      return el.x;
    case "center":
      return el.x + el.w / 2;
    case "right":
      return el.x + el.w;
  }
}

// A schematic pattern that does not actually encode the barcode (same visual representation as BarcodeSketch; scannability of the value is not guaranteed)
const BARCODE_BAR_WEIGHTS: readonly number[] = [
  3, 2, 1, 2, 2, 1, 3, 1, 2, 3, 1, 2,
];

function barcodeBars(box: {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}): ReactNode {
  const total = BARCODE_BAR_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
  const unit = box.w / total;
  let cursor = box.x;
  const bars: ReactNode[] = [];
  BARCODE_BAR_WEIGHTS.forEach((weight, i) => {
    const barWidth = weight * unit;
    if (i % 2 === 0) {
      bars.push(
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: the pattern is fixed and never reordered
          key={i}
          x={cursor}
          y={box.y}
          width={barWidth}
          height={box.h}
          fill="currentColor"
        />,
      );
    }
    cursor += barWidth;
  });
  return bars;
}

function qrFinderSquares(box: {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}): ReactNode {
  const size = Math.min(box.w, box.h) * 0.22;
  const inset = Math.min(box.w, box.h) * 0.08;
  const strokeWidth = size * 0.28;
  const corners = [
    { x: box.x + inset, y: box.y + inset },
    { x: box.x + box.w - inset - size, y: box.y + inset },
    { x: box.x + inset, y: box.y + box.h - inset - size },
  ];
  return corners.map((corner) => (
    <rect
      key={`${corner.x}-${corner.y}`}
      x={corner.x}
      y={corner.y}
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
    />
  ));
}

function renderElement(el: LoweredElement, fonts: PreviewFontSet): ReactNode {
  switch (el.type) {
    case "text": {
      const font = previewFontFor(fonts, el);
      const x = anchorX(el);
      const laidOut = layoutTextLines(
        {
          content: el.content,
          widthMm: el.w,
          fontSize: el.fontSize,
          align: el.align,
        },
        font.charWidths,
      );
      const baselines = textBaselinesMm(
        el,
        font.ascentPerEm,
        laidOut.map((line) => line.text),
      );
      return baselines.map((line, lineIndex) => (
        <text
          // biome-ignore lint/suspicious/noArrayIndexKey: lines are exactly layoutTextLines' order and are never reordered
          key={lineIndex}
          x={x}
          y={line.baselineY}
          fontSize={el.fontSize * PT_TO_MM}
          textAnchor={TEXT_ANCHORS[el.align]}
          fontFamily={font.family === "" ? undefined : font.family}
          letterSpacing={
            (laidOut[lineIndex]?.charSpacePt ?? 0) * PT_TO_MM || undefined
          }
          textDecoration={el.underline ? "underline" : undefined}
          fill={el.color}
        >
          {line.text}
        </text>
      ));
    }
    case "line": {
      const x2 = el.orientation === "horizontal" ? el.x + el.length : el.x;
      const y2 = el.orientation === "vertical" ? el.y + el.length : el.y;
      return (
        <line
          x1={el.x}
          y1={el.y}
          x2={x2}
          y2={y2}
          stroke={el.color}
          strokeWidth={el.thickness}
          strokeDasharray={dasharrayOf(el.strokeStyle)}
        />
      );
    }
    case "rect":
      return (
        <rect
          x={el.x}
          y={el.y}
          width={el.w}
          height={el.h}
          rx={el.cornerRadius}
          fill={el.fillColor ?? "none"}
          stroke={el.borderColor}
          strokeWidth={el.borderWidth}
          strokeDasharray={dasharrayOf(el.borderStyle)}
        />
      );
    case "ellipse":
      return (
        <ellipse
          cx={el.x + el.w / 2}
          cy={el.y + el.h / 2}
          rx={el.w / 2}
          ry={el.h / 2}
          fill={el.fillColor ?? "none"}
          stroke={el.borderColor}
          strokeWidth={el.borderWidth}
        />
      );
    case "image":
      return (
        <image
          href={el.src}
          x={el.x}
          y={el.y}
          width={el.w}
          height={el.h}
          preserveAspectRatio="none"
        />
      );
    case "barcode":
      return (
        <>
          <rect
            x={el.x}
            y={el.y}
            width={el.w}
            height={el.h}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.2}
          />
          {el.symbology === "qrcode"
            ? qrFinderSquares(el)
            : barcodeBars({ ...el, h: el.h * 0.7 })}
          <text
            x={el.x + el.w / 2}
            y={el.y + el.h - 1.5}
            fontSize={Math.min(el.h * 0.15, 3)}
            textAnchor="middle"
            fill="currentColor"
          >
            {el.content}
          </text>
        </>
      );
  }
}

/** Renders one page of a LoweredDocument as SVG. Setting the viewBox to the paper size in mm
    makes mm directly usable as the SVG user unit */
export function PreviewPage(props: {
  readonly elements: readonly LoweredElement[];
  readonly page: IrPage;
  readonly fonts: PreviewFontSet | null;
}): ReactNode {
  const { elements, page, fonts } = props;
  const m = useMessages();
  const fontSet = fonts ?? { regular: FALLBACK_PREVIEW_FONT };
  return (
    <svg
      className="apx-preview-svg"
      viewBox={`0 0 ${page.width} ${page.height}`}
      role="img"
      aria-label={m.preview.pageAriaLabel}
    >
      {elements.map((el, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the rendered output is fully re-derived every time, so array position is the only identifier
        <g key={index} transform={rotationTransform(el)}>
          {renderElement(el, fontSet)}
        </g>
      ))}
    </svg>
  );
}
