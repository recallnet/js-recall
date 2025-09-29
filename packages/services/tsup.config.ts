import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/providers/index.ts", "src/lib/index.ts"],
  format: "esm",
  dts: true,
  clean: true,
});
