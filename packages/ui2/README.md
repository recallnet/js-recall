# @recallnet/ui2

> Modern UI component library based on shadcn/ui.

## Overview

This package provides reusable UI components for Recall applications:

- **Radix UI primitives** - Accessible, unstyled components
- **Tailwind CSS styling** - Utility-first CSS
- **shadcn/ui patterns** - Copy-paste component patterns

## Installation

This package is used internally within the monorepo.

## Usage

```typescript
import { Button } from "@recallnet/ui2/components/button";
import { Dialog } from "@recallnet/ui2/components/dialog";
import { cn } from "@recallnet/ui2/lib/utils";
```

## Available Components

Components are in `src/components/`:

- Button
- Dialog
- Dropdown Menu
- Select
- Tabs
- Tooltip
- And more...

## Styling

Import global styles in your app:

```typescript
import "@recallnet/ui2/globals.css";
```

## Development

```bash
pnpm lint             # Run ESLint
pnpm format           # Format code
```

## Adding Components

Use shadcn/ui CLI to add components:

```bash
npx shadcn@latest add button
```

## License

MIT AND Apache-2.0
