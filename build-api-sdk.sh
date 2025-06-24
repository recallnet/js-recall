#!/usr/bin/env bash

set -eu

cd apps/api
pnpm run generate
cd ../..

cd packages/api-sdk
speakeasy run --skip-versioning
cd ../..

pnpm format
