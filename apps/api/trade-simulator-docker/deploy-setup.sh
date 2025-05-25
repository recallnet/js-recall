#!/bin/bash
set -e

# Multi-Chain Trading Simulator Deployment Script
# This script handles deployment to DigitalOcean

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Go to project root directory (one level up from script location)
cd "$(dirname "$0")/.."
ROOT_DIR=$(pwd)

echo -e "${GREEN}=== Multi-Chain Trading Simulator Deployment ===${NC}"
echo "This script will deploy the trading simulator to DigitalOcean."

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# ALWAYS use .env.production for deployment
if [ -f .env.production ]; then
    echo -e "${GREEN}Using .env.production for deployment${NC}"
    # Make a copy to .env (required for docker-compose)
    cp .env.production .env
else
    echo -e "${RED}No .env.production file found. Please create a .env.production file before deployment.${NC}"
    exit 1
fi

# Ensure .env file has the right permissions 
echo -e "${YELLOW}Setting proper permissions on .env file so the application can modify it...${NC}"
chmod 666 .env

# Warn about environment configuration
echo -e "${YELLOW}IMPORTANT: Make sure all required environment variables are set in your .env.production file${NC}"
echo -e "${YELLOW}Note: The .env file (copied from .env.production) is mounted into the container and the application can modify it directly${NC}"

# Build and start the containers with health checks
echo -e "${GREEN}Building and starting containers...${NC}"
cd trade-simulator-docker
docker-compose up -d --build
cd "$ROOT_DIR"

# Docker Compose will handle waiting for containers to be healthy
echo -e "${GREEN}Waiting for services to be ready (this may take a minute)...${NC}"
echo -e "${YELLOW}You can check progress with: docker-compose -f trade-simulator-docker/docker-compose.yml ps${NC}"

# Wait for the API to be accessible
MAX_RETRIES=30
RETRY_COUNT=0
API_READY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$API_READY" = false ]; do
    # Check if the app container is healthy
    if docker-compose -f trade-simulator-docker/docker-compose.yml ps app | grep -q "Up (healthy)"; then
        API_READY=true
        echo -e "${GREEN}API is now ready!${NC}"
    else
        if [ $((RETRY_COUNT % 5)) -eq 0 ]; then
            echo -e "${YELLOW}Waiting for API to be ready... ($(docker-compose -f trade-simulator-docker/docker-compose.yml ps app | grep app))${NC}"
        fi
        sleep 2
        RETRY_COUNT=$((RETRY_COUNT+1))
    fi
done

if [ "$API_READY" = false ]; then
    echo -e "${RED}API failed to become ready after multiple attempts.${NC}"
    echo -e "${YELLOW}You can check the container logs with: docker-compose -f trade-simulator-docker/docker-compose.yml logs app${NC}"
    exit 1
fi

# Run database initialization after we confirm the API is up
echo -e "${GREEN}Initializing database...${NC}"
if ! docker-compose -f trade-simulator-docker/docker-compose.yml exec -T app pnpm db:migrate; then
    echo -e "${RED}Failed to initialize the database.${NC}"
    echo -e "${YELLOW}You can check for errors with: docker-compose -f trade-simulator-docker/docker-compose.yml logs app${NC}"
    exit 1
fi

PORT_VAL=$(grep "^PORT=" .env | cut -d '=' -f2 || echo "3000")
SERVER_URL="http://localhost:${PORT_VAL:-3000}"

echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo -e "Your Multi-Chain Trading Simulator is now running!"
echo -e "Access it at ${SERVER_URL}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"

# Admin setup instructions
echo -e "${GREEN}1. Set up admin account:${NC}"
echo -e "   Use the following API endpoint to create an admin account:"
echo -e "   ${YELLOW}POST ${SERVER_URL}/api/admin/setup${NC}"
echo -e "   ${YELLOW}Content-Type: application/json${NC}"
echo -e "   ${YELLOW}Request body:${NC}"
echo -e '   {
     "username": "admin",
     "password": "your-secure-password",
     "email": "admin@example.com"
   }'
echo -e "   ${RED}IMPORTANT: Save the API key returned in the response. It will only be shown once!${NC}"
echo -e "   Note: The application may update the ROOT_ENCRYPTION_KEY in your .env file during setup."
echo ""

# User and agent registration instructions
echo -e "${GREEN}2. Register users and agents:${NC}"
echo -e "   Use your admin API key with the following command:"
echo -e "   ${YELLOW}curl -X POST ${SERVER_URL}/api/admin/users \\
     -H 'Authorization: Bearer YOUR_ADMIN_API_KEY' \\
     -H 'Content-Type: application/json' \\
     -d '{
       \"name\": \"User Alpha\",
       \"email\": \"user@example.com\",
       \"walletAddress\": \"0x1234567890123456789012345678901234567890\",
       \"agentName\": \"Agent Alpha\"   
     }'${NC}"
echo -e "   ${RED}Note: Save the API key for each user's agent. It will only be shown once!${NC}"
echo ""

# Competition instructions
echo -e "${GREEN}3. Create and start a competition:${NC}"
echo -e "   Use your admin API key with the following command:"
echo -e "   ${YELLOW}curl -X POST ${SERVER_URL}/api/admin/competition/start \\
     -H 'Authorization: Bearer YOUR_ADMIN_API_KEY' \\
     -H 'Content-Type: application/json' \\
     -d '{
       \"name\": \"Trading Competition 2023\",
       \"description\": \"Annual trading competition\",
       \"agentIds\": [\"agent-id-1\", \"agent-id-2\"]
     }'${NC}"
echo ""

echo -e "${YELLOW}For DigitalOcean deployment:${NC}"
echo -e "1. Create a new Droplet (recommended: 2GB RAM, 50GB SSD)"
echo -e "2. Install Docker and Docker Compose on the Droplet"
echo -e "3. Transfer your project files to the Droplet"
echo -e "4. Run this script on the Droplet"
echo -e "5. Configure your firewall to allow port ${PORT_VAL:-3000}" 