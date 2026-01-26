# AGENTS.md - TypeScript Config Package

This file provides AI agent guidance specific to the TypeScript configuration package.
See root [AGENTS.md](../../AGENTS.md) for repo-wide patterns.

## Purpose

Shared TypeScript configuration for the monorepo.

## Usage

In package `tsconfig.json`:

```json
{
  "extends": "@recallnet/typescript-config/base.json"
}
```

## Available Configs

- `base.json` - Base configuration
- Additional configs as needed for specific use cases

## Key Patterns

- **Strict mode**: TypeScript strict mode enabled
- **Shared**: Used by all packages in monorepo
- **Extending**: Packages extend and customize as needed

## Modifying Configuration

1. Edit config files in this package
2. Run `pnpm build` across monorepo to test
3. Fix any new type errors before committing
