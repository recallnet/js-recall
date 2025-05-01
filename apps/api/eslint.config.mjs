import { config as baseConfig } from "@recallnet/eslint-config/base";

/** @type {import("eslint").Linter.Config} */ // Updated type definition
const config = [
  ...baseConfig,
  {
    ignores: [
      "node_modules/",
      "dist/",
      "build/",
      "coverage/",
      "**/*.min.js",
      "**/vendor/**",
      "docs/examples/**", // Ignore examples directory
    ],
  },
];

export default config; // ✅ Explicitly export the properly typed config
