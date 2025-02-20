// Originally from Cloudflare Wrangler and ShadCN:
// https://github.com/cloudflare/wrangler2/blob/main/.github/changeset-version.js
// https://github.com/cloudflare/workers-sdk/blob/main/.github/changeset-version.js
import { execSync } from "node:child_process";

function runCommand(command) {
  try {
    console.log(`\nRunning: ${command}`);
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    console.error(`Error message: ${error.message}`);

    if (error.stdout) {
      console.error(`stdout: ${error.stdout.toString()}`);
    }
    if (error.stderr) {
      console.error(`stderr: ${error.stderr.toString()}`);
    }

    process.exit(1);
  }
}

// This script is used by the `release.yml` workflow to update the version of the packages being released.
// The standard step is only to run `changeset version` but this does not update the package-lock.json file.
// So we also run `pnpm install --lockfile-only`, which does this update.
// This is a workaround until this is handled automatically by `changeset version`.
// See https://github.com/changesets/changesets/issues/421.
function main() {
  runCommand("pnpm version-packages");
  runCommand("pnpm install --lockfile-only");
}

main();
