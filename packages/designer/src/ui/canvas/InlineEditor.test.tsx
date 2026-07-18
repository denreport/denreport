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
  it("初期値を入力へ表示し、マウント時にフォーカスする", () => {
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

  it("multiline=false: 変更後 Enter で onCommit が新しい値で1回だけ呼ばれる", () => {
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

  it("isComposing な Enter は確定しない", () => {
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

  it("multiline=true: Enter では確定せず、blur で確定する", () => {
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

  it("Escape で onCancel が呼ばれ、onCommit は呼ばれない。直後の blur でも二重にならない", () => {
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

  it("入力上の pointerdown・dblclick は親へ伝播しない", () => {
    const onParentPointerDown = vi.fn();
    const onParentDoubleClick = vi.fn();
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: 伝播検証用の親要素（テスト専用）
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
