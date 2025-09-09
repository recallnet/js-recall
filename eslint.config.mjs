import { config as baseConfig } from "@recallnet/eslint-config/base";

/** @type {import("eslint").Linter.Config} */
const config = [
  ...baseConfig,
  {
    ignores: ["apps/**", "packages/**"],
  },
];

export default config;