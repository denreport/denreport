import type { CharWidthEm, IrAlign } from "@denreport/core";
import { layoutTextLines } from "@denreport/core";
import type { CSSProperties, ReactNode } from "react";
import { useMemo } from "react";

/** text / pageNumber の模式表示。フォント計量が揃っていれば layoutTextLines の行単位で
    描画し、justify の字間（--cs → letter-spacing）を反映する */
export function TextSketch(props: {
  readonly content: string;
  readonly widthMm: number;
  readonly fontSize: number;
  readonly align: IrAlign;
  readonly charWidths: CharWidthEm | null;
  readonly bind?: boolean;
}): ReactNode {
  const { content, widthMm, fontSize, align, charWidths, bind = false } = props;
  const lines = useMemo(
    () =>
      charWidths === null
        ? null
        : layoutTextLines({ content, widthMm, fontSize, align }, charWidths),
    [content, widthMm, fontSize, align, charWidths],
  );

  if (lines === null) {
    // 計量が未到着・読込失敗の間は従来どおりブラウザ折り返しで表示する
    return bind ? <span className="apx-bind">{content}</span> : content;
  }

  return lines.map((line, i) => (
    <div
      // biome-ignore lint/suspicious/noArrayIndexKey: 行は layoutTextLines の並びそのもので並び替えが起きない
      key={i}
      className="apx-text-line"
      style={
        line.charSpacePt !== 0
          ? ({ "--cs": line.charSpacePt } as CSSProperties)
          : undefined
      }
    >
      {line.text === "" ? (
        " " /* 空行でも行ボックスの高さを保つ */
      ) : bind ? (
        <span className="apx-bind">{line.text}</span>
      ) : (
        line.text
      )}
    </div>
  ));
}
