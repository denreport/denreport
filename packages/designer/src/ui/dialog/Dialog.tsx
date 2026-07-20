import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

function focusablesIn(dialog: HTMLElement): HTMLElement[] {
  return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
}

/** Shared component for confirmation, error, and export-style modals. Esc calls onClose,
    but clicking the scrim does not close it (to prevent accidental dismissal of confirmation
    dialogs). Focus cycles within the dialog via Tab / Shift+Tab */
export function Dialog(props: {
  /** Heading and aria-label */
  readonly title: string;
  readonly onClose: () => void;
  /** Button row */
  readonly footer: ReactNode;
  /** true = 560px width (for export) */
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
    <div className="dr-dialog-scrim">
      <div
        ref={dialogRef}
        className={`dr-dialog${wide === true ? " dr-dialog-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="dr-dialog-h">{title}</div>
        <div className="dr-dialog-b">{children}</div>
        <div className="dr-dialog-f">{footer}</div>
      </div>
    </div>
  );
}
