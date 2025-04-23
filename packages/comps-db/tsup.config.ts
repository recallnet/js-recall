import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/schema.ts", "src/queries/insert.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  outExtension: ({ format }) => ({
    js: format === "esm" ? ".js" : ".cjs",
  }),
  sourcemap: true,
});
