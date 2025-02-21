import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    account: "src/entities/account.ts",
    blob: "src/entities/blob.ts",
    bucket: "src/entities/bucket.ts",
    client: "src/client.ts",
    credit: "src/entities/credit.ts",
    errors: "src/errors.ts",
    ipc: "src/ipc/index.ts",
    network: "src/network.ts",
    provider: "src/provider.ts",
    utils: "src/utils.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  outExtension: ({ format }) => ({
    js: format === "esm" ? ".mjs" : ".cjs",
  }),
});
