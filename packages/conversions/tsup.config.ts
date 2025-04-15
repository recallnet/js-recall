import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/constants.ts", "src/conversions.ts", "src/format-atto-rcl.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  outExtension: ({ format }) => ({
    js: format === "esm" ? ".js" : ".cjs",
  }),
});
