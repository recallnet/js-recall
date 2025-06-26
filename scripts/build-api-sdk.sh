#!/usr/bin/env bash

set -ex

# Generate the OpenAPI spec and the API SDK
(cd apps/api && pnpm run generate)
(cd packages/api-sdk && speakeasy run --skip-versioning)

# Add formatting scripts to the auto-generated package.json
(cd packages/api-sdk && \
  pnpm pkg set scripts.format:check="prettier --check . --ignore-path=../../.prettierignore" && \
  pnpm pkg set scripts.format="prettier --write . --ignore-path=../../.prettierignore" && \
  pnpm format)

