// Originally from Cloudflare Wrangler and ShadCN:
// https://github.com/cloudflare/wrangler2/blob/main/.github/changeset-version.js
// https://github.com/cloudflare/workers-sdk/blob/main/.github/changeset-version.js
import { execSync } from "node:child_process";

// This script is used by the `release.yml` workflow to update the version of the packages being released.
// The standard step is only to run `changeset version` but this does not update the package-lock.json file.
// So we also run `pnpm install --lockfile-only`, which does this update.
// This is a workaround until this is handled automatically by `changeset version`.
// See https://github.com/changesets/changesets/issues/421.
function main() {
  execSync("pnpm version-packages", { stdio: "inherit" });
  execSync("pnpm install --lockfile-only", { stdio: "inherit" });
}

main();
