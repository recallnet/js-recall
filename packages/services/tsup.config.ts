import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/boost.ts"],
  format: "esm",
  dts: true,
  clean: true,
});
