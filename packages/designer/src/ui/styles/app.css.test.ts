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
  ])("%s は max(1px, ...) で下限クランプされる", (selector, pattern) => {
    expect(ruleBody(selector)).toMatch(pattern);
  });
});
