import type { KeyboardEvent } from "react";
import { useState } from "react";

export interface DraftHandlers {
  readonly draft: string;
  readonly onChange: (raw: string) => void;
  /** Attempts to commit */
  readonly onBlur: () => void;
  /** Enter = commit, Escape = discard and revert to committed */
  readonly onKeyDown: (e: KeyboardEvent) => void;
}

/** Holds the in-progress draft value. Discards the draft and follows along if committed changes externally (e.g. undo) */
export function useDraftValue(
  committed: string,
  commit: (raw: string) => void,
): DraftHandlers {
  const [draft, setDraft] = useState(committed);
  const [prevCommitted, setPrevCommitted] = useState(committed);
  if (prevCommitted !== committed) {
    setPrevCommitted(committed);
    setDraft(committed);
  }

  const finalize = (): void => {
    commit(draft);
    setDraft(committed);
  };

  return {
    draft,
    onChange: setDraft,
    onBlur: finalize,
    onKeyDown: (e) => {
      if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
        if (e.nativeEvent.isComposing) {
          // Don't mistake the Enter that confirms an IME conversion for input confirmation
          return;
        }
        finalize();
      } else if (e.key === "Escape") {
        setDraft(committed);
      }
    },
  };
}
