import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/core/defs.ts",
    "src/core/relatons.ts",
    "src/core/types.ts",
    "src/ranking/defs.ts",
    "src/ranking/relatons.ts",
    "src/ranking/types.ts",
    "src/trading/defs.ts",
    "src/trading/relatons.ts",
    "src/trading/types.ts",
    "src/voting/defs.ts",
    "src/voting/relatons.ts",
    "src/voting/types.ts",
  ],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  outExtension: ({ format }) => ({
    js: format === "esm" ? ".js" : ".cjs",
  }),
});
