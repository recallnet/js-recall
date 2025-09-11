import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/agent-trading/agent-trading.ts",
    "src/agent-trading/processors/*.ts",
  ],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  outExtension: ({ format }) => ({
    js: format === "esm" ? ".js" : ".cjs",
  }),
});
