import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessagesContext } from "../../i18n/context";
import { en } from "../../i18n/messages/en";
import type { SampleScenarioSet } from "../../state/sample-scenarios";
import { ScenarioBar } from "./ScenarioBar";

const SCENARIOS: SampleScenarioSet = {
  items: [{ id: "s1", name: "シナリオ1", json: "" }],
  activeId: "s1",
};

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function buttonByText(text: string): HTMLButtonElement {
  const button = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find((b) => b.textContent === text);
  if (button === undefined) {
    throw new Error(`ボタンがない: ${text}`);
  }
  return button;
}

describe("ScenarioBar", () => {
  it("renders the add/duplicate/delete buttons and aria-labels in Japanese", () => {
    act(() => {
      root.render(
        <ScenarioBar
          scenarios={SCENARIOS}
          onSelect={vi.fn()}
          onAdd={vi.fn()}
          onDuplicate={vi.fn()}
          onRemove={vi.fn()}
          onRename={vi.fn()}
        />,
      );
    });
    expect(
      container.querySelector('select[aria-label="サンプルデータのシナリオ"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('input[aria-label="シナリオ名"]'),
    ).not.toBeNull();
    expect(buttonByText("追加")).not.toBeUndefined();
    expect(buttonByText("複製")).not.toBeUndefined();
    expect(buttonByText("削除")).not.toBeUndefined();
  });

  it("renders text in English under the en MessagesContext", () => {
    act(() => {
      root.render(
        <MessagesContext.Provider value={en}>
          <ScenarioBar
            scenarios={SCENARIOS}
            onSelect={vi.fn()}
            onAdd={vi.fn()}
            onDuplicate={vi.fn()}
            onRemove={vi.fn()}
            onRename={vi.fn()}
          />
        </MessagesContext.Provider>,
      );
    });
    expect(
      container.querySelector('select[aria-label="Sample data scenario"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('input[aria-label="Scenario name"]'),
    ).not.toBeNull();
    expect(buttonByText("Add")).not.toBeUndefined();
    expect(buttonByText("Duplicate")).not.toBeUndefined();
    expect(buttonByText("Delete")).not.toBeUndefined();
  });
});
