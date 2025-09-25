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
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/test/**",
      ],
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
    ],
  },
});
