import type {
  CharWidthEm,
  IrAlign,
  IrPage,
  IrStrokeStyle,
  LoweredElement,
  LoweredTextElement,
} from "@denreport/core";
import { layoutTextLines, STROKE_DASH_MM } from "@denreport/core";
import type { ReactNode } from "react";
import { PT_TO_MM, textBaselinesMm } from "../../state/preview";
import type { PreviewFont } from "./preview-font";

// フォント読込前・失敗時のシステムフォント代替描画に使う概算値。実測値は PreviewFont が与える
const FALLBACK_ASCENT_PER_EM = 0.88;
// 実測の字幅がないときは折り返しを起こさない（誤った位置で折り返すより従来どおりはみ出す方を選ぶ）
const FALLBACK_CHAR_WIDTH_EM: CharWidthEm = () => 0;

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

// SVG の rotate(θ cx cy) は y 下向き座標系で時計回り = IR の rotate と同じ向き
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

// 実バーコードは符号化しない模式パターン（BarcodeSketch と同じ視覚表現。値の走査可能性は保証しない）
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
          // biome-ignore lint/suspicious/noArrayIndexKey: 固定パターンで並び替えが起きない
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

function renderElement(
  el: LoweredElement,
  ascentPerEm: number,
  charWidthEm: CharWidthEm,
  family: string | undefined,
): ReactNode {
  switch (el.type) {
    case "text": {
      const x = anchorX(el);
      const laidOut = layoutTextLines(
        {
          content: el.content,
          widthMm: el.w,
          fontSize: el.fontSize,
          align: el.align,
        },
        charWidthEm,
      );
      const baselines = textBaselinesMm(
        el,
        ascentPerEm,
        laidOut.map((line) => line.text),
      );
      return baselines.map((line, lineIndex) => (
        <text
          // biome-ignore lint/suspicious/noArrayIndexKey: 行は layoutTextLines の並び順そのもので並び替えが起きない
          key={lineIndex}
          x={x}
          y={line.baselineY}
          fontSize={el.fontSize * PT_TO_MM}
          textAnchor={TEXT_ANCHORS[el.align]}
          fontFamily={family}
          letterSpacing={
            (laidOut[lineIndex]?.charSpacePt ?? 0) * PT_TO_MM || undefined
          }
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

/** LoweredDocument の1ページ分を SVG に描画する。viewBox を用紙 mm にすることで
    mm がそのまま SVG ユーザー単位になる */
export function PreviewPage(props: {
  readonly elements: readonly LoweredElement[];
  readonly page: IrPage;
  readonly font: PreviewFont | null;
}): ReactNode {
  const { elements, page, font } = props;
  const ascentPerEm = font?.ascentPerEm ?? FALLBACK_ASCENT_PER_EM;
  const charWidthEm = font?.charWidths ?? FALLBACK_CHAR_WIDTH_EM;
  return (
    <svg
      className="apx-preview-svg"
      viewBox={`0 0 ${page.width} ${page.height}`}
      role="img"
      aria-label="プレビューページ"
    >
      {elements.map((el, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 展開結果は毎回全再導出され、配列位置が唯一の識別子
        <g key={index} transform={rotationTransform(el)}>
          {renderElement(el, ascentPerEm, charWidthEm, font?.family)}
        </g>
      ))}
    </svg>
  );
}
