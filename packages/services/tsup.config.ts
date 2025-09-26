import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/boost.ts", "src/user.ts"],
  format: "esm",
  dts: true,
  clean: true,
});
