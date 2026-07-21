import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ColorField,
  NumberField,
  SegmentField,
  SelectField,
  TextAreaField,
  TextField,
} from "./fields";

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

function input(): HTMLInputElement {
  const el = container.querySelector("input");
  if (el === null) {
    throw new Error("input がない");
  }
  return el;
}

function select(): HTMLSelectElement {
  const el = container.querySelector("select");
  if (el === null) {
    throw new Error("select がない");
  }
  return el;
}

function selectValue(el: HTMLSelectElement, value: string): void {
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )?.set?.call(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
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

function keyDown(el: HTMLElement, key: string): void {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

describe("NumberField", () => {
  it("commits the quantized value exactly once on blur", () => {
    const onCommit = vi.fn();
    render(
      <NumberField label="x" value={12} precision={0.1} onCommit={onCommit} />,
    );
    expect(input().value).toBe("12.0");
    setValue(input(), "34.26");
    blur(input());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(34.3);
  });

  it("commits on Enter too", () => {
    const onCommit = vi.fn();
    render(
      <NumberField label="x" value={12} precision={0.1} onCommit={onCommit} />,
    );
    setValue(input(), "5");
    keyDown(input(), "Enter");
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(5);
  });

  it("discards the draft and does not commit on Escape", () => {
    const onCommit = vi.fn();
    render(
      <NumberField label="x" value={12} precision={0.1} onCommit={onCommit} />,
    );
    setValue(input(), "99");
    keyDown(input(), "Escape");
    expect(onCommit).not.toHaveBeenCalled();
    expect(input().value).toBe("12.0");
  });

  it("does not commit non-numeric or empty input, and reverts to the current value", () => {
    const onCommit = vi.fn();
    render(
      <NumberField label="x" value={12} precision={0.1} onCommit={onCommit} />,
    );
    setValue(input(), "abc");
    blur(input());
    expect(onCommit).not.toHaveBeenCalled();
    expect(input().value).toBe("12.0");
    setValue(input(), "");
    blur(input());
    expect(onCommit).not.toHaveBeenCalled();
    expect(input().value).toBe("12.0");
  });

  it("does not commit when the quantized value equals the current value", () => {
    const onCommit = vi.fn();
    render(
      <NumberField label="x" value={12} precision={0.1} onCommit={onCommit} />,
    );
    setValue(input(), "12.04");
    blur(input());
    expect(onCommit).not.toHaveBeenCalled();
    expect(input().value).toBe("12.0");
  });

  it("quantizes to an integer when precision is 1", () => {
    const onCommit = vi.fn();
    render(
      <NumberField
        label="minRows"
        value={3}
        precision={1}
        onCommit={onCommit}
      />,
    );
    expect(input().value).toBe("3");
    setValue(input(), "4.6");
    blur(input());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(5);
  });

  it("keeps display and quantization consistent for a non-power-of-10 step like precision 0.05, and does not commit on blur without editing", () => {
    const onCommit = vi.fn();
    render(
      <NumberField
        label="gridWidth"
        value={0.25}
        precision={0.05}
        onCommit={onCommit}
      />,
    );
    expect(input().value).toBe("0.25");
    blur(input());
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("discards the draft and follows external changes (e.g. undo)", () => {
    render(
      <NumberField label="x" value={12} precision={0.1} onCommit={() => {}} />,
    );
    setValue(input(), "7");
    render(
      <NumberField label="x" value={20} precision={0.1} onCommit={() => {}} />,
    );
    expect(input().value).toBe("20.0");
  });

  it("shows the field as an error when error is set", () => {
    render(
      <NumberField
        label="x"
        value={12}
        precision={0.1}
        error="用紙の幅を超えています"
        onCommit={() => {}}
      />,
    );
    expect(container.querySelector(".dr-field.is-error")).not.toBeNull();
    expect(container.querySelector(".dr-ferr")?.textContent).toBe(
      "用紙の幅を超えています",
    );
  });

  it("becomes blank with placeholder 「混在」 when value is null (mixed)", () => {
    render(
      <NumberField
        label="x"
        value={null}
        precision={0.1}
        onCommit={() => {}}
      />,
    );
    expect(input().value).toBe("");
    expect(input().placeholder).toBe("混在");
  });

  it("commits even when the entered value matches the current value of some elements, when starting from mixed state", () => {
    const onCommit = vi.fn();
    render(
      <NumberField
        label="x"
        value={null}
        precision={0.1}
        onCommit={onCommit}
      />,
    );
    setValue(input(), "12");
    blur(input());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(12);
  });
});

describe("TextField", () => {
  it("commits exactly once on blur, and does not commit for the same value", () => {
    const onCommit = vi.fn();
    render(<TextField label="バインド" value="items" onCommit={onCommit} />);
    setValue(input(), "rows");
    blur(input());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("rows");

    onCommit.mockClear();
    render(<TextField label="バインド" value="items" onCommit={onCommit} />);
    setValue(input(), "items");
    blur(input());
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("presents suggestions as a datalist", () => {
    render(
      <TextField
        label="バインド"
        value=""
        suggestions={["customerName", "items"]}
        onCommit={() => {}}
      />,
    );
    const options = [...container.querySelectorAll("datalist option")].map(
      (option) => option.getAttribute("value"),
    );
    expect(options).toEqual(["customerName", "items"]);
    expect(input().getAttribute("list")).toBe(
      container.querySelector("datalist")?.id,
    );
  });
});

describe("TextAreaField", () => {
  it("keeps Enter as a newline, and commits on blur", () => {
    const onCommit = vi.fn();
    render(<TextAreaField label="テキスト" value="a" onCommit={onCommit} />);
    const textarea = container.querySelector("textarea");
    if (textarea === null) {
      throw new Error("textarea がない");
    }
    keyDown(textarea, "Enter");
    expect(onCommit).not.toHaveBeenCalled();
    setValue(textarea, "a\nb");
    blur(textarea);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("a\nb");
  });

  it("shows the field as an error when error is set", () => {
    render(
      <TextAreaField
        label="テキスト"
        value="a"
        error="参照先の注記が定義されていません"
        onCommit={() => {}}
      />,
    );
    expect(container.querySelector(".dr-field.is-error")).not.toBeNull();
    expect(container.querySelector(".dr-ferr")?.textContent).toBe(
      "参照先の注記が定義されていません",
    );
  });

  it("shows the hint text when hint is set", () => {
    render(
      <TextAreaField
        label="テキスト"
        value="a"
        hint="{#id} で脚注を参照"
        onCommit={() => {}}
      />,
    );
    expect(container.querySelector(".dr-fhint")?.textContent).toBe(
      "{#id} で脚注を参照",
    );
  });
});

describe("SegmentField", () => {
  it("commits immediately on clicking a different option, and does not commit when clicking the current value", () => {
    const onCommit = vi.fn();
    render(
      <SegmentField
        label="整列"
        value="left"
        options={[
          { value: "left", label: "左" },
          { value: "center", label: "中央" },
          { value: "right", label: "右" },
        ]}
        onCommit={onCommit}
      />,
    );
    const buttons = [...container.querySelectorAll("button")];
    const center = buttons.find((b) => b.textContent === "中央");
    const left = buttons.find((b) => b.textContent === "左");
    act(() => {
      left?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onCommit).not.toHaveBeenCalled();
    act(() => {
      center?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("center");
  });

  it("no button becomes is-active when value is null (mixed), and clicking commits", () => {
    const onCommit = vi.fn();
    render(
      <SegmentField
        label="整列"
        value={null}
        options={[
          { value: "left", label: "左" },
          { value: "center", label: "中央" },
          { value: "right", label: "右" },
        ]}
        onCommit={onCommit}
      />,
    );
    expect(container.querySelector("button.is-active")).toBeNull();
    const left = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "左",
    );
    act(() => {
      left?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("left");
  });
});

describe("ColorField", () => {
  it("commits immediately on value change (type=color input)", () => {
    const onCommit = vi.fn();
    render(<ColorField label="色" value="#000000" onCommit={onCommit} />);
    expect(input().type).toBe("color");
    expect(input().value).toBe("#000000");
    expect(input().disabled).toBe(false);
    setValue(input(), "#ff0000");
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("#ff0000");
  });

  it("shows the default color when value is null without allowNone, keeping the input enabled (editable)", () => {
    const onCommit = vi.fn();
    render(<ColorField label="色" value={null} onCommit={onCommit} />);
    expect(input().value).toBe("#000000");
    expect(input().disabled).toBe(false);
    setValue(input(), "#ff0000");
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("#ff0000");
  });

  it("disables the input when allowNone is set and value is null", () => {
    render(
      <ColorField label="色" value={null} allowNone onCommit={() => {}} />,
    );
    expect(input().value).toBe("#000000");
    expect(input().disabled).toBe(true);
  });

  it("does not render a 「なし」 toggle without allowNone (the default)", () => {
    render(<ColorField label="色" value="#000000" onCommit={() => {}} />);
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it("commits null when checked and the displayed color when unchecked, under allowNone", () => {
    const onCommit = vi.fn();
    render(
      <ColorField
        label="塗り色"
        value="#eeeeee"
        allowNone
        onCommit={onCommit}
      />,
    );
    const checkbox = container.querySelector('input[type="checkbox"]');
    if (!(checkbox instanceof HTMLInputElement)) {
      throw new Error("チェックボックスがない");
    }
    expect(checkbox.checked).toBe(false);
    act(() => {
      checkbox.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(null);

    onCommit.mockClear();
    render(
      <ColorField label="塗り色" value={null} allowNone onCommit={onCommit} />,
    );
    const checkbox2 = container.querySelector('input[type="checkbox"]');
    if (!(checkbox2 instanceof HTMLInputElement)) {
      throw new Error("チェックボックスがない");
    }
    expect(checkbox2.checked).toBe(true);
    act(() => {
      checkbox2.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("#000000");
  });

  it("changes the toggle's label text when noneLabel is specified", () => {
    render(
      <ColorField
        label="縞の色"
        value={null}
        allowNone
        noneLabel="網掛けなし"
        onCommit={() => {}}
      />,
    );
    expect(container.textContent).toContain("網掛けなし");
  });
});

describe("SelectField", () => {
  it("commits on selection change", () => {
    const onCommit = vi.fn();
    render(
      <SelectField
        label="線種"
        value="solid"
        options={[
          { value: "solid", label: "実線" },
          { value: "dashed", label: "破線" },
        ]}
        onCommit={onCommit}
      />,
    );
    expect(select().value).toBe("solid");
    const options = [...select().querySelectorAll("option")].map(
      (o) => o.textContent,
    );
    expect(options).toEqual(["実線", "破線"]);
    selectValue(select(), "dashed");
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("dashed");
  });
});
