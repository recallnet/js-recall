import tsconfigPaths from "vite-tsconfig-paths";
import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: [...coverageConfigDefaults.exclude],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          root: "./",
          dir: "./src",
          include: ["**/*.test.ts"],
          exclude: ["**/*.integration.test.ts"],
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
    ],
  },
});
