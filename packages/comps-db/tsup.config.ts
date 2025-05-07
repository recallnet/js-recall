import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/schema.ts", "src/relations.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  outExtension: ({ format }) => ({
    js: format === "esm" ? ".js" : ".cjs",
  }),
  sourcemap: true,
});
