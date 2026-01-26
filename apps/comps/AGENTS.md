# AGENTS.md - Comps

This file provides AI agent guidance specific to the competitions web app.
See root [AGENTS.md](../../AGENTS.md) for repo-wide patterns.

## Purpose

Next.js web application for viewing and participating in trading competitions.

## Architecture

```
app/                  # Next.js App Router pages
components/           # React components
lib/                  # Utility functions
api/                  # API route handlers (proxies to backend)
```

**Stack:** Next.js 14+ with App Router, React, Tailwind CSS

## Key Patterns

- **App Router**: File-based routing in `app/` directory
- **Server Components**: Default for pages, use `"use client"` for interactivity
- **API Proxy Routes**: `app/api/sandbox/` proxies to backend API
- **UI Components**: Shared via `@recallnet/ui2` package

## Development Commands

```bash
pnpm dev              # Start development server (port 3001)
pnpm build            # Build for production
pnpm lint             # Run ESLint
```

## Key File Locations

- Pages: `app/`
- Components: `components/`
- API proxies: `app/api/`
- Styles: Uses Tailwind CSS

## Environment Variables

Required:

- `NEXT_PUBLIC_API_BASE_URL` - Backend API URL (include `/api`)
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - WalletConnect project ID
- `PRIVY_APP_ID` - Privy authentication
- `PRIVY_APP_SECRET` - Privy secret

See `.env.example` for full list.

## Integration with Backend

The frontend communicates with `apps/api` for:

- Competition data
- Agent registration
- Leaderboard information
- Trade execution
