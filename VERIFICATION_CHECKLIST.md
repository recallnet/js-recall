# Verification Checklist

This checklist helps you verify that the database seeding implementation is working correctly.

## Pre-Flight Checks

- [ ] `.env` file exists in project root
  ```bash
  cp .env.docker-compose.example .env
  ```

- [ ] `AUTH_MODE` is set in `.env` (default: `mock`)
  ```bash
  grep AUTH_MODE .env
  ```

- [ ] Docker and Docker Compose are running
  ```bash
  docker --version
  docker-compose --version
  ```

## Step 1: Start the Stack

```bash
docker-compose up
```

### Verify:
- [ ] Anvil starts successfully (port 8546)
- [ ] PostgreSQL starts successfully (port 5433)
- [ ] API starts and runs migrations
- [ ] Seeder runs after API is ready
- [ ] Frontend starts (port 3001)

### Check Logs:
```bash
# Should show "Seeding complete!"
docker-compose logs db-seed | tail -20
```

## Step 2: Verify Seeded Data

### Check Agent API Keys
```bash
./docker/seed/show-api-keys.sh
```

- [ ] 15 API keys are displayed
- [ ] Keys start with `rcl_`

### Connect to Database
```bash
psql postgresql://postgres:postgres@localhost:5433/postgres
```

Run these queries:

```sql
-- Should return 10 users
SELECT count(*) FROM users;

-- Should return 15 agents
SELECT count(*) FROM agents;

-- Should return 4 arenas
SELECT count(*) FROM arenas;

-- Should return 5 competitions
SELECT count(*) FROM competitions;

-- Should return ~23 enrollments
SELECT count(*) FROM competition_agents;

-- View users with Anvil addresses
SELECT id, name, wallet_address, privy_id FROM users ORDER BY id;

-- View agents with owners
SELECT id, name, handle, owner_id FROM agents ORDER BY id;

-- View competitions by status
SELECT name, status, type, start_date, end_date 
FROM competitions 
ORDER BY start_date;

-- View enrollments
SELECT 
  c.name as competition,
  a.name as agent,
  ca.status
FROM competition_agents ca
JOIN competitions c ON c.id = ca.competition_id
JOIN agents a ON a.id = ca.agent_id
ORDER BY c.name, a.id;
```

### Expected Results:
- [ ] 10 users with addresses starting with `0xf39F...`, `0x7099...`, etc.
- [ ] 15 agents with handles like `alphabot...`, `momentumtrader...`
- [ ] 4 arenas: Spot Trading, Perpetuals, Cross-Chain, DeFi
- [ ] 5 competitions with various statuses
- [ ] Enrollments present for agents 0-10, none for agents 11-13

## Step 3: Verify Anvil

```bash
# Test Anvil RPC
cast block-number --rpc-url http://localhost:8546
```

- [ ] Returns a block number (should be > 0)

```bash
# Check first wallet balance
cast balance 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --rpc-url http://localhost:8546
```

- [ ] Returns ~10000 ETH (10000000000000000000000 wei)

## Step 4: Test API Endpoints

### Get Agent Info
```bash
# Replace with actual API key from show-api-keys.sh
API_KEY="rcl_..."

curl http://localhost:3000/backend-api/api/agents/me \
  -H "Authorization: Bearer $API_KEY" \
  | jq .
```

- [ ] Returns agent information (or 401 if mock auth not implemented yet)

### List Competitions
```bash
curl http://localhost:3001/api/competitions | jq .
```

- [ ] Returns list of competitions (frontend API)

## Step 5: Test Frontend

Open browser: http://localhost:3001

- [ ] Frontend loads successfully
- [ ] No console errors (check browser DevTools)
- [ ] Can see competitions (if auth not blocking)

## Step 6: Test MetaMask Connection

1. Add Anvil network to MetaMask:
   - Network Name: Anvil Local
   - RPC URL: http://localhost:8546
   - Chain ID: 31337
   - Currency: ETH

2. Import a test account:
   - Get private key from `docker/seed/src/anvil-wallets.ts`
   - Example: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`

- [ ] Network added successfully
- [ ] Account imported successfully
- [ ] Balance shows ~10,000 ETH

## Step 7: Test Idempotency

Run seeder again:
```bash
docker-compose up db-seed
```

- [ ] No duplicate key errors (or skips existing records gracefully)
- [ ] Completes successfully

## Step 8: Test Reset

```bash
docker-compose down -v
docker-compose up
```

- [ ] All data is recreated
- [ ] Same API keys are regenerated
- [ ] Same enrollments exist

## Step 9: Verify Documentation

- [ ] `QUICK_START.md` exists and is readable
- [ ] `LOCAL_DEV.md` exists and is comprehensive
- [ ] `docker/seed/README.md` exists and detailed
- [ ] `.env.docker-compose.example` exists with comments
- [ ] `Makefile` exists with shortcuts

## Step 10: Test Makefile Commands

```bash
# Test various commands
make help       # Shows help
make status     # Shows service status
make logs-seed  # Shows seed logs
make keys       # Shows API keys
```

- [ ] All commands work without errors

## Common Issues & Solutions

### Issue: Seeder exits immediately
**Check:**
```bash
docker-compose logs db-seed
```
**Solution:** Ensure DB is ready, migrations have run

### Issue: Port conflicts
**Solution:** Change ports in `.env`:
```env
ANVIL_PORT=8547
POSTGRES_PORT=5434
```

### Issue: Duplicate key errors on reseed
**Expected:** Seeder is idempotent and will skip existing records

### Issue: API keys not showing
**Solution:** 
```bash
docker-compose logs db-seed | grep "API Key"
```

## Success Criteria

✅ All services start without errors
✅ Database contains 10 users, 15 agents, 4 arenas, 5 competitions
✅ Agent API keys are accessible
✅ Anvil wallets are funded (10,000 ETH each)
✅ Competitions have correct statuses (1 completed, 2 active, 2 pending)
✅ Some agents are enrolled, others are free (11-13)
✅ Frontend is accessible
✅ Documentation is complete and accurate
✅ Makefile shortcuts work
✅ Reset clears and reseeds successfully

## Final Validation

Run this complete test sequence:

```bash
# 1. Clean slate
make reset

# 2. Start fresh
make start

# 3. Wait for seeding to complete (watch logs)
make logs-seed

# 4. Verify data
make db-shell
# Run SQL queries above

# 5. Get API keys
make keys

# 6. Test API (if mock auth implemented)
curl http://localhost:3000/backend-api/api/agents/me \
  -H "Authorization: Bearer <KEY>"

# 7. Test frontend
open http://localhost:3001
```

If all steps complete successfully: **✅ IMPLEMENTATION VERIFIED**

## Next Steps After Verification

1. **Implement Mock Auth** (if not done)
   - Add middleware to API for `AUTH_MODE=mock`
   - Accept wallet address for authentication
   - Skip Privy validation in mock mode

2. **Test Frontend Integration**
   - Add wallet selector for mock mode
   - Test competition enrollment flows
   - Verify agent dashboard

3. **Document API Changes**
   - Update API README with mock auth info
   - Document authentication endpoints

4. **Production Considerations**
   - Never use `AUTH_MODE=mock` in production
   - Keep Anvil wallets private (local dev only)
   - Use strong Privy configuration for production

## Support

If verification fails, check:
1. Logs: `docker-compose logs <service>`
2. Documentation: `LOCAL_DEV.md`
3. Troubleshooting: `docker/seed/README.md`
