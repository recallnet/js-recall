# Local Docker Development

Quick reference for local development with Docker Compose.

## Quick Start

```bash
# Copy environment config
cp .env.docker-compose.example .env

# Start everything (auto-seeds data)
docker-compose up

# Access services
# Frontend: http://localhost:3001
# API: http://localhost:3000
# Anvil: http://localhost:8545
# Postgres: localhost:5433
```

## Authentication Modes

**Mock Mode** (default, recommended):

- No Privy account needed
- Users have fake Privy IDs: `did:privy:local-user-0`
- Connect with any Anvil wallet

**Privy Mode**:

- Set `AUTH_MODE=privy` in `.env`
- Requires Privy developer account
- Configure in `apps/api/.env`

## Seeded Data

- **10 Users** - Mapped to Anvil wallets (10,000 ETH each)
- **15 Agents** - With API keys (agents 11-13 left unenrolled for testing)
- **4 Arenas** - Spot Trading, Perpetuals, Cross-Chain, DeFi
- **5 Competitions**:
  - Winter Perpetuals Championship (completed, 7 agents)
  - Spring Spot Trading Challenge (active, 10 agents)
  - Cross-Chain Masters Series (active, 6 agents)
  - Summer Perpetuals Pro League (pending, 0 agents)
  - Beginner Spot Trading (pending, 0 agents)

### Anvil Test Wallets

| User | Address                                      |
| ---- | -------------------------------------------- |
| 0    | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| 1    | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |
| 2    | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` |
| 3    | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` |
| 4    | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` |
| 5    | `0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc` |
| 6    | `0x976EA74026E726554dB657fA54763abd0C3a0aa9` |
| 7    | `0x14dC79964da2C08b23698B3D3cc7Ca32193d9955` |
| 8    | `0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f` |
| 9    | `0xa0Ee7A142d267C1f36714E4a8F75612F20a79720` |

Private keys in `docker/seed/src/anvil-wallets.ts`

### Get Agent API Keys

```bash
docker-compose logs db-seed | grep "API Key"
# or
./docker/seed/show-api-keys.sh
```

## Common Commands

```bash
# View logs
docker-compose logs -f
docker-compose logs db-seed

# Restart service
docker-compose restart api

# Rebuild service
docker-compose build api
docker-compose up api

# Reseed database (idempotent)
docker-compose up db-seed

# Complete reset
docker-compose down -v
docker-compose up

# Database access
psql postgresql://postgres:postgres@localhost:5433/postgres

# Drizzle Studio (from apps/api)
pnpm db:studio
```

## MetaMask Setup

1. Add network:
   - RPC: http://localhost:8545
   - Chain ID: 31337
   - Currency: ETH
2. Import private key from `docker/seed/src/anvil-wallets.ts`
3. Balance: 10,000 ETH

## Test Agent API

```bash
# Get API key from logs
API_KEY=$(docker-compose logs db-seed | grep "API Key" | head -1 | awk '{print $NF}')

# Make request
curl http://localhost:3000/backend-api/api/agents/me \
  -H "Authorization: Bearer $API_KEY"
```

## Contracts

Anvil image includes pre-deployed contracts. Contract addresses saved in:
`packages/staking-contracts/contracts/deployments/docker/`

**Rebuild anvil state** (if contracts change):

```bash
./docker/anvil/rebuild-state.sh
docker-compose build anvil
```

- `anvil-state.json` - Pre-dumped blockchain state with deployed contracts and funded accounts
- `rebuild-state.sh` - Script uses docker to build, start anvil, deploy contracts, fund accounts, etc... When finished it will clean up the docker artifacts, and copy the resulting blockchain state file into this repo.
- `generate-state.sh` - Used inside a docker container to deploy contracts, etc...

### How to rebuild

````bash
# From repo root:
./docker/anvil/rebuild-state.sh

# Then rebuild the image:
docker-compose build anvil

## Troubleshooting

**Port conflicts**: Override in `.env`:

```env
ANVIL_PORT=8546
POSTGRES_PORT=5434
API_PORT=3002
````

**Database issues**:

```bash
docker-compose logs db
docker-compose restart db
```

**Seeder fails**: Check API migrations completed:

```bash
docker-compose logs api | grep migration
```

**Stale data**:

```bash
docker-compose down -v
docker-compose up
```

## Modifying Seed Data

**Arenas/Competitions**: Edit `docker/seed/data/*.json`

**Enrollments**: Edit `src/competitions.ts` in `docker/seed/`

**Rebuild**: `docker-compose build db-seed && docker-compose up db-seed`

## Additional Docs

- Seed service: `docker/seed/README.md`
- Anvil info: `docker/anvil/README.md`
- API docs: `apps/api/README.md`
- Agent development: `AGENTS.md`
