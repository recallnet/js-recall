import tsParser from "@typescript-eslint/parser";
import { defineConfig, globalIgnores } from "eslint/config";

import { config as baseConfig } from "@recallnet/eslint-config/base";

export default defineConfig([
  ...baseConfig,
  {
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: true,
      },
    },
  },
  globalIgnores(["apps/**", "packages/**"]),
]);
