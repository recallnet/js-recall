import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

import LogReporter from "./e2e/utils/log-reporter.js";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    reporters: ["json", "default", new LogReporter()],
    outputFile: "./test-output.json",
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
          name: "sum",
          root: "./",
          dir: "./sum",
          globalSetup: "./sum/global-setup.ts",
        },
      },
      {
        extends: true,
        test: {
          name: "e2e",
          root: "./",
          dir: "./e2e",
          globalSetup: "./e2e/setup.ts",
        },
      },
    ],
  },
});
