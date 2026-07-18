import type { IrAlign } from "@denreport/core";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";
import type { MmBox } from "../../state/geometry";

type FieldElement = HTMLTextAreaElement | HTMLInputElement;

export function InlineEditor(props: {
  readonly box: MmBox;
  readonly value: string;
  readonly multiline: boolean;
  readonly fontSizePt: number;
  readonly lineHeight?: number;
  readonly align?: IrAlign;
  readonly onCommit: (raw: string) => void;
  readonly onCancel: () => void;
}): ReactNode {
  const {
    box,
    value,
    multiline,
    fontSizePt,
    lineHeight,
    align,
    onCommit,
    onCancel,
  } = props;
  const fieldRef = useRef<FieldElement | null>(null);
  // Escape → unmount 後に blur が届く経路があるため、確定/キャンセルは一度きりに絞る
  const doneRef = useRef(false);

  useEffect(() => {
    fieldRef.current?.focus();
    fieldRef.current?.select();
  }, []);

  const setRef = (el: FieldElement | null): void => {
    fieldRef.current = el;
  };

  const commit = (): void => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    onCommit(fieldRef.current?.value ?? value);
  };

  const cancel = (): void => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    onCancel();
  };

  const onKeyDown = (e: KeyboardEvent<FieldElement>): void => {
    if (e.key === "Escape") {
      e.stopPropagation();
      cancel();
      return;
    }
    if (!multiline && e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.stopPropagation();
      commit();
    }
  };

  const classes = ["apx-inline-editor"];
  if (align === "center") {
    classes.push("apx-align-center");
  } else if (align === "right") {
    classes.push("apx-align-right");
  }

  const style = {
    "--x": box.x,
    "--y": box.y,
    "--w": box.w,
    "--h": box.h,
    "--fs": fontSizePt,
    lineHeight,
  } as CSSProperties;

  const shared = {
    ref: setRef,
    className: classes.join(" "),
    style,
    defaultValue: value,
    onBlur: commit,
    onKeyDown,
    onPointerDown: (e: { stopPropagation: () => void }) => e.stopPropagation(),
    onDoubleClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
  };

  return multiline ? <textarea {...shared} /> : <input {...shared} />;
}
