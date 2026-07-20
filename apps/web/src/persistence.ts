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

/** IR restoration at startup. No stored value -> "blank", success -> "restored",
    corrupted or version mismatch -> "invalid".
    Even on "invalid" the stored value is not cleared (leaving a chance for recovery until the next autosave overwrites it) */
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

/** Export target restoration at startup. Returns undefined when there is no stored value or it is invalid,
    leaving the fallback to the Designer default ("pdfme") */
export function restoreExportTarget(
  storage: Storage,
): CompatTargetId | undefined {
  const stored = storage.getItem(EXPORT_TARGET_STORAGE_KEY);
  return VALID_EXPORT_TARGETS.find((id) => id === stored);
}

/** Locale restoration at startup. Returns undefined when there is no stored value or it is invalid,
    leaving the fallback to the Designer default ("auto") */
export function restoreLocale(storage: Storage): DesignerLocale | undefined {
  const stored = storage.getItem(LOCALE_STORAGE_KEY);
  return VALID_LOCALES.find((locale) => locale === stored);
}

/** Wiring for autosave that writes change notifications to localStorage with a 500ms trailing debounce.
    A setItem failure (e.g. QuotaExceededError) is passed to onError and does not block editing.
    The return value is a detach function that removes the listeners, timers, and the pagehide handler */
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

  // Debouncing alone would lose the most recent edit if the tab is closed within 500ms of the last edit,
  // so pagehide writes out any unwritten changes immediately
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
