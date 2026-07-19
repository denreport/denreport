import type { IrDocument } from "@denreport/core";
import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "./history";
import { HISTORY_LIMIT, History } from "./history";

function doc(marker: string): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { regular: marker },
    elements: [],
  };
}

function entry(
  marker: string,
  selection: readonly string[] = [],
): HistoryEntry {
  return { document: doc(marker), selection };
}

describe("History", () => {
  it("undo → redo の往復で文書と選択が復元される", () => {
    const history = new History();
    const before = entry("before", ["a"]);
    const after = entry("after", ["b"]);

    history.push(before);
    const undone = history.undo(after);
    expect(undone).toEqual(before);
    expect(history.canRedo()).toBe(true);

    const redone = undone === undefined ? undefined : history.redo(undone);
    expect(redone).toEqual(after);
  });

  it("新規 push で redo 側が破棄される", () => {
    const history = new History();
    history.push(entry("v1"));
    history.undo(entry("v2"));
    expect(history.canRedo()).toBe(true);

    history.push(entry("v3"));
    expect(history.canRedo()).toBe(false);
    expect(history.canUndo()).toBe(true);
  });

  it("上限到達で最古が捨てられる", () => {
    const history = new History();
    for (let i = 0; i <= HISTORY_LIMIT; i += 1) {
      history.push(entry(`v${i}`));
    }

    let last: HistoryEntry | undefined = entry("current");
    let undoCount = 0;
    while (last !== undefined && history.canUndo()) {
      last = history.undo(last);
      undoCount += 1;
    }
    expect(undoCount).toBe(HISTORY_LIMIT);
    // 最古の v0 は捨てられ、最後に戻れるのは v1
    expect(last?.document.font.regular).toBe("v1");
  });

  it("空スタックの undo / redo は undefined を返し状態を壊さない", () => {
    const history = new History();
    const current = entry("current");
    expect(history.undo(current)).toBeUndefined();
    expect(history.redo(current)).toBeUndefined();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it("clear で両側のスタックが空になる", () => {
    const history = new History();
    history.push(entry("v1"));
    history.undo(entry("v2"));
    history.clear();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });
});
