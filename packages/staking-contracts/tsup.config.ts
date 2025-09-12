import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/rewards-allocator.ts", "src/rewards-claimer.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  outExtension: ({ format }) => ({
    js: format === "esm" ? ".js" : ".cjs",
  }),
});
