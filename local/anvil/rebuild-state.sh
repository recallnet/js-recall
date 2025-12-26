#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
STATE_FILE="$SCRIPT_DIR/anvil-state.json"

echo "==================================="
echo "  Rebuilding Anvil State"
echo "==================================="
echo ""
echo "This script deploys contracts to an anvil instance running in a container"
echo "and extracts the blockchain state for use in Docker."
echo ""

# Remove old state file if it exists
rm -f "$STATE_FILE"

# Build the state generation image
echo "Building state generation container..."
cd "$REPO_ROOT"
docker build -f docker/anvil/Dockerfile.stategen -t recall-anvil-stategen .

# Run the container to generate state
echo ""
echo "Running state generation container..."
CONTAINER_ID=$(docker run -d recall-anvil-stategen)

# Follow the logs
docker logs -f "$CONTAINER_ID" 2>&1 || true

# Wait for container to finish
echo ""
echo "Waiting for container to complete..."
docker wait "$CONTAINER_ID" > /dev/null 2>&1 || true

# Copy the state file out of the container
echo "Extracting state file from container..."
docker cp "$CONTAINER_ID:/tmp/anvil-state.json" "$STATE_FILE" 2>/dev/null || true

# Remove the container now that we've copied the file
echo "Cleaning up container..."
docker rm "$CONTAINER_ID" > /dev/null 2>&1

# Verify state file was created and is not empty
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
echo "File size: $(ls -lh "$STATE_FILE" | awk '{print $5}')"
echo ""
echo "Next steps:"
echo "  1. Rebuild the anvil image:"
echo "     docker compose build anvil"
echo ""
echo "  2. Start the services:"
echo "     docker compose up"
echo ""
