import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["json", "text"],
      reportsDirectory: "./coverage",
      exclude: ["**/*.test.tsx", "**/*.test.ts"],
    },
  },
});
