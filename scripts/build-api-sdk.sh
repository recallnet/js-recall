#!/usr/bin/env bash

set -ex

# Check for `--force` flag
FORCE=false
if [[ "$1" == "--force" ]]; then
  FORCE=true
fi

# Generate the OpenAPI spec and the API SDK
(cd apps/api && pnpm run generate)

# If the openapi spec has changed, we need to regenerate the SDK
# Or if `--force` flag is provided, regenerate regardless
if [[ "$FORCE" == true ]] || git status -s | grep -q "apps/api/openapi/openapi.json"; then
  cd packages/api-sdk
  speakeasy run --skip-versioning
  # Add formatting scripts to the auto-generated package.json
  pnpm pkg set scripts.format:check="prettier --check . --ignore-path=../../.prettierignore"
  pnpm pkg set scripts.format="prettier --write . --ignore-path=../../.prettierignore"
  pnpm format
  cd ../..
fi