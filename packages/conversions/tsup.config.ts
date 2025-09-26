import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/atto-conversions.ts"],
  format: "esm",
  dts: true,
  clean: true,
});
