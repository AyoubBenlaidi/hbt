import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // PGlite boots a real Postgres in WASM: give migrations room on slow machines
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
