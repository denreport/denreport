import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InlineEditor } from "./InlineEditor";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

function render(node: ReactNode): void {
  act(() => {
    root.render(node);
  });
}

function field(): HTMLInputElement | HTMLTextAreaElement {
  const el = container.querySelector("input, textarea");
  if (el === null) {
    throw new Error("フィールドがない");
  }
  return el as HTMLInputElement | HTMLTextAreaElement;
}

function setValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function blur(el: HTMLElement): void {
  act(() => {
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}

function keyDown(el: HTMLElement, key: string, isComposing = false): void {
  act(() => {
    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        isComposing,
      } as KeyboardEventInit),
    );
  });
}

const BOX = { x: 10, y: 10, w: 40, h: 8 };

describe("InlineEditor", () => {
  it("displays the initial value in the input and focuses it on mount", () => {
    render(
      <InlineEditor
        box={BOX}
        value="hello"
        multiline={false}
        fontSizePt={10}
        onCommit={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(field().value).toBe("hello");
    expect(document.activeElement).toBe(field());
  });

  it("multiline=false: pressing Enter after a change calls onCommit once with the new value", () => {
    const onCommit = vi.fn();
    render(
      <InlineEditor
        box={BOX}
        value="a"
        multiline={false}
        fontSizePt={10}
        onCommit={onCommit}
        onCancel={() => {}}
      />,
    );
    setValue(field(), "b");
    keyDown(field(), "Enter");
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("b");
  });

  it("an Enter during IME composition does not commit", () => {
    const onCommit = vi.fn();
    render(
      <InlineEditor
        box={BOX}
        value="a"
        multiline={false}
        fontSizePt={10}
        onCommit={onCommit}
        onCancel={() => {}}
      />,
    );
    setValue(field(), "b");
    keyDown(field(), "Enter", true);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("multiline=true: Enter does not commit, blur commits", () => {
    const onCommit = vi.fn();
    render(
      <InlineEditor
        box={BOX}
        value="a"
        multiline
        fontSizePt={10}
        onCommit={onCommit}
        onCancel={() => {}}
      />,
    );
    setValue(field(), "a\nb");
    keyDown(field(), "Enter");
    expect(onCommit).not.toHaveBeenCalled();
    blur(field());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("a\nb");
  });

  it("Escape calls onCancel and not onCommit, and a blur right after does not double-fire", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <InlineEditor
        box={BOX}
        value="a"
        multiline={false}
        fontSizePt={10}
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    keyDown(field(), "Escape");
    blur(field());
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("pointerdown and dblclick on the input do not propagate to the parent", () => {
    const onParentPointerDown = vi.fn();
    const onParentDoubleClick = vi.fn();
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: parent element for propagation verification (test-only)
      <div
        onPointerDown={onParentPointerDown}
        onDoubleClick={onParentDoubleClick}
      >
        <InlineEditor
          box={BOX}
          value="a"
          multiline={false}
          fontSizePt={10}
          onCommit={() => {}}
          onCancel={() => {}}
        />
      </div>,
    );
    act(() => {
      field().dispatchEvent(new Event("pointerdown", { bubbles: true }));
      field().dispatchEvent(new Event("dblclick", { bubbles: true }));
    });
    expect(onParentPointerDown).not.toHaveBeenCalled();
    expect(onParentDoubleClick).not.toHaveBeenCalled();
  });
});
