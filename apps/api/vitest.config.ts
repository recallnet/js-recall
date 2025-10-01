import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    passWithNoTests: true,
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
        "**/test/**",
      ],
    },
    reporters: ["default", "e2e/utils/log-reporter.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          root: "./",
          dir: "./src",
          include: ["**/*.test.ts"],
          exclude: ["**/*.integration.test.ts", "**/*.e2e.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          root: "./",
          dir: "./src",
          include: ["**/*.integration.test.ts"],
          testTimeout: 30_000, // Longer timeout for DB operations
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
      {
        extends: true,
        test: {
          name: "e2e",
          root: "./",
          dir: "./e2e",
          include: ["**/*.test.ts"],
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
