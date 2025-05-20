#!/usr/bin/env bash

set -eu

cd apps/api
npm run generate-openapi
cd ../..

cd packages/api-sdk
speakeasy run
cd ../..

pnpm format
