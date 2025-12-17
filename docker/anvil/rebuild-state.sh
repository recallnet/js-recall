#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
STATE_FILE="$SCRIPT_DIR/anvil-state.json"

echo "==================================="
echo "  Rebuilding Anvil State"
echo "==================================="
echo ""
echo "This script deploys contracts to a temporary anvil instance"
echo "and saves the blockchain state for use in Docker."
echo ""

# Start anvil in background
echo "Starting temporary anvil instance..."
anvil --chain-id 31337 --dump-state "$STATE_FILE" &
ANVIL_PID=$!
sleep 2

# Deploy contracts
echo "Deploying contracts..."
cd "$REPO_ROOT/packages/staking-contracts/contracts"
ANVIL_URL=http://localhost:8545 npx hardhat deploy --network docker --reset

# Stop anvil (triggers state dump)
echo "Stopping anvil and dumping state..."
kill $ANVIL_PID
wait $ANVIL_PID 2>/dev/null || true

echo ""
echo "==================================="
echo "  State file generated!"
echo "==================================="
echo ""
echo "State saved to: $STATE_FILE"
echo ""
echo "Next steps:"
echo "  1. Rebuild the anvil image:"
echo "     docker-compose build anvil"
echo ""
echo "  2. Start the services:"
echo "     docker-compose up"
echo ""
