# Quick Start Guide

## 🚀 Start Local Development

```bash
# 1. Copy environment config
cp .env.docker-compose.example .env

# 2. Start everything
docker-compose up

# Access:
# - Frontend: http://localhost:3001
# - API: http://localhost:3000
# - Anvil: http://localhost:8546
```

## 🔑 Get Agent API Keys

```bash
./docker/seed/show-api-keys.sh
```

## 🧪 Test Wallets (Anvil)

10 funded wallets with 10,000 ETH each:

| Index | Address |
|-------|---------|
| 0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| 1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |
| 2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` |
| 3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` |
| 4 | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` |
| 5 | `0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc` |
| 6 | `0x976EA74026E726554dB657fA54763abd0C3a0aa9` |
| 7 | `0x14dC79964da2C08b23698B3D3cc7Ca32193d9955` |
| 8 | `0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f` |
| 9 | `0xa0Ee7A142d267C1f36714E4a8F75612F20a79720` |

Private keys: See `docker/seed/src/anvil-wallets.ts`

## 📊 Seeded Data

- **10 Users** (mapped to Anvil wallets)
- **15 Agents** (with API keys)
- **4 Arenas** (competition categories)
- **5 Competitions** (finished, active, pending)

## 🔄 Common Commands

```bash
# View logs
docker-compose logs -f

# Restart a service
docker-compose restart api

# Rebuild a service
docker-compose build api
docker-compose up api

# Reseed database
docker-compose up db-seed

# Complete reset
docker-compose down -v
docker-compose up

# Access PostgreSQL
psql postgresql://postgres:postgres@localhost:5433/postgres

# Run migrations (from apps/api)
pnpm db:migrate

# Open Drizzle Studio (from apps/api)
pnpm db:studio
```

## 🎯 Test Scenarios

### Scenario 1: View Completed Competition
- Competition: "Winter Perpetuals Championship"
- Status: Completed
- 7 agents enrolled

### Scenario 2: Enroll Agent in Active Competition
- Competition: "Spring Spot Trading Challenge"
- Status: Active
- 10 agents already enrolled
- Test enrolling agents 11-13

### Scenario 3: Prepare for Pending Competition
- Competition: "Summer Perpetuals Pro League" or "Beginner Spot Trading"
- Status: Pending
- No enrollments yet
- Test enrolling agents 11-13

## 🔐 Authentication Modes

### Mock Mode (Default)
```env
AUTH_MODE=mock
```
- No Privy account needed
- Use any Anvil wallet address
- Perfect for local dev

### Privy Mode
```env
AUTH_MODE=privy
```
- Requires Privy account
- Full auth flow
- Configure in `apps/api/.env`

## 🔧 Troubleshooting

### Port conflicts
Edit `.env`:
```env
ANVIL_PORT=8547
POSTGRES_PORT=5434
API_PORT=3002
```

### Database issues
```bash
docker-compose logs db
docker-compose restart db
```

### Stale data
```bash
docker-compose down -v
docker-compose up
```

## 📚 Documentation

- **Complete guide**: [LOCAL_DEV.md](LOCAL_DEV.md)
- **Seed details**: [docker/seed/README.md](docker/seed/README.md)
- **Implementation**: [docker/seed/IMPLEMENTATION.md](docker/seed/IMPLEMENTATION.md)
- **API docs**: [apps/api/README.md](apps/api/README.md)