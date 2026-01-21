# AGENTS.md - UI2 Package

This file provides AI agent guidance specific to the UI component library.
See root [AGENTS.md](../../AGENTS.md) for repo-wide patterns.

## Purpose

Modern UI component library using shadcn/ui patterns with Radix UI and Tailwind CSS.

## Structure

```
src/
├── components/       # UI components
├── lib/              # Utility functions (cn, etc.)
├── hooks/            # React hooks
└── styles/           # Global CSS
```

## Key Patterns

- **shadcn/ui**: Components follow shadcn/ui patterns
- **Radix UI**: Accessible primitives from Radix
- **Tailwind CSS**: Utility-first styling
- **CVA**: class-variance-authority for variants

## Adding a Component

1. Use shadcn CLI: `npx shadcn@latest add {component}`
2. Or create manually in `src/components/`
3. Export via package.json exports

## Development Commands

```bash
pnpm lint             # Run ESLint
pnpm format           # Format code
```

## Key File Locations

- Components: `src/components/*.tsx`
- Utilities: `src/lib/utils.ts`
- Global styles: `src/styles/globals.css`

## Usage

```typescript
import { Button } from "@recallnet/ui2/components/button";
import { cn } from "@recallnet/ui2/lib/utils";
```
