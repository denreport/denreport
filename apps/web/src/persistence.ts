import type { Designer } from "@denreport/designer";

export const IR_STORAGE_KEY = "denreport-designer.ir";
export const SAMPLE_DATA_STORAGE_KEY = "denreport-designer.sample-data";
export const AUTOSAVE_DEBOUNCE_MS = 500;

/** 起動時の IR 復元。値なし → "blank"、成功 → "restored"、破損・バージョン不一致 → "invalid"。
    "invalid" でも保存値は消さない（次の自動保存で上書きされるまで救出の機会を残す） */
export function restoreIr(
  designer: Pick<Designer, "loadIr">,
  storage: Storage,
): "blank" | "restored" | "invalid" {
  const stored = storage.getItem(IR_STORAGE_KEY);
  if (stored === null) {
    return "blank";
  }
  return designer.loadIr(stored).ok ? "restored" : "invalid";
}

/** 変更通知を 500ms トレーリングデバウンスで localStorage へ書く自動保存の配線。
    setItem の失敗（QuotaExceededError 等）は onError に渡し、編集は妨げない。
    返り値はリスナー・タイマー・pagehide ハンドラを外す解除関数 */
export function attachAutosave(
  designer: Pick<
    Designer,
    "onChange" | "onSampleDataChange" | "saveIr" | "getSampleData"
  >,
  storage: Storage,
  win: Window,
  onError: (error: unknown) => void,
): () => void {
  const channels: readonly {
    readonly key: string;
    readonly read: () => string;
    readonly listen: (listener: () => void) => () => void;
  }[] = [
    {
      key: IR_STORAGE_KEY,
      read: () => designer.saveIr(),
      listen: (listener) => designer.onChange(listener),
    },
    {
      key: SAMPLE_DATA_STORAGE_KEY,
      read: () => designer.getSampleData(),
      listen: (listener) => designer.onSampleDataChange(listener),
    },
  ];

  const flushes: (() => void)[] = [];
  const cleanups: (() => void)[] = [];
  for (const channel of channels) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const write = (): void => {
      try {
        storage.setItem(channel.key, channel.read());
      } catch (error) {
        onError(error);
      }
    };
    const unlisten = channel.listen(() => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = null;
        write();
      }, AUTOSAVE_DEBOUNCE_MS);
    });
    flushes.push(() => {
      if (timer === null) {
        return;
      }
      clearTimeout(timer);
      timer = null;
      write();
    });
    cleanups.push(() => {
      unlisten();
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    });
  }

  // デバウンスだけでは最後の編集から 500ms 以内のタブ閉じで直近の編集が失われるため、
  // pagehide で未書き込み分を即時書き込む
  const onPageHide = (): void => {
    for (const flush of flushes) {
      flush();
    }
  };
  win.addEventListener("pagehide", onPageHide);

  return () => {
    win.removeEventListener("pagehide", onPageHide);
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
