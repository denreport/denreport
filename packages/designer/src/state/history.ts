import type { IrDocument } from "@denreport/core";

export interface HistoryEntry {
  readonly document: IrDocument;
  readonly selection: readonly string[];
}

export const HISTORY_LIMIT = 100;

/**
 * undo/redo スタック。エントリは「現在から戻る/進む先」のスナップショットで、
 * 現在の状態そのものは呼び出し側（EditorStore）が保持する。
 */
export class History {
  #past: HistoryEntry[] = [];
  #future: HistoryEntry[] = [];

  push(entry: HistoryEntry): void {
    this.#past.push(entry);
    this.#future = [];
    if (this.#past.length > HISTORY_LIMIT) {
      this.#past.shift();
    }
  }

  undo(current: HistoryEntry): HistoryEntry | undefined {
    const previous = this.#past.pop();
    if (previous === undefined) {
      return undefined;
    }
    this.#future.push(current);
    return previous;
  }

  redo(current: HistoryEntry): HistoryEntry | undefined {
    const next = this.#future.pop();
    if (next === undefined) {
      return undefined;
    }
    this.#past.push(current);
    return next;
  }

  clear(): void {
    this.#past = [];
    this.#future = [];
  }

  canUndo(): boolean {
    return this.#past.length > 0;
  }

  canRedo(): boolean {
    return this.#future.length > 0;
  }
}
