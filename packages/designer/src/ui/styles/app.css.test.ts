import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// vitest はパッケージルートを cwd として実行される
const css = readFileSync(join(process.cwd(), "src/ui/styles/app.css"), "utf-8");

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
      ".apx-el-table",
      /border:\s*max\(1px, calc\(0\.4 \* var\(--mm\)\)\) solid var\(--paper-text\)/,
    ],
  ])("%s は max(1px, ...) で下限クランプされる", (selector, pattern) => {
    expect(ruleBody(selector)).toMatch(pattern);
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
