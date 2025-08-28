import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary"],
      exclude: [
        "node_modules/**",
        "dist/**",
        ".next/**",
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
        "postcss.config.mjs"
      ]
    },
  },
});
