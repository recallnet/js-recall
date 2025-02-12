import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/generated.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
});
