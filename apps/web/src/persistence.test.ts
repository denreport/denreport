import type { CompatTargetId } from "@denreport/designer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTOSAVE_DEBOUNCE_MS,
  attachAutosave,
  EXPORT_TARGET_STORAGE_KEY,
  IR_STORAGE_KEY,
  LOCALE_STORAGE_KEY,
  restoreExportTarget,
  restoreIr,
  restoreLocale,
  SAMPLE_DATA_STORAGE_KEY,
} from "./persistence";

interface StubStorage extends Storage {
  failNextSetWith(error: unknown): void;
}

function createStubStorage(): StubStorage {
  const map = new Map<string, string>();
  let nextError: { readonly error: unknown } | null = null;
  const stub = {
    failNextSetWith(error: unknown): void {
      nextError = { error };
    },
    get length(): number {
      return map.size;
    },
    clear(): void {
      map.clear();
    },
    getItem(key: string): string | null {
      return map.get(key) ?? null;
    },
    key(index: number): string | null {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string): void {
      map.delete(key);
    },
    setItem(key: string, value: string): void {
      if (nextError !== null) {
        const { error } = nextError;
        nextError = null;
        throw error;
      }
      map.set(key, value);
    },
  };
  return stub as StubStorage;
}

function createFakeDesigner() {
  const changeListeners = new Set<() => void>();
  const sampleListeners = new Set<() => void>();
  const exportTargetListeners = new Set<() => void>();
  const localeListeners = new Set<() => void>();
  let ir = '{"version":"1.0"}';
  let sampleData = '{"a":1}';
  let exportTarget: CompatTargetId = "pdfme";
  let locale: "ja" | "en" = "ja";
  return {
    designer: {
      saveIr: (): string => ir,
      getSampleData: (): string => sampleData,
      getExportTarget: (): CompatTargetId => exportTarget,
      getLocale: (): "ja" | "en" => locale,
      onChange: (listener: () => void): (() => void) => {
        changeListeners.add(listener);
        return () => {
          changeListeners.delete(listener);
        };
      },
      onSampleDataChange: (listener: () => void): (() => void) => {
        sampleListeners.add(listener);
        return () => {
          sampleListeners.delete(listener);
        };
      },
      onExportTargetChange: (listener: () => void): (() => void) => {
        exportTargetListeners.add(listener);
        return () => {
          exportTargetListeners.delete(listener);
        };
      },
      onLocaleChange: (listener: () => void): (() => void) => {
        localeListeners.add(listener);
        return () => {
          localeListeners.delete(listener);
        };
      },
    },
    setIr(json: string): void {
      ir = json;
    },
    setSampleData(json: string): void {
      sampleData = json;
    },
    setExportTarget(target: CompatTargetId): void {
      exportTarget = target;
    },
    setLocale(next: "ja" | "en"): void {
      locale = next;
    },
    emitChange(): void {
      for (const listener of [...changeListeners]) {
        listener();
      }
    },
    emitSampleDataChange(): void {
      for (const listener of [...sampleListeners]) {
        listener();
      }
    },
    emitExportTargetChange(): void {
      for (const listener of [...exportTargetListeners]) {
        listener();
      }
    },
    emitLocaleChange(): void {
      for (const listener of [...localeListeners]) {
        listener();
      }
    },
    listenerCount(): number {
      return (
        changeListeners.size +
        sampleListeners.size +
        exportTargetListeners.size +
        localeListeners.size
      );
    },
  };
}

describe("restoreIr", () => {
  it("returns blank and doesn't call loadIr when there's no stored value", () => {
    const storage = createStubStorage();
    const loadIr = vi.fn(() => ({ ok: true }) as const);
    expect(restoreIr({ loadIr }, storage)).toBe("blank");
    expect(loadIr).not.toHaveBeenCalled();
  });

  it("passes the stored value to loadIr and returns restored", () => {
    const storage = createStubStorage();
    storage.setItem(IR_STORAGE_KEY, '{"version":"1.0"}');
    const loadIr = vi.fn(() => ({ ok: true }) as const);
    expect(restoreIr({ loadIr }, storage)).toBe("restored");
    expect(loadIr).toHaveBeenCalledWith('{"version":"1.0"}');
  });

  it("returns invalid and keeps the stored value when loadIr fails", () => {
    const storage = createStubStorage();
    storage.setItem(IR_STORAGE_KEY, "{broken");
    const loadIr = vi.fn(() => ({ ok: false, errors: [] }) as const);
    expect(restoreIr({ loadIr }, storage)).toBe("invalid");
    expect(storage.getItem(IR_STORAGE_KEY)).toBe("{broken");
  });
});

describe("restoreExportTarget", () => {
  it("returns undefined when there's no stored value", () => {
    const storage = createStubStorage();
    expect(restoreExportTarget(storage)).toBeUndefined();
  });

  it("returns a valid stored value as-is", () => {
    const storage = createStubStorage();
    storage.setItem(EXPORT_TARGET_STORAGE_KEY, "reportlab");
    expect(restoreExportTarget(storage)).toBe("reportlab");
  });

  it("returns undefined for an invalid stored value", () => {
    const storage = createStubStorage();
    storage.setItem(EXPORT_TARGET_STORAGE_KEY, "excel");
    expect(restoreExportTarget(storage)).toBeUndefined();
  });
});

