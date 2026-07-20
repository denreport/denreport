import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TABLE_FRAME_WIDTH, TABLE_GRID_WIDTH } from "@denreport/core";
import { describe, expect, it } from "vitest";

// vitest runs with the package root as cwd
const css = readFileSync(join(process.cwd(), "src/ui/styles/app.css"), "utf-8");
const FRAME_W = String(TABLE_FRAME_WIDTH).replace(".", "\\.");
const GRID_W = String(TABLE_GRID_WIDTH).replace(".", "\\.");

/** Extract the declaration block body for a selector (target selector must be a single standalone rule) */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/\./g, "\\.");
  const match = css.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`));
  if (!match) throw new Error(`selector not found in app.css: ${selector}`);
  return match[0];
}

// Don't let rules/borders that collapse to sub-pixel and vanish at low zoom fall below 1px on screen
describe("app.css の低ズーム時の枠線最低太さクランプ", () => {
  it.each([
    [
      ".dr-tbl-hline",
      new RegExp(
        String.raw`border-top:\s*max\(1px, calc\(var\(--grid-w, ${GRID_W}\) \* var\(--mm\)\)\)\s+var\(--grid-ls, solid\)`,
      ),
    ],
    [
      ".dr-tbl-vline",
      new RegExp(
        String.raw`border-left:\s*max\(1px, calc\(var\(--grid-w, ${GRID_W}\) \* var\(--mm\)\)\)\s+var\(--grid-ls, solid\)`,
      ),
    ],
    [
      ".dr-el-line-h",
      /border-top:\s*max\(1px, calc\(var\(--t, 0\.3\) \* var\(--mm\)\)\)/,
    ],
    [
      ".dr-el-line-v",
      /border-left:\s*max\(1px, calc\(var\(--t, 0\.3\) \* var\(--mm\)\)\)/,
    ],
    [
      ".dr-el-rect",
      /border-width:\s*max\(1px, calc\(var\(--bw, 0\.3\) \* var\(--mm\)\)\)/,
    ],
    [
      ".dr-el-ellipse",
      /border-width:\s*max\(1px, calc\(var\(--bw, 0\.3\) \* var\(--mm\)\)\)/,
    ],
    [
      ".dr-tbl-frame",
      new RegExp(
        String.raw`border:\s*max\(1px, calc\(var\(--frame-w, ${FRAME_W}\) \* var\(--mm\)\)\) var\(--frame-ls, solid\)\s+var\(--paper-text\)`,
      ),
    ],
  ])("%s は max(1px, ...) で下限クランプされる", (selector, pattern) => {
    expect(ruleBody(selector)).toMatch(pattern);
  });
});

// The outer frame is drawn over a position covering all internal table elements, so let click/double-click operations pass through
describe("app.css の表の外枠は選択・編集操作をブロックしない", () => {
  it(".dr-tbl-frame は inset:0 かつ pointer-events:none", () => {
    const body = ruleBody(".dr-tbl-frame");
    expect(body).toMatch(/inset:\s*0;/);
    expect(body).toMatch(/pointer-events:\s*none;/);
  });
});

// borderWidth 0 (no border) is a legitimate state, and the lower-bound clamp must not grow a border for it
describe("app.css の枠線幅 0（枠なし）はクランプしない", () => {
  it.each([".dr-el-rect.is-borderless", ".dr-el-ellipse.is-borderless"])(
    "%s は border-width: 0 を明示する",
    (selector) => {
      expect(ruleBody(selector)).toMatch(/border-width:\s*0;/);
    },
  );
});

// Primary actions like "Export" are differentiated from secondary buttons
// with the CTA-only color plus visual weight (bold, shadow)
describe("app.css の primary ボタンは CTA 専用トークンで視覚的重みを持つ", () => {
  it(".dr-btn-primary は --color-cta 系トークンを使う", () => {
    const body = ruleBody(".dr-btn-primary");
    expect(body).toMatch(/background:\s*var\(--color-cta\);/);
    expect(body).toMatch(/color:\s*var\(--color-on-cta\);/);
    expect(body).toMatch(/font-weight:\s*600;/);
    expect(body).toMatch(/box-shadow:\s*var\(--shadow-raised\);/);
  });

  it(".dr-btn-primary:hover / :active は CTA の hover / active トークンを使う", () => {
    expect(ruleBody(".dr-btn-primary:hover")).toMatch(
      /background:\s*var\(--color-cta-hover\);/,
    );
    expect(ruleBody(".dr-btn-primary:active")).toMatch(
      /background:\s*var\(--color-cta-active\);/,
    );
  });
});

// Resize handles have directional cursors (nwse-resize, etc.), whereas
// the rotation handle alone would fail to convey a rotate operation if it used a hand/grab cursor
describe("app.css の回転ハンドルは回転専用カーソルを持つ", () => {
  it(".dr-h--rotate は grab を使わず SVG data URI のカスタムカーソルを持つ", () => {
    const body = ruleBody(".dr-h--rotate");
    expect(body).not.toMatch(/cursor:\s*grab/);
    expect(body).toMatch(
      /cursor:\s*url\("data:image\/svg\+xml,[^"]+"\)\s*12 12,\s*alias;/,
    );
  });

  it("カーソル画像は 24x24 のホットスポット中心・フォールバック alias を持つ", () => {
    const body = ruleBody(".dr-h--rotate");
    const match = body.match(/cursor:\s*url\("(data:image\/svg\+xml,[^"]+)"\)/);
    const dataUri = match?.[1];
    if (!dataUri) throw new Error("カーソルの data URI が見つからない");
    const svg = decodeURIComponent(dataUri);
    expect(svg).toMatch(/width='24'\s+height='24'/);
    expect(svg).toContain("stroke='black'");
    expect(svg).toContain("stroke='white'");
  });
});
