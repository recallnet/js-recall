import tsconfigPaths from "vite-tsconfig-paths";
import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    typecheck: { enabled: true, include: ["**/*.test.ts"] },
    root: "./",
    dir: "./src/shared",
    include: ["**/*.test.ts"],
    exclude: ["**/*.integration.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary"],
      include: ["src/shared/**/*.ts"],
      exclude: [...coverageConfigDefaults.exclude],
    },
  },
});
