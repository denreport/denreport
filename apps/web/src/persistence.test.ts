import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTOSAVE_DEBOUNCE_MS,
  attachAutosave,
  IR_STORAGE_KEY,
  restoreIr,
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
  let ir = '{"version":"1.0"}';
  let sampleData = '{"a":1}';
  return {
    designer: {
      saveIr: (): string => ir,
      getSampleData: (): string => sampleData,
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
    },
    setIr(json: string): void {
      ir = json;
    },
    setSampleData(json: string): void {
      sampleData = json;
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
    listenerCount(): number {
      return changeListeners.size + sampleListeners.size;
    },
  };
}

describe("restoreIr", () => {
  it("保存値がなければ blank を返し loadIr を呼ばない", () => {
    const storage = createStubStorage();
    const loadIr = vi.fn(() => ({ ok: true }) as const);
    expect(restoreIr({ loadIr }, storage)).toBe("blank");
    expect(loadIr).not.toHaveBeenCalled();
  });

  it("保存値があれば loadIr に渡し restored を返す", () => {
    const storage = createStubStorage();
    storage.setItem(IR_STORAGE_KEY, '{"version":"1.0"}');
    const loadIr = vi.fn(() => ({ ok: true }) as const);
    expect(restoreIr({ loadIr }, storage)).toBe("restored");
    expect(loadIr).toHaveBeenCalledWith('{"version":"1.0"}');
  });

  it("loadIr が失敗したら invalid を返し保存値は残す", () => {
    const storage = createStubStorage();
    storage.setItem(IR_STORAGE_KEY, "{broken");
    const loadIr = vi.fn(() => ({ ok: false, errors: [] }) as const);
    expect(restoreIr({ loadIr }, storage)).toBe("invalid");
    expect(storage.getItem(IR_STORAGE_KEY)).toBe("{broken");
  });
});

describe("attachAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("onChange の連発はデバウンス後に saveIr() の値を1回だけ書く", () => {
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

  it("IR とサンプルデータのタイマーは独立している", () => {
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

  it("setItem が throw したら onError に渡り、以後の変更でも保存し続ける", () => {
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

  it("pagehide で未書き込み分を即時書き、タイマーの再書き込みはしない", () => {
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

  it("未書き込みがなければ pagehide では書かない", () => {
    const fake = createFakeDesigner();
    const storage = createStubStorage();
    const setItem = vi.spyOn(storage, "setItem");
    attachAutosave(fake.designer, storage, window, () => {});

    window.dispatchEvent(new Event("pagehide"));
    expect(setItem).not.toHaveBeenCalled();
  });

  it("解除関数でリスナー・タイマー・pagehide ハンドラが外れる", () => {
    const fake = createFakeDesigner();
    const storage = createStubStorage();
    const setItem = vi.spyOn(storage, "setItem");
    const detach = attachAutosave(fake.designer, storage, window, () => {});
    expect(fake.listenerCount()).toBe(2);

    fake.emitChange();
    detach();
    expect(fake.listenerCount()).toBe(0);

    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    window.dispatchEvent(new Event("pagehide"));
    expect(setItem).not.toHaveBeenCalled();
  });
});
