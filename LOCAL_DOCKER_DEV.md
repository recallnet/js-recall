# Local Docker Development

Quick reference for local development with Docker Compose.

This setup supports **4 flexible development scenarios** using Docker Compose profiles, allowing you to run services locally or in Docker based on your goals.

---

## Development Scenarios

| Scenario                 | Command                             | What runs in Docker            | What runs locally |
| ------------------------ | ----------------------------------- | ------------------------------ | ----------------- |
| **1. Only comps local**  | `docker compose --profile comps up` | db, anvil, api, db-seed        | comps             |
| **2. API + comps local** | `docker compose up`                 | db, anvil, db-seed             | api, comps        |
| **3. Everything Docker** | `docker compose --profile full up`  | db, anvil, api, db-seed, comps | nothing           |
| **4. Only API local**    | `docker compose --profile api up`   | db, anvil, db-seed, comps      | api               |

---

## Seeded Data

When you start the Docker Compose stack, the `db-seed` service automatically seeds the database with:

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

Private keys available in `docker/seed/src/anvil-wallets.ts`

### Get Agent API Keys

```bash
docker compose logs db-seed | grep "API Key"
# or
./local/seed/show-api-keys.sh
```

---

## Common Commands

### Basic Operations

```bash
# Start services in foreground
docker compose --profile comps up

# Start services in background
docker compose --profile comps up -d

# Stop services
docker compose down

# Stop and remove volumes (complete reset)
docker compose down -v

# View logs
docker compose logs -f
docker compose logs -f api
docker compose logs -f comps
docker compose logs db-seed | grep "API Key"

# Restart a specific service
docker compose restart api

# Rebuild a service after code changes
docker compose build api
docker compose up api
```

### Database Operations

```bash
# Access database directly
psql postgresql://postgres:postgres@localhost:5433/postgres

# Run migrations (when API is local)
cd apps/api
pnpm db:migrate

# Open Drizzle Studio (requires API's .env configured)
cd apps/api
pnpm db:studio

# Reseed database (idempotent - safe to run multiple times)
docker compose up db-seed
```

---

## MetaMask Setup

1. **Add Local Network:**

   - Network name: Anvil Local
   - RPC URL: http://localhost:8545
   - Chain ID: 31337
   - Currency symbol: ETH

2. **Import Test Account:**
   - Copy a private key from `local/seed/src/anvil-wallets.ts`
   - Import into MetaMask
   - You'll have 10,000 ETH to work with

---

## Test Agent API

```bash
# Get an API key from seed logs
API_KEY=$(docker compose logs db-seed | grep "API Key" | head -1 | awk '{print $NF}')

# Make authenticated request
curl http://localhost:3000/backend-api/api/agents/me \
  -H "Authorization: Bearer $API_KEY"
```

---

## Authentication Modes

### Mock Mode (Default, Recommended)

- No Privy account needed
- Users have fake Privy IDs: `did:privy:local-user-0`, `did:privy:local-user-1`, etc.
- Connect with any Anvil wallet address
- Perfect for local development

### Privy Mode

To use real Privy authentication:

1. Set `AUTH_MODE=privy` in your `.env` file
2. Configure Privy credentials in `apps/api/.env`
3. See `apps/api/.env.example` for required variables

---

## Smart Contracts

The Anvil container includes pre-deployed smart contracts. Contract addresses are saved in:
`packages/staking-contracts/contracts/deployments/docker/`

### Rebuild Anvil State

If contracts change, rebuild the Anvil state:

```bash
# Rebuild state with updated contracts
./local/anvil/rebuild-state.sh

# Rebuild the Anvil image
docker compose build anvil

# Restart with new state
docker compose up anvil
```

---

## Troubleshooting

### Port Conflicts

Override default ports in your `.env` file:

```env
ANVIL_PORT=8546
POSTGRES_PORT=5434
API_PORT=3002
COMPS_PORT=3002
```

### Database Issues

```bash
# Check database logs
docker compose logs db

# Restart database
docker compose restart db

# Complete database reset
docker compose down -v
docker compose up
```

### API Migration Issues

```bash
# Check if migrations ran
docker compose logs api | grep migration

# When running API locally, manually run migrations
cd apps/api
pnpm db:migrate
```

### Seeder Fails

The db-seed service expects database migrations to be complete:

- **With `--profile comps` or `--profile full`:** API container runs migrations automatically
- **Without profile (scenarios 2 & 4):** You MUST run `pnpm db:migrate` locally first

```bash
# Check seeder logs
docker compose logs db-seed

# Re-run seeder (idempotent)
docker compose up db-seed
```

### Stale Data

```bash
# Complete reset
docker compose down -v
docker compose --profile full up
```

### Node/pnpm PATH Issues

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
export PATH="/home/joe/.nvm/versions/node/v22.13.1/bin/:$PATH"
```

Then reload: `source ~/.bashrc` or `source ~/.zshrc`

---

## Performance Tips

1. **Run services in background:** Use `-d` flag for faster terminal access

   ```bash
   docker compose --profile api up -d
   ```

2. **Use Scenario 1 or 2 for active development:** Local execution is much faster than containers

3. **Keep Docker Compose running:** No need to stop/start between code changes when running locally

4. **Use Scenario 3 sparingly:** Only for testing full stack or when sharing setup

---

## Quick Reference Table

| What you're working on          | Recommended Scenario | Command                                |
| ------------------------------- | -------------------- | -------------------------------------- |
| Frontend (comps) only           | Scenario 1           | `docker compose --profile comps up`    |
| Backend (API) only              | Scenario 2 or 4      | `docker compose up` or `--profile api` |
| Full-stack development          | Scenario 2           | `docker compose up`                    |
| Everything in Docker deployment | Scenario 3           | `docker compose --profile full up`     |
