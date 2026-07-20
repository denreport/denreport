import type { CharWidthEm, IrAlign } from "@denreport/core";
import { layoutTextLines } from "@denreport/core";
import type { CSSProperties, ReactNode } from "react";
import { useMemo } from "react";

/** Schematic display for text / pageNumber. When font metrics are available, renders line by line
    using layoutTextLines, and reflects justify's character spacing (--cs → letter-spacing) */
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
    // While metrics haven't arrived yet or failed to load, display with the browser's normal wrapping as before
    return bind ? <span className="apx-bind">{content}</span> : content;
  }

  return lines.map((line, i) => (
    <div
      // biome-ignore lint/suspicious/noArrayIndexKey: lines are exactly layoutTextLines's ordering, and reordering never happens
      key={i}
      className="apx-text-line"
      style={
        line.charSpacePt !== 0
          ? ({ "--cs": line.charSpacePt } as CSSProperties)
          : undefined
      }
    >
      {line.text === "" ? (
        " " /* keeps the line box's height even for an empty line */
      ) : bind ? (
        <span className="apx-bind">{line.text}</span>
      ) : (
        line.text
      )}
    </div>
  ));
}
