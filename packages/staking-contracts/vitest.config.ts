import tsconfigPaths from "vite-tsconfig-paths";
import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
    passWithNoTests: true,
    typecheck: { enabled: true, include: ["**/*.test.ts"] },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: [
        "contracts/**/*",
        ...coverageConfigDefaults.exclude,
        "src/safe-transaction-proposer.ts",
        "src/time-travel.ts",
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          root: "./",
          dir: "./test",
          include: ["**/*.test.ts"],
          exclude: [
            "**/*.integration.test.ts",
            "node_modules",
            "dist",
            "contracts",
          ],
          typecheck: { enabled: true, include: ["**/*.test.ts"] },
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          root: "./",
          dir: "./test",
          include: ["**/*.integration.test.ts"],
          exclude: ["node_modules", "dist", "contracts"],
          typecheck: { enabled: true, include: ["**/*.test.ts"] },
          testTimeout: 30_000,
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
