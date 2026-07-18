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
  it("blur で量子化済みの値を1回だけ commit する", () => {
    const onCommit = vi.fn();
    render(
      <NumberField label="x" value={12} precision={0.1} onCommit={onCommit} />,
    );
    expect(input().value).toBe("12.0");
    setValue(input(), "34.26");
    blur(input());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(34.3);
  });

  it("Enter でも commit する", () => {
    const onCommit = vi.fn();
    render(
      <NumberField label="x" value={12} precision={0.1} onCommit={onCommit} />,
    );
    setValue(input(), "5");
    keyDown(input(), "Enter");
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(5);
  });

  it("Escape はドラフトを破棄して commit しない", () => {
    const onCommit = vi.fn();
    render(
      <NumberField label="x" value={12} precision={0.1} onCommit={onCommit} />,
    );
    setValue(input(), "99");
    keyDown(input(), "Escape");
    expect(onCommit).not.toHaveBeenCalled();
    expect(input().value).toBe("12.0");
  });

  it("非数値・空文字は commit せず現在値に復帰する", () => {
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

  it("量子化後に現在値と同値なら commit しない", () => {
    const onCommit = vi.fn();
    render(
      <NumberField label="x" value={12} precision={0.1} onCommit={onCommit} />,
    );
    setValue(input(), "12.04");
    blur(input());
    expect(onCommit).not.toHaveBeenCalled();
    expect(input().value).toBe("12.0");
  });

  it("precision 1 は整数へ量子化する", () => {
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

  it("外部変更（undo 等）でドラフトを破棄して追従する", () => {
    render(
      <NumberField label="x" value={12} precision={0.1} onCommit={() => {}} />,
    );
    setValue(input(), "7");
    render(
      <NumberField label="x" value={20} precision={0.1} onCommit={() => {}} />,
    );
    expect(input().value).toBe("20.0");
  });

  it("error があるとフィールドがエラー表示になる", () => {
    render(
      <NumberField
        label="x"
        value={12}
        precision={0.1}
        error="用紙の幅を超えています"
        onCommit={() => {}}
      />,
    );
    expect(container.querySelector(".apx-field.is-error")).not.toBeNull();
    expect(container.querySelector(".apx-ferr")?.textContent).toBe(
      "用紙の幅を超えています",
    );
  });

  it("value が null（混在）だと空欄になり placeholder が「混在」になる", () => {
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

  it("混在から値を入力すると、一部要素の現在値と同値でも commit する", () => {
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
  it("blur で1回だけ commit し、同値では commit しない", () => {
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

  it("suggestions は datalist として提示される", () => {
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
  it("Enter は改行のままで、blur で commit する", () => {
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
});

describe("SegmentField", () => {
  it("別の選択肢のクリックで即 commit し、現在値のクリックでは commit しない", () => {
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

  it("value が null（混在）だとどのボタンも is-active にならず、クリックで commit する", () => {
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
  it("値の変更で即 commit する（type=color の入力）", () => {
    const onCommit = vi.fn();
    render(<ColorField label="色" value="#000000" onCommit={onCommit} />);
    expect(input().type).toBe("color");
    expect(input().value).toBe("#000000");
    expect(input().disabled).toBe(false);
    setValue(input(), "#ff0000");
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("#ff0000");
  });

  it("allowNone なしで value が null のとき既定色を表示し、入力は有効なまま（編集可能）", () => {
    const onCommit = vi.fn();
    render(<ColorField label="色" value={null} onCommit={onCommit} />);
    expect(input().value).toBe("#000000");
    expect(input().disabled).toBe(false);
    setValue(input(), "#ff0000");
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("#ff0000");
  });

  it("allowNone かつ value が null のとき入力を無効化する", () => {
    render(
      <ColorField label="色" value={null} allowNone onCommit={() => {}} />,
    );
    expect(input().value).toBe("#000000");
    expect(input().disabled).toBe(true);
  });

  it("allowNone なし（既定）では「なし」トグルを出さない", () => {
    render(<ColorField label="色" value="#000000" onCommit={() => {}} />);
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it("allowNone ではチェックで null を commit し、外すと表示中の色を commit する", () => {
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

  it("noneLabel を指定するとトグルの表示文言が変わる", () => {
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
  it("選択の変更で commit する", () => {
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
