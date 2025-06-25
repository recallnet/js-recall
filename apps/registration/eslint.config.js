import { nextJsConfig } from "@recallnet/eslint-config/next-js";

/** @type {import("eslint").Linter.Config} */
export default [
  ...nextJsConfig,
  {
    rules: {
      // Disable Next.js img element warnings
      "@next/next/no-img-element": "off",
    },
  },
];
