import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    client: "src/client.ts",
    entities: "src/entities/index.ts",
    ipc: "src/ipc/index.ts",
    network: "src/network.ts",
    provider: "src/provider/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  outExtension: ({ format }) => ({
    js: format === "esm" ? ".mjs" : ".cjs",
  }),
});
