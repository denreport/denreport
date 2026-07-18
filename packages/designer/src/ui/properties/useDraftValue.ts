import type { KeyboardEvent } from "react";
import { useState } from "react";

export interface DraftHandlers {
  readonly draft: string;
  readonly onChange: (raw: string) => void;
  /** 確定を試みる */
  readonly onBlur: () => void;
  /** Enter = 確定、Escape = 破棄して committed に戻す */
  readonly onKeyDown: (e: KeyboardEvent) => void;
}

/** 入力中ドラフトの保持。committed が外部（undo 等）で変わったらドラフトを破棄して追従する */
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
          // IME の変換確定の Enter を入力確定と誤認しない
          return;
        }
        finalize();
      } else if (e.key === "Escape") {
        setDraft(committed);
      }
    },
  };
}
