import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/generated.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  outExtension: ({ format }) => ({
    js: format === "esm" ? ".mjs" : ".cjs",
  }),
});
