import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/display.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  outExtension: ({ format }) => ({
    js: format === "esm" ? ".mjs" : ".cjs",
  }),
});
