import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // e2e/ is Playwright's domain (keep vitest from picking it up)
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
