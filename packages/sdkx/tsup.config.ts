import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/chains.ts", "src/react/credits.ts", "src/actions/credits.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  outExtension: ({ format }) => ({
    js: format === "esm" ? ".mjs" : ".cjs",
  }),
});
