# AGENTS.md - ESLint Config Package

This file provides AI agent guidance specific to the ESLint configuration package.
See root [AGENTS.md](../../AGENTS.md) for repo-wide patterns.

## Purpose

Shared ESLint configuration for the monorepo.

## Usage

In package `eslint.config.js`:

```javascript
import config from "@recallnet/eslint-config";

export default config;
```

## Key Patterns

- **Flat config**: Uses ESLint flat config format
- **TypeScript**: Configured for TypeScript projects
- **Shared**: Used by all packages in monorepo

## Modifying Rules

1. Edit configuration files in this package
2. Run `pnpm lint` across monorepo to test
3. Fix any new violations before committing

## Key File Locations

- Main config: Package root
