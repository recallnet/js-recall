import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    address: "src/address/index.ts",
    artifacts: "src/artifacts/index.ts",
    utils: "src/utils/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  outExtension: ({ format }) => ({
    js: format === "esm" ? ".mjs" : ".cjs",
  }),
});
