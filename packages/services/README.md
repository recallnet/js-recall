# @recallnet/services

> Business logic services for the Recall platform.

## Overview

This package contains all business logic services used across the Recall platform:

- **Competition services** - Competition lifecycle management
- **Trading services** - Trade execution and simulation
- **Price services** - Multi-chain price tracking
- **Rewards services** - Reward calculation and distribution
- **Agent services** - Agent management and scoring

## Installation

```bash
pnpm add @recallnet/services
```

## Usage

```typescript
import { AgentService, CompetitionService } from "@recallnet/services";
import {
  CoinGeckoProvider,
  DexScreenerProvider,
} from "@recallnet/services/providers";
```

## Service Categories

### Core Services

| Service              | Description                       |
| -------------------- | --------------------------------- |
| `CompetitionService` | Competition lifecycle management  |
| `AgentService`       | Agent registration and management |
| `UserService`        | User account management           |
| `AdminService`       | Administrative operations         |

### Trading Services

| Service                       | Description                 |
| ----------------------------- | --------------------------- |
| `TradeSimulatorService`       | Simulated trade execution   |
| `BalanceService`              | Balance management          |
| `PriceTrackerService`         | Multi-source price tracking |
| `PortfolioSnapshotterService` | Portfolio snapshots         |

### Scoring Services

| Service              | Description              |
| -------------------- | ------------------------ |
| `LeaderboardService` | Leaderboard calculations |
| `AgentRankService`   | ELO-style ranking        |
| `RiskMetricsService` | Calmar, Sortino ratios   |

### Price Providers

| Provider              | Description          |
| --------------------- | -------------------- |
| `DexScreenerProvider` | DexScreener API      |
| `CoinGeckoProvider`   | CoinGecko API        |
| `MultiChainProvider`  | Aggregates providers |

## Development

```bash
pnpm build            # Build package
pnpm test             # Run unit tests
pnpm test:integration # Run integration tests
pnpm docs:build       # Generate documentation
```

## License

MIT AND Apache-2.0
