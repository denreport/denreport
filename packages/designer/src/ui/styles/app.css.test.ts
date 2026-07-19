import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TABLE_FRAME_WIDTH } from "@denreport/core";
import { describe, expect, it } from "vitest";

// vitest はパッケージルートを cwd として実行される
const css = readFileSync(join(process.cwd(), "src/ui/styles/app.css"), "utf-8");
const FRAME_W = String(TABLE_FRAME_WIDTH).replace(".", "\\.");

/** セレクタの宣言ブロック本文を取り出す（対象セレクタは単独ルールのみ） */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/\./g, "\\.");
  const match = css.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`));
  if (!match) throw new Error(`selector not found in app.css: ${selector}`);
  return match[0];
}

// 低ズームでサブピクセルに潰れて消える罫線・枠線を画面表示上 1px 未満にしない
describe("app.css の低ズーム時の枠線最低太さクランプ", () => {
  it.each([
    [".apx-tbl-hline", /height:\s*max\(1px, calc\(0\.25 \* var\(--mm\)\)\)/],
    [".apx-tbl-vline", /width:\s*max\(1px, calc\(0\.25 \* var\(--mm\)\)\)/],
    [
      ".apx-el-line-h",
      /border-top:\s*max\(1px, calc\(var\(--t, 0\.3\) \* var\(--mm\)\)\)/,
    ],
    [
      ".apx-el-line-v",
      /border-left:\s*max\(1px, calc\(var\(--t, 0\.3\) \* var\(--mm\)\)\)/,
    ],
    [
      ".apx-el-rect",
      /border-width:\s*max\(1px, calc\(var\(--bw, 0\.3\) \* var\(--mm\)\)\)/,
    ],
    [
      ".apx-el-ellipse",
      /border-width:\s*max\(1px, calc\(var\(--bw, 0\.3\) \* var\(--mm\)\)\)/,
    ],
    [
      ".apx-tbl-frame",
      new RegExp(
        String.raw`border:\s*max\(1px, calc\(var\(--frame-w, ${FRAME_W}\) \* var\(--mm\)\)\) var\(--frame-ls, solid\)\s+var\(--paper-text\)`,
      ),
    ],
  ])("%s は max(1px, ...) で下限クランプされる", (selector, pattern) => {
    expect(ruleBody(selector)).toMatch(pattern);
  });
});

// 外枠は表の全内部要素を覆う位置に描かれるため、クリック・ダブルクリック操作を透過させる
describe("app.css の表の外枠は選択・編集操作をブロックしない", () => {
  it(".apx-tbl-frame は inset:0 かつ pointer-events:none", () => {
    const body = ruleBody(".apx-tbl-frame");
    expect(body).toMatch(/inset:\s*0;/);
    expect(body).toMatch(/pointer-events:\s*none;/);
  });
});

// borderWidth 0（枠なし）は正当な状態であり、下限クランプで枠を生やしてはならない
describe("app.css の枠線幅 0（枠なし）はクランプしない", () => {
  it.each([".apx-el-rect.is-borderless", ".apx-el-ellipse.is-borderless"])(
    "%s は border-width: 0 を明示する",
    (selector) => {
      expect(ruleBody(selector)).toMatch(/border-width:\s*0;/);
    },
  );
});

// 「書き出し」等の主要アクションは CTA 専用色 + 視覚的重み（太字・シャドウ）で
// secondary ボタンと差別化する
describe("app.css の primary ボタンは CTA 専用トークンで視覚的重みを持つ", () => {
  it(".apx-btn-primary は --color-cta 系トークンを使う", () => {
    const body = ruleBody(".apx-btn-primary");
    expect(body).toMatch(/background:\s*var\(--color-cta\);/);
    expect(body).toMatch(/color:\s*var\(--color-on-cta\);/);
    expect(body).toMatch(/font-weight:\s*600;/);
    expect(body).toMatch(/box-shadow:\s*var\(--shadow-raised\);/);
  });

  it(".apx-btn-primary:hover / :active は CTA の hover / active トークンを使う", () => {
    expect(ruleBody(".apx-btn-primary:hover")).toMatch(
      /background:\s*var\(--color-cta-hover\);/,
    );
    expect(ruleBody(".apx-btn-primary:active")).toMatch(
      /background:\s*var\(--color-cta-active\);/,
    );
  });
});

// リサイズハンドルは方向性カーソル（nwse-resize 等）を持つのに対し、
// 回転ハンドルだけ手のひら（grab）だと回転操作であることが伝わらない
describe("app.css の回転ハンドルは回転専用カーソルを持つ", () => {
  it(".apx-h--rotate は grab を使わず SVG data URI のカスタムカーソルを持つ", () => {
    const body = ruleBody(".apx-h--rotate");
    expect(body).not.toMatch(/cursor:\s*grab/);
    expect(body).toMatch(
      /cursor:\s*url\("data:image\/svg\+xml,[^"]+"\)\s*12 12,\s*alias;/,
    );
  });

  it("カーソル画像は 24x24 のホットスポット中心・フォールバック alias を持つ", () => {
    const body = ruleBody(".apx-h--rotate");
    const match = body.match(/cursor:\s*url\("(data:image\/svg\+xml,[^"]+)"\)/);
    const dataUri = match?.[1];
    if (!dataUri) throw new Error("カーソルの data URI が見つからない");
    const svg = decodeURIComponent(dataUri);
    expect(svg).toMatch(/width='24'\s+height='24'/);
    expect(svg).toContain("stroke='black'");
    expect(svg).toContain("stroke='white'");
  });
});
