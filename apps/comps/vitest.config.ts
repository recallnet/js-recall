/// <reference types="vitest" />
import path from "path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    passWithNoTests: true,
    typecheck: { enabled: true, include: ["**/*.test.ts"] },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary"],
      exclude: [
        "node_modules/**",
        "dist/**",
        ".next/**",
        "e2e/**",
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/*.spec.tsx",
        "**/test/**",
        "app/layout.tsx",
        "app/**/layout.tsx",
        "tailwind.config.ts",
        "next.config.mjs",
        "postcss.config.mjs",
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          root: "./",
          environment: "jsdom",
          include: ["**/*.test.ts", "**/*.test.tsx"],
          exclude: ["e2e/**", "e2e-vercel/**", "node_modules/**"],
          typecheck: { enabled: true, include: ["**/*.test.ts"] },
        },
      },
      {
        extends: true,
        test: {
          name: "e2e",
          root: "./",
          dir: "./e2e",
          include: ["**/*.test.ts"],
          typecheck: { enabled: true, include: ["**/*.test.ts"] },
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
