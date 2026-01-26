# AGENTS.md - Fonts Package

This file provides AI agent guidance specific to the fonts package.
See root [AGENTS.md](../../AGENTS.md) for repo-wide patterns.

## Purpose

Font configurations for Recall applications. Supports both open-source and private fonts.

## Usage

```typescript
import { fontMono, fontSans } from "@recallnet/fonts";
```

## Key Patterns

- **Open-source default**: Uses Geist fonts by default
- **Private fonts**: Optional via `PRIVATE_FONTS` env var
- **Next.js optimized**: Configured for Next.js font loading

## Environment Variables

- `PRIVATE_FONTS=true` - Enable private fonts
- `FONTS_REPO_ACCESS_TOKEN` - Private font repository access

## Key File Locations

- Font exports: Package source files
