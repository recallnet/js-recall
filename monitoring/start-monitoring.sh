#!/bin/bash

# Start Monitoring Stack for js-recall API
# This script sets up Prometheus and Grafana to monitor the Express API
# Usage: ./start-monitoring.sh <bearer_token>

set -e

# Check if bearer token is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <bearer_token>"
    echo "Example: $0 your-bearer-token-here"
    exit 1
fi

BEARER_TOKEN="$1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker compose > /dev/null 2>&1; then
    print_error "Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
fi

print_status "Starting Prometheus monitoring stack..."

# Navigate to the monitoring directory
cd "$(dirname "$0")"

# Create necessary directories
mkdir -p prometheus_data grafana_data

# Create bearer token file
echo "$BEARER_TOKEN" > bearer_token.txt
chmod 600 bearer_token.txt
print_status "Bearer token file created"

# Export bearer token for docker compose
export BEARER_TOKEN="$BEARER_TOKEN"

# Start the services
docker compose up -d

# Wait for services to start
print_status "Waiting for services to start..."
sleep 10

# Check if Prometheus is running
if curl -s http://localhost:9090/-/healthy > /dev/null; then
    print_status "✓ Prometheus is running at http://localhost:9090"
else
    print_warning "Prometheus might still be starting up. Check http://localhost:9090 in a few moments."
fi

# Check if Grafana is running
if curl -s http://localhost:3002/api/health > /dev/null; then
    print_status "✓ Grafana is running at http://localhost:3002"
    print_status "  Default credentials: admin/admin"
else
    print_warning "Grafana might still be starting up. Check http://localhost:3002 in a few moments."
fi

print_status "Monitoring stack started successfully!"
print_status ""
print_status "Next steps:"
print_status "1. Make sure your API is running on port 3000"
print_status "2. Access Prometheus at http://localhost:9090"
print_status "3. Access Grafana at http://localhost:3002 (admin/admin)"
print_status "4. In Grafana, add Prometheus as a data source: http://prometheus:9090"
print_status ""
print_status "Available metrics from your API:"
print_status "- db_query_duration_ms (Database query duration)"
print_status "- db_queries_total (Total database queries)"
print_status "- nodejs_* (Node.js runtime metrics)"
print_status "- process_* (Process metrics)"
print_status ""
print_status "To stop the monitoring stack, run: docker compose down"
print_status "Note: The bearer token file (bearer_token.txt) will be cleaned up on container restart"
