import type {
  CompatTargetId,
  Designer,
  DesignerLocale,
} from "@denreport/designer";

export const IR_STORAGE_KEY = "denreport-designer.ir";
export const SAMPLE_DATA_STORAGE_KEY = "denreport-designer.sample-data";
export const EXPORT_TARGET_STORAGE_KEY = "denreport-designer.export-target";
export const LOCALE_STORAGE_KEY = "denreport-designer.locale";
export const AUTOSAVE_DEBOUNCE_MS = 500;

const VALID_EXPORT_TARGETS: readonly CompatTargetId[] = ["pdfme", "reportlab"];
const VALID_LOCALES: readonly DesignerLocale[] = ["ja", "en"];

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

/** 起動時の書き出しターゲット復元。値なし・不正値は undefined を返し、
    Designer 既定（"pdfme"）へのフォールバックに委ねる */
export function restoreExportTarget(
  storage: Storage,
): CompatTargetId | undefined {
  const stored = storage.getItem(EXPORT_TARGET_STORAGE_KEY);
  return VALID_EXPORT_TARGETS.find((id) => id === stored);
}

/** 起動時の言語復元。値なし・不正値は undefined を返し、Designer 既定（"auto"）へのフォールバックに委ねる */
export function restoreLocale(storage: Storage): DesignerLocale | undefined {
  const stored = storage.getItem(LOCALE_STORAGE_KEY);
  return VALID_LOCALES.find((locale) => locale === stored);
}

/** 変更通知を 500ms トレーリングデバウンスで localStorage へ書く自動保存の配線。
    setItem の失敗（QuotaExceededError 等）は onError に渡し、編集は妨げない。
    返り値はリスナー・タイマー・pagehide ハンドラを外す解除関数 */
export function attachAutosave(
  designer: Pick<
    Designer,
    | "onChange"
    | "onSampleDataChange"
    | "onExportTargetChange"
    | "onLocaleChange"
    | "saveIr"
    | "getSampleData"
    | "getExportTarget"
    | "getLocale"
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
    {
      key: EXPORT_TARGET_STORAGE_KEY,
      read: () => designer.getExportTarget(),
      listen: (listener) => designer.onExportTargetChange(listener),
    },
    {
      key: LOCALE_STORAGE_KEY,
      read: () => designer.getLocale(),
      listen: (listener) => designer.onLocaleChange(listener),
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
