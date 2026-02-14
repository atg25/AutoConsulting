import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
});
