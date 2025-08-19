# CI/CD Workflow Optimization

This document explains the optimizations implemented in our CI/CD pipeline to avoid unnecessary builds and tests in our monorepo.

## Overview

Our monorepo contains multiple apps and packages with different dependencies. To optimize CI/CD performance and reduce costs, we've implemented path-based filtering that only runs relevant workflows when specific parts of the codebase change.

## GitHub Actions Optimizations

### 1. API CI Workflow (`api-ci.yml`)

The API CI workflow now includes path filters to only run when relevant files change:

- Triggers on changes to:
  - `apps/api/**` - The API application itself
  - `packages/**` - Shared packages that the API depends on
  - `pnpm-lock.yaml` - Dependency changes
  - `.github/workflows/api-ci.yml` - The workflow file itself
  - `turbo.json` - Build configuration changes

**Result**: API tests won't run when only `apps/comps` or other unrelated apps change.

### 2. Code Quality Workflow (`code-quality.yml`)

The code quality workflow now:

1. Detects which parts of the monorepo changed using the `dorny/paths-filter` action
2. Always runs lint and format checks (they're fast and important for consistency)
3. Only builds the apps/packages that actually changed using Turborepo's filtering

**Result**: Faster builds by only compiling what's necessary.

### 3. Reusable Change Detection (`detect-changes.yml`)

A reusable workflow that other workflows can call to detect changes. This provides consistent change detection across all workflows.

## Vercel Deployment Optimizations

Each app now has a `vercel.json` configuration file that uses Turborepo's `turbo-ignore` command to skip deployments when the app hasn't changed:

- `apps/portal/vercel.json`
- `apps/comps/vercel.json`
- `apps/faucet/vercel.json`
- `apps/registration/vercel.json`

The `ignoreCommand` uses `npx turbo-ignore <app-name>` which:

- Checks if the app or its dependencies have changed
- Returns exit code 0 (skip deployment) if nothing changed
- Returns exit code 1 (proceed with deployment) if changes detected

**Result**: Vercel won't rebuild and redeploy apps that haven't changed.

## How It Works

### Example Scenarios

1. **Changes only to `apps/comps`**:

   - ✅ Code quality runs lint/format and builds only `comps`
   - ✅ Vercel deploys only `comps`
   - ❌ API CI tests are skipped
   - ❌ Other apps don't rebuild on Vercel

2. **Changes to `packages/sdk`**:

   - ✅ API CI runs (since API depends on SDK)
   - ✅ Code quality builds all apps that depend on SDK
   - ✅ Vercel redeploys apps that use the SDK

3. **Changes to `apps/api`**:
   - ✅ API CI runs all tests
   - ✅ Code quality builds API
   - ❌ Unrelated apps don't rebuild

## Benefits

1. **Faster CI/CD**: Only run necessary tests and builds
2. **Cost Savings**: Reduced compute time on GitHub Actions and Vercel
3. **Better Developer Experience**: Faster feedback on PRs
4. **Maintained Quality**: Lint and format still run on everything

## Maintenance

When adding new apps or changing dependencies:

1. Update path filters in relevant workflows
2. Create a `vercel.json` for new apps
3. Ensure Turborepo's dependency graph is accurate in `turbo.json`
