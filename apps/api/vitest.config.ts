import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    reporters: [
      "verbose",
      [
        "json",
        {
          outputFile: "./e2e/e2e-server.json",
        },
      ],
    ],
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
