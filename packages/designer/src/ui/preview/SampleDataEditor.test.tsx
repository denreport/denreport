import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessagesContext } from "../../i18n/context";
import { en } from "../../i18n/messages/en";
import { SampleDataEditor } from "./SampleDataEditor";

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

describe("SampleDataEditor", () => {
  it("ラベルと生成ボタンを日本語で描画する", () => {
    act(() => {
      root.render(
        <SampleDataEditor
          value=""
          onCommit={vi.fn()}
          onGenerate={vi.fn()}
          parseError={undefined}
        />,
      );
    });
    expect(container.textContent).toContain("サンプルデータ (JSON)");
    expect(buttonByText("bind キーから生成")).not.toBeUndefined();
  });

  it("en の MessagesContext では文言が英語で描画される", () => {
    act(() => {
      root.render(
        <MessagesContext.Provider value={en}>
          <SampleDataEditor
            value=""
            onCommit={vi.fn()}
            onGenerate={vi.fn()}
            parseError={undefined}
          />
        </MessagesContext.Provider>,
      );
    });
    expect(container.textContent).toContain("Sample data (JSON)");
    expect(buttonByText("Generate from bind keys")).not.toBeUndefined();
  });
});
