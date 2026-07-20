import type { IrDocument } from "@denreport/core";

export interface HistoryEntry {
  readonly document: IrDocument;
  readonly selection: readonly string[];
}

export const HISTORY_LIMIT = 100;

/**
 * The undo/redo stack. Each entry is a snapshot of "the destination to go back/forward to
 * from the current state"; the current state itself is held by the caller (EditorStore).
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
