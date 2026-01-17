#!/bin/bash
set -e

STATE_FILE="/tmp/anvil-state.json"

echo "==================================="
echo "  Generating Anvil State"
echo "==================================="
echo ""

# Start anvil in background with dump-state
echo "Starting anvil in background..."
anvil --chain-id 31337 --dump-state "$STATE_FILE" &
ANVIL_PID=$!
sleep 3

# Wait for anvil to be ready
echo "Waiting for anvil to be ready..."
for i in {1..10}; do
  if cast block-number --rpc-url http://localhost:8545 > /dev/null 2>&1; then
    echo "Anvil is ready!"
    break
  fi
  if [ $i -eq 10 ]; then
    echo "Error: Anvil failed to start"
    kill $ANVIL_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

# Deploy contracts and capture output
echo "Deploying contracts..."
cd /contracts
ANVIL_URL=http://localhost:8545 npx hardhat deploy --network docker --reset 2>&1 | tee /tmp/deploy-output.log

# Extract and display contract addresses for documentation
echo ""
echo "==================================="
echo "  Deployed Contract Addresses"
echo "==================================="
echo ""
grep -E "(deployed to|deployed at|created at):" /tmp/deploy-output.log || echo "See deployment logs above for addresses"
echo ""

# Stop anvil (triggers state dump)
echo "Stopping anvil and dumping state..."
kill $ANVIL_PID 2>/dev/null || true
sleep 1

# Check if process is still running and force kill if necessary
if ps -p $ANVIL_PID > /dev/null 2>&1; then
    echo "Anvil didn't stop gracefully, forcing shutdown..."
    kill -9 $ANVIL_PID 2>/dev/null || true
fi

wait $ANVIL_PID 2>/dev/null || true

# Verify anvil is stopped
if ps -p $ANVIL_PID > /dev/null 2>&1; then
    echo "Warning: Anvil process $ANVIL_PID may still be running"
else
    echo "Anvil stopped successfully"
fi

# Verify state file was created
if [ ! -f "$STATE_FILE" ]; then
    echo "Error: State file was not created!"
    exit 1
fi

if [ ! -s "$STATE_FILE" ]; then
    echo "Error: State file is empty!"
    exit 1
fi

echo ""
echo "==================================="
echo "  State file generated!"
echo "==================================="
echo ""
echo "State saved to: $STATE_FILE"
ls -lh "$STATE_FILE"
