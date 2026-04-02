#!/bin/bash
# Helper script to extract agent API keys from seed logs

echo "=========================================="
echo "Agent API Keys from Seed"
echo "=========================================="
echo ""

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "Error: docker-compose not found"
    exit 1
fi

# Get container name
CONTAINER_NAME="recall-db-seed"

# Check if container exists
if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Error: Seed container not found. Run 'docker-compose up db-seed' first."
    exit 1
fi

# Extract API keys from logs
API_KEYS=$(docker logs $CONTAINER_NAME 2>&1 | grep "API Key:" | sed 's/.*API Key: //')

if [ -z "$API_KEYS" ]; then
    echo "No API keys found in logs."
    echo ""
    echo "This could mean:"
    echo "  1. The seeder hasn't run yet"
    echo "  2. The seeder failed before creating agents"
    echo "  3. The logs have been cleared"
    echo ""
    echo "Try running: docker-compose up db-seed"
    exit 1
fi

# Display keys
echo "$API_KEYS" | while IFS= read -r line; do
    echo "  $line"
done

echo ""
echo "=========================================="
echo "Total API Keys: $(echo "$API_KEYS" | wc -l | tr -d ' ')"
echo "=========================================="
echo ""
echo "Usage example:"
echo "  curl http://localhost:3000/backend-api/api/agents/me \\"
echo "    -H \"Authorization: Bearer <API_KEY>\""
echo ""
