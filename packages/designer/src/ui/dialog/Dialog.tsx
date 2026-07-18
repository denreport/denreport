import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

function focusablesIn(dialog: HTMLElement): HTMLElement[] {
  return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
}

/** 確認・エラー・書き出し型モーダルの共通部品。Esc で onClose、スクリムクリックでは
    閉じない（確認ダイアログの誤操作防止）。フォーカスは Tab / Shift+Tab で内部を巡回する */
export function Dialog(props: {
  /** 見出しと aria-label */
  readonly title: string;
  readonly onClose: () => void;
  /** ボタン列 */
  readonly footer: ReactNode;
  /** true = 幅 560px（書き出し用） */
  readonly wide?: boolean;
  readonly children: ReactNode;
}): ReactNode {
  const { title, onClose, footer, wide, children } = props;
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    (focusablesIn(dialog)[0] ?? dialog).focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    const focusables = focusablesIn(dialog);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (first === undefined || last === undefined) {
      event.preventDefault();
      return;
    }
    const active = dialog.ownerDocument.activeElement;
    if (event.shiftKey) {
      if (active === first || !dialog.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !dialog.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="apx-dialog-scrim">
      <div
        ref={dialogRef}
        className={`apx-dialog${wide === true ? " apx-dialog-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="apx-dialog-h">{title}</div>
        <div className="apx-dialog-b">{children}</div>
        <div className="apx-dialog-f">{footer}</div>
      </div>
    </div>
  );
}
