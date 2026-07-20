import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// vitest runs with the package root as cwd
const css = readFileSync(
  join(process.cwd(), "src/ui/styles/tokens.css"),
  "utf-8",
);

/** Extract the declaration block body of a theme root (`.dr-designer` or `.dr-designer[data-theme="dark"]`) */
function themeBody(selector: string): string {
  const escaped = selector.replace(/[.[\]="]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`));
  if (!match) throw new Error(`selector not found in tokens.css: ${selector}`);
  return match[0];
}

// Ensure the CTA color is a token separate from --color-accent (shared across the UI for the focus ring etc.),
// and that it's defined in both the light and dark themes
describe("tokens.css の CTA 専用アクセントカラー", () => {
  it.each([".dr-designer", '.dr-designer[data-theme="dark"]'])(
    "%s に --color-cta 系トークンが定義される",
    (selector) => {
      const body = themeBody(selector);
      expect(body).toMatch(/--color-cta:\s*#[0-9a-f]{6};/);
      expect(body).toMatch(/--color-cta-hover:\s*#[0-9a-f]{6};/);
      expect(body).toMatch(/--color-cta-active:\s*#[0-9a-f]{6};/);
      expect(body).toMatch(/--color-on-cta:\s*#[0-9a-f]{6};/);
    },
  );

  it.each([".dr-designer", '.dr-designer[data-theme="dark"]'])(
    "%s の --color-cta は --color-accent と異なる値を持つ",
    (selector) => {
      const body = themeBody(selector);
      const accent = body.match(/--color-accent:\s*(#[0-9a-f]{6});/)?.[1];
      const cta = body.match(/--color-cta:\s*(#[0-9a-f]{6});/)?.[1];
      expect(accent).toBeDefined();
      expect(cta).toBeDefined();
      expect(cta).not.toBe(accent);
    },
  );
});
