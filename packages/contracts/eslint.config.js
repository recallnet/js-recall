import { config } from "@recallnet/eslint-config/base";

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    ignores: [...(config.ignores || []), "contracts/**"],
  },
];
