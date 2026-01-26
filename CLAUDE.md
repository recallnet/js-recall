# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For complete development guidance including commands, architecture, and patterns, see [AGENTS.md](./AGENTS.md).

## Documentation Hierarchy

This repository uses distributed documentation. Navigate to the relevant area:

**Applications:**

- [apps/api/CLAUDE.md](./apps/api/CLAUDE.md) - Trading simulator API
- [apps/comps/CLAUDE.md](./apps/comps/CLAUDE.md) - Competitions web app

**Core Packages:**

- [packages/db/CLAUDE.md](./packages/db/CLAUDE.md) - Database schema and repositories
- [packages/services/CLAUDE.md](./packages/services/CLAUDE.md) - Business logic services
- [packages/rewards/CLAUDE.md](./packages/rewards/CLAUDE.md) - Rewards calculation
- [packages/conversions/CLAUDE.md](./packages/conversions/CLAUDE.md) - Unit conversions
- [packages/test-utils/CLAUDE.md](./packages/test-utils/CLAUDE.md) - Test utilities
- [packages/ui2/CLAUDE.md](./packages/ui2/CLAUDE.md) - UI components
- [packages/staking-contracts/CLAUDE.md](./packages/staking-contracts/CLAUDE.md) - Contract interfaces

**Config Packages:**

- [packages/eslint-config/CLAUDE.md](./packages/eslint-config/CLAUDE.md) - ESLint rules
- [packages/typescript-config/CLAUDE.md](./packages/typescript-config/CLAUDE.md) - TypeScript config
- [packages/fonts/CLAUDE.md](./packages/fonts/CLAUDE.md) - Font resources
- [packages/load-test/CLAUDE.md](./packages/load-test/CLAUDE.md) - Load testing

## Agent Workflow

1. **Plan before implementing** - Use TodoWrite for multi-step tasks
2. **Commit frequently** - Small commits, never bypass hooks
3. **Verify before completion** - Run `pnpm lint && pnpm build`
4. **TDD for bug fixes** - Write failing test first, then fix

## Quick Reference

```bash
pnpm dev                      # Start all apps in development mode
pnpm build                    # Build all packages
pnpm lint                     # Run ESLint across monorepo
pnpm --filter api test        # Run API tests
pnpm --filter api db:migrate  # Run database migrations
```
