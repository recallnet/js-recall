# Database Seeding Implementation Summary

## Overview

This document summarizes the implementation of the local development database seeding system for the Recall application. The system provides a complete, realistic test environment with users mapped to Anvil's funded wallets, agents, competitions, and enrollments.

## What Was Implemented

### 1. Seed Service (`docker/seed/`)

A standalone TypeScript service that seeds the PostgreSQL database with test data:

```
docker/seed/
├── Dockerfile              # Container definition
├── package.json            # Dependencies (@recallnet/db, drizzle-orm, pg)
├── tsconfig.json           # TypeScript configuration
├── README.md               # Detailed usage documentation
├── IMPLEMENTATION.md       # This file
├── show-api-keys.sh        # Helper script to extract API keys
├── data/
│   ├── arenas.json        # 5 competition arenas
│   └── competitions.json   # 6 competitions (completed, active, pending)
└── src/
    ├── index.ts           # Main orchestrator
    ├── anvil-wallets.ts   # 10 Anvil wallet addresses
    ├── users.ts           # User seeding (mapped to Anvil wallets)
    ├── agents.ts          # Agent seeding (15 agents with API keys)
    ├── competitions.ts    # Arena/competition/enrollment seeding
    └── utils.ts           # Database helpers and utilities
```

### 2. Docker Compose Integration

Updated `docker-compose.yml` with:
- `db-seed` service that runs after API starts (migrations complete)
- `AUTH_MODE` environment variable support across services
- Automatic seeding on stack startup
- Service runs once and exits (restart: "no")

### 3. Authentication Modes (Option C - Hybrid)

#### Mock Mode (Default)
- `AUTH_MODE=mock`
- No Privy account required
- Users get fake Privy IDs: `did:privy:local-user-0`, etc.
- Perfect for local development
- API should bypass Privy checks when in mock mode

#### Privy Mode (Integration Testing)
- `AUTH_MODE=privy`
- Users created with `privyId: null`
- Requires manual linking to real Privy accounts
- Full authentication flow testing

### 4. Seeded Data

#### Users (10)
- Mapped to Anvil's 10 default funded wallets
- Each wallet has 10,000 ETH
- Addresses: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`, etc.
- Mock emails: `user0@recall.local`, `user1@recall.local`, etc.
- Generated avatars

#### Agents (15)
- Users 0-5: 2 agents each (12 total)
- Users 6-9: 1 agent each (3 total)
- Types: Alpha Bot, Momentum Trader, Market Maker
- Each has unique API key (logged during seeding)
- Owned by respective users, uses their wallet addresses

#### Arenas (4)
1. Spot Trading
2. Perpetuals Trading
3. Cross-Chain Trading
4. DeFi Strategies

#### Competitions (5)

1. **Winter Perpetuals Championship** (Completed)
   - Status: completed
   - Type: perpetuals
   - Dates: Jan 15 - Feb 14, 2024
   - 7 agents enrolled (agents 0-6)
   - Hyperliquid data source
   - Evaluation: Calmar ratio

2. **Spring Spot Trading Challenge** (Active)
   - Status: active
   - Type: spot-live
   - Dates: Mar 1 - Apr 30, 2024
   - 10 agents enrolled (agents 0-9)
   - Base network, on-chain data
   - USDC, WETH, DAI tokens

3. **Cross-Chain Masters Series** (Active)
   - Status: active
   - Type: spot-live
   - Dates: Mar 10 - May 10, 2024
   - 6 agents enrolled (agents 2,3,4,8,9,10)
   - Elite competition, high stakes
   - Multi-chain (Ethereum, Base, Arbitrum)

4. **Summer Perpetuals Pro League** (Pending)
   - Status: pending
   - Type: perpetuals
   - Dates: Jun 1 - Aug 31, 2024
   - No enrollments yet (available for manual testing)
   - Premium competition

5. **Beginner Spot Trading** (Pending)
   - Status: pending
   - Type: spot-live
   - Dates: May 1 - May 31, 2024
   - No enrollments yet (available for manual testing)
   - Entry-level, low stakes



#### Strategic Enrollment
- **Agents 0-10**: Enrolled in various competitions
- **Agents 11-13**: Left unenrolled for manual testing
- Mix of competition types and statuses for comprehensive testing

### 5. Documentation

Created comprehensive documentation:

- `docker/seed/README.md` - Detailed seed service documentation
- `LOCAL_DEV.md` - Complete local development guide
- `.env.docker-compose.example` - Environment configuration template
- `docker/seed/IMPLEMENTATION.md` - This summary

## Architecture Decisions

### Why Separate Seed Service?
- **Isolation**: Keeps seed logic separate from application code
- **Idempotency**: Safe to run multiple times (checks for existing data)
- **Flexibility**: Easy to modify seed data without touching app code
- **Docker-native**: Fits naturally into docker-compose workflow

### Why JSON Data Files?
- **Maintainability**: Easy to edit competitions/arenas without code changes
- **Visibility**: Non-developers can understand and modify data
- **Version Control**: Clear diffs when data changes
- **Separation**: Configuration separate from seeding logic

### Why Hybrid Auth Mode?
- **Flexibility**: Supports both mock and real Privy flows
- **Developer Experience**: Mock mode = zero external dependencies
- **Integration Testing**: Privy mode = test real auth flows
- **Environment Variable**: Simple toggle, no code changes

## Next Steps for API Implementation

The seed service is complete, but the API needs to support mock auth mode:

### 1. Add Mock Auth Middleware

Create `apps/api/src/middleware/dev-auth.ts`:

```typescript
// Middleware to bypass Privy auth in mock mode
export function mockAuthMiddleware(req, res, next) {
  if (process.env.AUTH_MODE === 'mock') {
    // Extract wallet address from header or token
    const mockWallet = req.headers['x-dev-wallet'];
    if (mockWallet) {
      // Look up user by wallet address
      // Attach to req.user
      // Skip Privy validation
    }
  }
  next();
}
```

### 2. Update Auth Routes

Modify Privy authentication routes to:
- Check `AUTH_MODE` environment variable
- In mock mode: Accept any Anvil wallet address
- In privy mode: Use normal Privy validation

### 3. Environment Variable

Add to `apps/api/.env`:
```
AUTH_MODE=mock  # or "privy"
```

### 4. Frontend Integration

Update `apps/comps` to:
- Check `AUTH_MODE` from environment
- In mock mode: Show wallet selector dropdown (10 Anvil addresses)
- In privy mode: Use normal Privy login flow

## Usage

### Quick Start

```bash
# Copy environment template
cp .env.docker-compose.example .env

