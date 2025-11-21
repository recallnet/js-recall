import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/providers/index.ts",
    "src/lib/index.ts",
    "src/types/index.ts",
    "src/indexing/index.ts",
  ],
  format: "esm",
  dts: true,
  clean: true,
});
