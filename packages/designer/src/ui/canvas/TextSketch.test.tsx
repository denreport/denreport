import type { CharWidthEm } from "@denreport/core";
import { PT_TO_MM } from "@denreport/core";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TextSketch } from "./TextSketch";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const CONST_WIDTHS: CharWidthEm = () => 0.1;

function widthMmFor(widthPt: number): number {
  return widthPt * PT_TO_MM;
}

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

function render(props: Parameters<typeof TextSketch>[0]): void {
  act(() => {
    root.render(<TextSketch {...props} />);
  });
}

function lineTexts(): string[] {
  return [...container.querySelectorAll(".apx-text-line")].map(
    (n) => n.textContent ?? "",
  );
}

describe("TextSketch — charWidths が null（未到着・読込失敗）", () => {
  it("行分割せず生テキストのまま描画する", () => {
    render({
      content: "本文",
      widthMm: 40,
      fontSize: 10,
      align: "left",
      charWidths: null,
    });
    expect(container.querySelectorAll(".apx-text-line")).toHaveLength(0);
    expect(container.textContent).toBe("本文");
  });

  it("bind 指定でも .apx-bind の生テキストのまま描画する", () => {
    render({
      content: "{n} / {N}",
      widthMm: 40,
      fontSize: 10,
      align: "left",
      charWidths: null,
      bind: true,
    });
    expect(container.querySelectorAll(".apx-text-line")).toHaveLength(0);
    expect(container.querySelector(".apx-bind")?.textContent).toBe("{n} / {N}");
  });
});

describe("TextSketch — 折り返し", () => {
  it("実効幅を超える content を layoutTextLines で行分割する", () => {
    render({
      content: "abcdef",
      widthMm: widthMmFor(3.2),
      fontSize: 10,
      align: "left",
      charWidths: CONST_WIDTHS,
    });
    expect(lineTexts()).toEqual(["abc", "def"]);
    for (const line of container.querySelectorAll(".apx-text-line")) {
      expect((line as HTMLElement).style.getPropertyValue("--cs")).toBe("");
    }
  });
});

describe("TextSketch — justify", () => {
  it("行の実測幅が実効幅未満なら --cs に charSpacePt を持つ", () => {
    render({
      content: "abcdef",
      widthMm: widthMmFor(3.5),
      fontSize: 10,
      align: "justify",
      charWidths: CONST_WIDTHS,
    });
    expect(lineTexts()).toEqual(["abc", "def"]);
    const expectedCharSpacePt = (3.5 - 3) / (3 - 1);
    for (const line of container.querySelectorAll(".apx-text-line")) {
      expect(
        Number((line as HTMLElement).style.getPropertyValue("--cs")),
      ).toBeCloseTo(expectedCharSpacePt, 6);
    }
  });

  it("非 justify の行は --cs を出さない", () => {
    render({
      content: "abc",
      widthMm: widthMmFor(10),
      fontSize: 10,
      align: "left",
      charWidths: CONST_WIDTHS,
    });
    const line = container.querySelector(".apx-text-line") as HTMLElement;
    expect(line.style.getPropertyValue("--cs")).toBe("");
  });
});

describe("TextSketch — 空行", () => {
  it("空行は NBSP を入れて行ボックスの高さを保つ", () => {
    render({
      content: "a\n\nb",
      widthMm: widthMmFor(100),
      fontSize: 10,
      align: "left",
      charWidths: CONST_WIDTHS,
    });
    const lines = [...container.querySelectorAll(".apx-text-line")];
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.textContent)).toEqual(["a", " ", "b"]);
  });
});

describe("TextSketch — bind", () => {
  it("各行を span.apx-bind に包む", () => {
    render({
      content: "a\nb",
      widthMm: widthMmFor(100),
      fontSize: 10,
      align: "left",
      charWidths: CONST_WIDTHS,
      bind: true,
    });
    const lines = [...container.querySelectorAll(".apx-text-line")];
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.querySelector(".apx-bind")).not.toBeNull();
    }
  });
});
