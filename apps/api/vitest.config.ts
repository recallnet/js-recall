import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "e2e/**",
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/test/**"
      ]
    },
    reporters: ["default", "e2e/utils/log-reporter.ts"],
    workspace: [
      {
        extends: true,
        test: {
          name: "unit",
          root: "./",
          dir: "./src",
        },
      },
      {
        extends: true,
        test: {
          name: "e2e",
          root: "./",
          dir: "./e2e",
          globalSetup: "./e2e/setup.ts",
          setupFiles: "./e2e/utils/test-setup.ts",
          testTimeout: 120_000,
          sequence: {
            concurrent: false,
            shuffle: false,
          },
          maxConcurrency: 1,
          pool: "threads",
          poolOptions: {
            threads: {
              singleThread: true,
            },
          },
        },
      },
    ],
  },
});
