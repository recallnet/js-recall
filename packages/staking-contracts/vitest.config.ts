import tsconfigPaths from "vite-tsconfig-paths";
import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    exclude: ["node_modules", "dist", "contracts"],
    typecheck: { enabled: true, include: ["**/*.test.ts"] },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: [
        "contracts/**/*",
        ...coverageConfigDefaults.exclude,
        "src/safe-transaction-proposer.ts",
      ],
    },
  },
});
