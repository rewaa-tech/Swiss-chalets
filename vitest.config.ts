import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/empty.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://sc:sc@127.0.0.1:5432/swisschalets_test",
      DATA_DIR: "/tmp/swisschalets-test",
      APP_SECRET: "test-secret",
      DISABLE_JOBS: "1",
    },
  },
});
