import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/ai-sdk/index.ts"],
    outDir: "dist/ai-sdk",
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    outExtension: ({ format }) => ({
      js: format === "esm" ? ".js" : ".cjs",
    }),
  },
  {
    entry: ["src/langchain/index.ts"],
    outDir: "dist/langchain",
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    outExtension: ({ format }) => ({
      js: format === "esm" ? ".js" : ".cjs",
    }),
  },
  {
    entry: ["src/mcp/index.ts"],
    outDir: "dist/mcp",
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    outExtension: ({ format }) => ({
      js: format === "esm" ? ".js" : ".cjs",
    }),
  },
  {
    entry: ["src/openai/index.ts"],
    outDir: "dist/openai",
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    outExtension: ({ format }) => ({
      js: format === "esm" ? ".js" : ".cjs",
    }),
  },
  {
    entry: ["src/shared/index.ts"],
    outDir: "dist/shared",
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    outExtension: ({ format }) => ({
      js: format === "esm" ? ".js" : ".cjs",
    }),
  },
]);
