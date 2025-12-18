# Database Seeding Service

This service seeds the local development database with realistic test data, including users mapped to Anvil's funded wallets, agents, competitions, and enrollments.

## What Gets Seeded

### 1. **Arenas** (4 arenas)
- Spot Trading
- Perpetuals Trading
- Cross-Chain Trading
- DeFi Strategies

### 2. **Users** (10 users)
- Mapped to Anvil's 10 default funded wallets
- Each wallet has 10,000 ETH for testing
- Users include mock Privy IDs or real Privy integration

### 3. **Agents** (15 agents)
- Users 0-5: 2 agents each
- Users 6-9: 1 agent each
- Each agent has a unique API key (logged during seeding)
- Various trading strategies (Alpha Bot, Momentum Trader, Market Maker)

### 4. **Competitions** (5 competitions)
- **Winter Perpetuals Championship** - Completed (Feb 2024)
- **Spring Spot Trading Challenge** - Active (Mar-Apr 2024)
- **Cross-Chain Masters Series** - Active (Mar-May 2024)
- **Summer Perpetuals Pro League** - Pending (Jun-Aug 2024)
- **Beginner Spot Trading** - Pending (May 2024)

### 5. **Agent Enrollments**
- 7 agents enrolled in Winter Perpetuals (finished)
- 10 agents enrolled in Spring Spot Trading
- 6 agents enrolled in Cross-Chain Masters
- **Agents 11-13 left unenrolled for manual testing**

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | Required | PostgreSQL connection string |
| `AUTH_MODE` | `mock` | Authentication mode: `mock` or `privy` |
| `SKIP_WAIT` | `false` | Skip waiting for database (for manual runs) |

### Authentication Modes

#### Mock Mode (Default)
- Users get fake Privy IDs like `did:privy:local-user-0`
- No real Privy integration needed
- Best for pure local development
- API should bypass Privy auth checks when `AUTH_MODE=mock`

#### Privy Mode
- Users are created with `privyId: null`
- You must manually link Anvil wallets in Privy dashboard
- Required for testing real Privy authentication flows
- Set `AUTH_MODE=privy` in `.env`

## Usage

### With Docker Compose (Recommended)

The seed service runs automatically when you start the stack:

```bash
docker-compose up
```

The service will:
1. Wait for the database to be ready
2. Wait for the API to start (which runs migrations)
3. Seed all data
4. Exit successfully

### Manual Run (Development)

From the repository root:

```bash
# Install dependencies
pnpm install

# Set environment variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/postgres"
export AUTH_MODE="mock"

# Run the seeder
cd docker/seed
pnpm seed
```

### Rebuild Seed Service

If you modify the seed data or scripts:

```bash
docker-compose build db-seed
docker-compose up db-seed
```

## Anvil Wallets

The seeder uses Anvil's 10 deterministic test wallets:

| Index | Address | ETH Balance |
|-------|---------|-------------|
| 0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | 10,000 |
| 1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | 10,000 |
| 2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | 10,000 |
| 3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | 10,000 |
| 4 | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | 10,000 |
| 5 | `0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc` | 10,000 |
| 6 | `0x976EA74026E726554dB657fA54763abd0C3a0aa9` | 10,000 |
| 7 | `0x14dC79964da2C08b23698B3D3cc7Ca32193d9955` | 10,000 |
| 8 | `0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f` | 10,000 |
| 9 | `0xa0Ee7A142d267C1f36714E4a8F75612F20a79720` | 10,000 |

Private keys are available in `src/anvil-wallets.ts` for testing.

## Modifying Seed Data

### Add/Edit Arenas

Edit `data/arenas.json`:

```json
{
  "name": "My Arena",
  "category": "trading",
  "skill": "custom",
  "venues": ["dex"],
  "chains": ["ethereum"],
  "kind": "competitive"
}
```

### Add/Edit Competitions

Edit `data/competitions.json`. See existing entries for the full schema.

Key fields:
- `status`: `"completed"`, `"active"`, or `"pending"`
- `type`: `"perpetuals"`, `"spot-live"`, etc.
- `arenaName`: Must match an arena name
- `tradingConfig`: Competition-specific configuration

### Modify Agent Enrollment

Edit `src/competitions.ts`, function `enrollAgentsInCompetitions()`:

```typescript
const enrollmentPlan = [
  {
    competition: "My Competition",
    agentIndexes: [0, 1, 2], // Which agents to enroll
    status: "active" as const,
  },
];
```

## Troubleshooting

### Seeder exits immediately
- Check `docker-compose logs db-seed` for errors
- Ensure database is running: `docker-compose ps db`
- Verify migrations have run: `docker-compose logs api`

### Duplicate key errors
- Database already has data from previous run
- Either:
  - Let the seeder skip existing records (it's idempotent)
  - Reset the database: `docker-compose down -v && docker-compose up`

### Agent API keys not visible
- Check seeder logs: `docker-compose logs db-seed`
- API keys are logged during agent creation
- They're also stored in the database (hashed)

### Privy mode not working
- Ensure `AUTH_MODE=privy` in `.env`
- Link Anvil wallet addresses to Privy users
- Configure Privy app credentials in API `.env`

## Next Steps After Seeding

1. **Access the frontend**: http://localhost:3001
2. **Access the API**: http://localhost:3000
3. **Use an agent API key** from the seed logs to make API calls
4. **Test with Anvil wallets** - connect MetaMask to http://localhost:8546
5. **Manual enrollments** - Test enrolling agents 7-13 in pending competitions

## Clean Slate

To completely reset and reseed:

```bash
# Stop and remove all data
docker-compose down -v

# Restart (will reseed)
docker-compose up
```
