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
  return [...container.querySelectorAll(".dr-text-line")].map(
    (n) => n.textContent ?? "",
  );
}

describe("TextSketch — charWidths is null (not yet loaded / load failed)", () => {
  it("renders raw text without line-splitting", () => {
    render({
      content: "本文",
      widthMm: 40,
      fontSize: 10,
      align: "left",
      charWidths: null,
    });
    expect(container.querySelectorAll(".dr-text-line")).toHaveLength(0);
    expect(container.textContent).toBe("本文");
  });

  it("renders as raw text inside .dr-bind even when bind is specified", () => {
    render({
      content: "{n} / {N}",
      widthMm: 40,
      fontSize: 10,
      align: "left",
      charWidths: null,
      bind: true,
    });
    expect(container.querySelectorAll(".dr-text-line")).toHaveLength(0);
    expect(container.querySelector(".dr-bind")?.textContent).toBe("{n} / {N}");
  });
});

describe("TextSketch — wrapping", () => {
  it("splits content exceeding the effective width into lines via layoutTextLines", () => {
    render({
      content: "abcdef",
      widthMm: widthMmFor(3.2),
      fontSize: 10,
      align: "left",
      charWidths: CONST_WIDTHS,
    });
    expect(lineTexts()).toEqual(["abc", "def"]);
    for (const line of container.querySelectorAll(".dr-text-line")) {
      expect((line as HTMLElement).style.getPropertyValue("--cs")).toBe("");
    }
  });
});

describe("TextSketch — justify", () => {
  it("sets --cs to charSpacePt when a line's measured width is less than the effective width", () => {
    render({
      content: "abcdef",
      widthMm: widthMmFor(3.5),
      fontSize: 10,
      align: "justify",
      charWidths: CONST_WIDTHS,
    });
    expect(lineTexts()).toEqual(["abc", "def"]);
    const expectedCharSpacePt = (3.5 - 3) / (3 - 1);
    for (const line of container.querySelectorAll(".dr-text-line")) {
      expect(
        Number((line as HTMLElement).style.getPropertyValue("--cs")),
      ).toBeCloseTo(expectedCharSpacePt, 6);
    }
  });

  it("does not emit --cs for non-justify lines", () => {
    render({
      content: "abc",
      widthMm: widthMmFor(10),
      fontSize: 10,
      align: "left",
      charWidths: CONST_WIDTHS,
    });
    const line = container.querySelector(".dr-text-line") as HTMLElement;
    expect(line.style.getPropertyValue("--cs")).toBe("");
  });
});

describe("TextSketch — empty lines", () => {
  it("inserts NBSP for empty lines to preserve the line box height", () => {
    render({
      content: "a\n\nb",
      widthMm: widthMmFor(100),
      fontSize: 10,
      align: "left",
      charWidths: CONST_WIDTHS,
    });
    const lines = [...container.querySelectorAll(".dr-text-line")];
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.textContent)).toEqual(["a", " ", "b"]);
  });
});

describe("TextSketch — bind", () => {
  it("wraps each line in span.dr-bind", () => {
    render({
      content: "a\nb",
      widthMm: widthMmFor(100),
      fontSize: 10,
      align: "left",
      charWidths: CONST_WIDTHS,
      bind: true,
    });
    const lines = [...container.querySelectorAll(".dr-text-line")];
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.querySelector(".dr-bind")).not.toBeNull();
    }
  });
});
