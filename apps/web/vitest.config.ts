import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // e2e/ は Playwright の管轄（vitest に拾わせない）
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