describe("restoreLocale", () => {
  it("returns undefined when there's no stored value", () => {
    const storage = createStubStorage();
    expect(restoreLocale(storage)).toBeUndefined();
  });

  it("returns a valid stored value as-is", () => {
    const storage = createStubStorage();
    storage.setItem(LOCALE_STORAGE_KEY, "en");
    expect(restoreLocale(storage)).toBe("en");
  });

  it("returns undefined for an invalid stored value", () => {
    const storage = createStubStorage();
    storage.setItem(LOCALE_STORAGE_KEY, "fr");
    expect(restoreLocale(storage)).toBeUndefined();
  });
});

describe("attachAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rapid-fire onChange writes saveIr()'s value once after the debounce", () => {
    const fake = createFakeDesigner();
    const storage = createStubStorage();
    const setItem = vi.spyOn(storage, "setItem");
    attachAutosave(fake.designer, storage, window, () => {});

    fake.setIr('{"v":1}');
    fake.emitChange();
    fake.emitChange();
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS - 1);
    fake.emitChange();
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS - 1);
    expect(setItem).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(storage.getItem(IR_STORAGE_KEY)).toBe('{"v":1}');
  });

  it("the IR and sample-data timers are independent", () => {
    const fake = createFakeDesigner();
    const storage = createStubStorage();
    attachAutosave(fake.designer, storage, window, () => {});

    fake.emitChange();
    vi.advanceTimersByTime(300);
    fake.setSampleData('{"b":2}');
    fake.emitSampleDataChange();
    vi.advanceTimersByTime(200);
    expect(storage.getItem(IR_STORAGE_KEY)).toBe('{"version":"1.0"}');
    expect(storage.getItem(SAMPLE_DATA_STORAGE_KEY)).toBeNull();

    vi.advanceTimersByTime(300);
    expect(storage.getItem(SAMPLE_DATA_STORAGE_KEY)).toBe('{"b":2}');
  });

  it("an export-target change also writes getExportTarget()'s value after the debounce", () => {
    const fake = createFakeDesigner();
    const storage = createStubStorage();
    attachAutosave(fake.designer, storage, window, () => {});

    fake.setExportTarget("reportlab");
    fake.emitExportTargetChange();
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    expect(storage.getItem(EXPORT_TARGET_STORAGE_KEY)).toBe("reportlab");
  });

  it("a locale change also writes getLocale()'s value after the debounce", () => {
    const fake = createFakeDesigner();
    const storage = createStubStorage();
    attachAutosave(fake.designer, storage, window, () => {});

    fake.setLocale("en");
    fake.emitLocaleChange();
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    expect(storage.getItem(LOCALE_STORAGE_KEY)).toBe("en");
  });

  it("when setItem throws, it's passed to onError and subsequent changes keep saving", () => {
    const fake = createFakeDesigner();
    const storage = createStubStorage();
    const onError = vi.fn();
    attachAutosave(fake.designer, storage, window, onError);

    const quotaError = new Error("quota exceeded");
    storage.failNextSetWith(quotaError);
    fake.emitChange();
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    expect(onError).toHaveBeenCalledWith(quotaError);
    expect(storage.getItem(IR_STORAGE_KEY)).toBeNull();

    fake.setIr('{"v":2}');
    fake.emitChange();
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    expect(storage.getItem(IR_STORAGE_KEY)).toBe('{"v":2}');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("pagehide immediately writes any unwritten changes, without the timer writing again", () => {
    const fake = createFakeDesigner();
    const storage = createStubStorage();
    const setItem = vi.spyOn(storage, "setItem");
    attachAutosave(fake.designer, storage, window, () => {});

    fake.emitChange();
    vi.advanceTimersByTime(100);
    window.dispatchEvent(new Event("pagehide"));
    expect(storage.getItem(IR_STORAGE_KEY)).toBe('{"version":"1.0"}');

    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it("doesn't write on pagehide when there's nothing unwritten", () => {
    const fake = createFakeDesigner();
    const storage = createStubStorage();
    const setItem = vi.spyOn(storage, "setItem");
    attachAutosave(fake.designer, storage, window, () => {});

    window.dispatchEvent(new Event("pagehide"));
    expect(setItem).not.toHaveBeenCalled();
  });

  it("the detach function removes the listeners, timer, and pagehide handler", () => {
    const fake = createFakeDesigner();
    const storage = createStubStorage();
    const setItem = vi.spyOn(storage, "setItem");
    const detach = attachAutosave(fake.designer, storage, window, () => {});
    expect(fake.listenerCount()).toBe(4);

    fake.emitChange();
    detach();
    expect(fake.listenerCount()).toBe(0);

    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    window.dispatchEvent(new Event("pagehide"));
    expect(setItem).not.toHaveBeenCalled();
  });
});
