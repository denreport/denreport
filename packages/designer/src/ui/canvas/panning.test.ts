import { describe, expect, it } from "vitest";
import { isPanKeySource, panScrollTarget } from "./panning";

describe("panScrollTarget", () => {
  const origin = { pointerX: 100, pointerY: 80, scrollLeft: 50, scrollTop: 40 };

  it("ポインタを右下へ動かすと scroll は左上方向（減少）へ動く", () => {
    const target = panScrollTarget(origin, 140, 120);
    expect(target.left).toBeLessThan(origin.scrollLeft);
    expect(target.top).toBeLessThan(origin.scrollTop);
    expect(target).toEqual({ left: 10, top: 0 });
  });

  it("移動量 0 なら origin のまま", () => {
    const target = panScrollTarget(origin, origin.pointerX, origin.pointerY);
    expect(target).toEqual({ left: origin.scrollLeft, top: origin.scrollTop });
  });

  it("負のスクロール目標もそのまま返す（クランプはブラウザ任せ）", () => {
    const target = panScrollTarget(origin, 500, 400);
    expect(target.left).toBeLessThan(0);
    expect(target.top).toBeLessThan(0);
  });
});

describe("isPanKeySource", () => {
  it("input では false", () => {
    expect(isPanKeySource(document.createElement("input"))).toBe(false);
  });

  it("textarea では false", () => {
    expect(isPanKeySource(document.createElement("textarea"))).toBe(false);
  });

  it("contentEditable では false", () => {
    // jsdom does not implement isContentEditable, so directly override the getter to verify the branch
    const div = document.createElement("div");
    Object.defineProperty(div, "isContentEditable", { value: true });
    expect(isPanKeySource(div)).toBe(false);
  });

  it("button では false", () => {
    expect(isPanKeySource(document.createElement("button"))).toBe(false);
  });

  it("button の子要素からでも false", () => {
    const button = document.createElement("button");
    const icon = document.createElement("span");
    button.append(icon);
    expect(isPanKeySource(icon)).toBe(false);
  });

  it("role=dialog の中では false", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const inner = document.createElement("div");
    dialog.append(inner);
    expect(isPanKeySource(inner)).toBe(false);
  });

  it("paper 相当の div では true", () => {
    const paper = document.createElement("div");
    paper.className = "dr-paper";
    expect(isPanKeySource(paper)).toBe(true);
  });

  it("null では true", () => {
    expect(isPanKeySource(null)).toBe(true);
  });
});
