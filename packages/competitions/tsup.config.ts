import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/shared/competition.interface.ts",
    "src/shared/competition.service.ts",
    "src/shared/competition-coordinator.ts",
    "src/paper-trading/competition.service.ts",
  ],
  format: "esm",
  dts: true,
  clean: true,
});
