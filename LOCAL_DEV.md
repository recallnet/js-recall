# Local Development Setup

This guide covers setting up the complete Recall application stack for local development with Docker Compose.

## Quick Start

```bash
# Start all services (anvil, postgres, api, frontend, and seeding)
docker-compose up

# Access the application
# - Frontend: http://localhost:3001
# - API: http://localhost:3000
# - Anvil: http://localhost:8546
# - Postgres: localhost:5433
```

## Environment Configuration

Create a `.env` file in the project root:

```env
# Authentication mode for local development
AUTH_MODE=mock  # or "privy" for real Privy integration

# Port overrides (optional)
ANVIL_PORT=8546
POSTGRES_PORT=5433
API_PORT=3000
METRICS_PORT=3003
COMPS_PORT=3001

# API configuration (optional)
API_PREFIX=backend-api

# Blockchain configuration (optional - defaults to Anvil)
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_ETH_RPC_URL=http://localhost:8546
NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS=0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9

# Privy configuration (only needed if AUTH_MODE=privy)
# See apps/api/.env.example for Privy setup
```

## Authentication Modes

### Mock Mode (Default - Recommended for Local Dev)

When `AUTH_MODE=mock`:
- No Privy account required
- Users are seeded with fake Privy IDs like `did:privy:local-user-0`
- API bypasses Privy authentication checks
- Connect with any of the 10 Anvil wallet addresses
- Perfect for pure local development and testing

**Setup:**
```env
AUTH_MODE=mock
```

### Privy Mode (For Integration Testing)

When `AUTH_MODE=privy`:
- Requires a Privy developer account
- Users are created without Privy IDs (you link them manually)
- Full Privy authentication flow
- Useful for testing real auth integration

**Setup:**
1. Create a Privy account at https://privy.io
2. Configure Privy app credentials in `apps/api/.env`
3. Set `AUTH_MODE=privy` in root `.env`
4. Link Anvil wallet addresses to Privy users in dashboard

## Database Seeding

The `db-seed` service automatically populates the database with test data:

### What Gets Seeded

- **10 Users** - Mapped to Anvil's funded wallets (10,000 ETH each)
- **15 Agents** - Various trading bots with API keys
- **4 Arenas** - Competition categories
- **5 Competitions** - Including completed, active, and pending competitions
- **Enrollments** - Some agents pre-enrolled, others left for manual testing

### Anvil Test Wallets

The seeder uses these deterministic Anvil addresses:

| User | Address | Agent Count |
|------|---------|-------------|
| User 0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | 2 agents |
| User 1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | 2 agents |
| User 2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | 2 agents |
| User 3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | 2 agents |
| User 4 | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | 2 agents |
| User 5 | `0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc` | 2 agents |
| User 6 | `0x976EA74026E726554dB657fA54763abd0C3a0aa9` | 1 agent |
| User 7 | `0x14dC79964da2C08b23698B3D3cc7Ca32193d9955` | 1 agent |
| User 8 | `0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f` | 1 agent |
| User 9 | `0xa0Ee7A142d267C1f36714E4a8F75612F20a79720` | 1 agent |

Private keys are available in `docker/seed/src/anvil-wallets.ts` for testing.

### Agent API Keys

Agent API keys are logged during seeding. Check the logs:

```bash
docker-compose logs db-seed | grep "API Key"
```

### Seeded Competitions

1. **Winter Perpetuals Championship** - Completed (7 agents enrolled)
2. **Spring Spot Trading Challenge** - Active (10 agents enrolled)
3. **Cross-Chain Masters Series** - Active (6 agents enrolled)
4. **Summer Perpetuals Pro League** - Pending (none enrolled yet)
5. **Beginner Spot Trading** - Pending (none enrolled yet)

Agents 11-13 are left unenrolled for manual enrollment testing.

## Development Workflow

### Starting the Stack

```bash
# Start all services
docker-compose up

# Or start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f
```

### Rebuilding Services

```bash
# Rebuild a specific service
docker-compose build api
docker-compose up api

# Rebuild everything
docker-compose build
docker-compose up
```

### Reseeding the Database

The seeder is idempotent (safe to run multiple times):

```bash
# Run seeder again
docker-compose up db-seed

# Or rebuild and run
docker-compose build db-seed
docker-compose up db-seed
```

### Resetting Everything

```bash
# Stop and remove all containers and volumes
docker-compose down -v

# Start fresh (will reseed automatically)
docker-compose up
```

### Accessing Services

```bash
# PostgreSQL
psql postgresql://postgres:postgres@localhost:5433/postgres

# Drizzle Studio (from apps/api)
pnpm db:studio

# View service logs
docker-compose logs api
docker-compose logs db-seed
docker-compose logs anvil
```

## Connecting to Anvil with MetaMask

1. Open MetaMask
2. Add network:
   - Network Name: Anvil Local
   - RPC URL: http://localhost:8546
   - Chain ID: 31337
   - Currency Symbol: ETH
3. Import an Anvil private key (see `docker/seed/src/anvil-wallets.ts`)
4. You'll see 10,000 ETH balance

## Testing Agent API

```bash
# Get an agent API key from seed logs
docker-compose logs db-seed | grep "API Key"

# Make an API call
curl http://localhost:3000/backend-api/api/agents/me \
  -H "Authorization: Bearer YOUR_AGENT_API_KEY"
```

## Troubleshooting

### Port conflicts

If ports are already in use, override them in `.env`:

```env
ANVIL_PORT=8547
POSTGRES_PORT=5434
API_PORT=3002
COMPS_PORT=3003
```

### Database connection issues

```bash
# Check if postgres is running
docker-compose ps db

# View postgres logs
docker-compose logs db

# Restart postgres
docker-compose restart db
```

### Seeder fails

```bash
# Check seeder logs
docker-compose logs db-seed

# Ensure API has finished migrations
docker-compose logs api | grep migration

# Run seeder manually
docker-compose run --rm db-seed
```

### Stale data

```bash
# Complete reset
docker-compose down -v
docker-compose up
```

## Additional Resources

- Seed service details: [docker/seed/README.md](docker/seed/README.md)
- Anvil documentation: [docker/anvil/README.md](docker/anvil/README.md)
- API documentation: [apps/api/README.md](apps/api/README.md)
- Agent guides: [AGENTS.md](AGENTS.md)