# Start everything (auto-seeds)
docker-compose up

# View agent API keys
./docker/seed/show-api-keys.sh
```

### Resetting Everything

```bash
# Complete reset
docker-compose down -v
docker-compose up
```

### Manual Seeding

```bash
# Run seeder separately
docker-compose up db-seed

# Rebuild seeder after changes
docker-compose build db-seed
docker-compose up db-seed
```

## Testing Scenarios

The seeded data enables these test scenarios:

1. **Completed Competition**: Check leaderboards for Winter Perpetuals
2. **Active Competition**: Enroll new agents in Spring Spot Trading
3. **Pending Competition**: Test enrollment before competition starts
4. **Manual Enrollment**: Enroll agents 11-13 in any competition
5. **Multiple Enrollments**: Agent can participate in multiple competitions
6. **Wallet Integration**: Connect MetaMask to Anvil wallets
7. **API Testing**: Use agent API keys for authenticated requests
8. **Sandbox Mode**: Test without stakes/rewards

## Maintenance

### Adding New Competitions

1. Edit `docker/seed/data/competitions.json`
2. Follow existing structure
3. Reference valid arena name
4. Rebuild and run seeder

### Changing Enrollments

1. Edit `docker/seed/src/competitions.ts`
2. Modify `enrollmentPlan` array
3. Rebuild and run seeder

### Updating Anvil Wallets

If Anvil changes:
1. Update `docker/seed/src/anvil-wallets.ts`
2. Rebuild and run seeder

## Troubleshooting

### Seeder Exits Immediately
```bash
docker-compose logs db-seed
# Check for connection errors or migration issues
```

### Duplicate Key Errors
- Expected on reruns (seeder is idempotent)
- Or reset: `docker-compose down -v && docker-compose up`

### Missing Agent API Keys
```bash
docker-compose logs db-seed | grep "API Key"
```

### Privy Mode Issues
- Ensure `AUTH_MODE=privy` in `.env`
- Configure Privy credentials in `apps/api/.env`
- Link Anvil wallets in Privy dashboard

## Benefits

✅ **Zero Manual Setup**: `docker-compose up` gives you a working environment
✅ **Realistic Data**: Completed, active, and pending competitions
✅ **Test Flexibility**: Some agents enrolled, others free for testing
✅ **Anvil Integration**: 10 funded wallets ready to use
✅ **Idempotent**: Safe to run multiple times
✅ **Hybrid Auth**: Mock mode for speed, Privy mode for integration
✅ **Well Documented**: Clear guides and examples
✅ **Easy Maintenance**: JSON data files, simple scripts

## Related Files

- Main guide: `LOCAL_DEV.md`
- Seed README: `docker/seed/README.md`
- Anvil info: `docker/anvil/README.md`
- API docs: `apps/api/README.md`
- Docker Compose: `docker-compose.yml`
- Env template: `.env.docker-compose.example`
