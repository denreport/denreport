import { describe, expect, it } from "vitest";
import { isPanKeySource, panScrollTarget } from "./panning";

describe("panScrollTarget", () => {
  const origin = { pointerX: 100, pointerY: 80, scrollLeft: 50, scrollTop: 40 };

  it("moving the pointer to the bottom-right moves scroll toward the top-left (decreasing)", () => {
    const target = panScrollTarget(origin, 140, 120);
    expect(target.left).toBeLessThan(origin.scrollLeft);
    expect(target.top).toBeLessThan(origin.scrollTop);
    expect(target).toEqual({ left: 10, top: 0 });
  });

  it("stays at origin when the movement is 0", () => {
    const target = panScrollTarget(origin, origin.pointerX, origin.pointerY);
    expect(target).toEqual({ left: origin.scrollLeft, top: origin.scrollTop });
  });

  it("returns a negative scroll target as-is (clamping is left to the browser)", () => {
    const target = panScrollTarget(origin, 500, 400);
    expect(target.left).toBeLessThan(0);
    expect(target.top).toBeLessThan(0);
  });
});

describe("isPanKeySource", () => {
  it("false for input", () => {
    expect(isPanKeySource(document.createElement("input"))).toBe(false);
  });

  it("false for textarea", () => {
    expect(isPanKeySource(document.createElement("textarea"))).toBe(false);
  });

  it("false for contentEditable", () => {
    // jsdom does not implement isContentEditable, so directly override the getter to verify the branch
    const div = document.createElement("div");
    Object.defineProperty(div, "isContentEditable", { value: true });
    expect(isPanKeySource(div)).toBe(false);
  });

  it("false for button", () => {
    expect(isPanKeySource(document.createElement("button"))).toBe(false);
  });

  it("false even from a child element of button", () => {
    const button = document.createElement("button");
    const icon = document.createElement("span");
    button.append(icon);
    expect(isPanKeySource(icon)).toBe(false);
  });

  it("false inside role=dialog", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const inner = document.createElement("div");
    dialog.append(inner);
    expect(isPanKeySource(inner)).toBe(false);
  });

  it("true for a paper-equivalent div", () => {
    const paper = document.createElement("div");
    paper.className = "dr-paper";
    expect(isPanKeySource(paper)).toBe(true);
  });

  it("true for null", () => {
    expect(isPanKeySource(null)).toBe(true);
  });
});
