#!/bin/bash

# Stop Monitoring Stack for js-recall API
# This script stops and cleans up the Prometheus and Grafana containers

set -e

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

# Navigate to the monitoring directory
cd "$(dirname "$0")"

print_status "Stopping monitoring stack..."

# Parse command line arguments
REMOVE_VOLUMES=false
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--volumes)
            REMOVE_VOLUMES=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -v, --volumes    Remove volumes (deletes all monitoring data)"
            echo "  -h, --help       Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Stop containers
if $REMOVE_VOLUMES; then
    print_warning "Stopping containers and removing volumes (this will delete all monitoring data)..."
    docker compose down -v
    print_status "✓ Containers stopped and volumes removed"
else
    print_status "Stopping containers (volumes preserved)..."
    docker compose down
    print_status "✓ Containers stopped"
fi

# Clean up bearer token file for security
if [ -f "bearer_token.txt" ]; then
    rm bearer_token.txt
    print_status "✓ Bearer token file cleaned up"
fi

# Check if containers are actually stopped
if ! docker ps --format "table {{.Names}}" | grep -q "js-recall-prometheus\|js-recall-grafana"; then
    print_status "✓ All monitoring containers have been stopped"
else
    print_warning "Some containers may still be running. Check with 'docker ps'"
fi

print_status "Monitoring stack stopped successfully!"
print_status ""
if $REMOVE_VOLUMES; then
    print_status "All monitoring data has been removed."
    print_status "Next time you start the monitoring stack, you'll need to:"
    print_status "1. Set up Grafana again at http://localhost:3002 (admin/admin)"
    print_status "2. Add Prometheus data source: http://prometheus:9090"
    print_status "3. Import the dashboard from grafana-dashboard.json"
else
    print_status "Monitoring data has been preserved."
    print_status "When you restart the monitoring stack, all data will be restored."
fi
print_status ""
print_status "To restart the monitoring stack, run: ./start-monitoring.sh"
