# Trading Simulator Docker Deployment

Simple Docker deployment for the Multi-Chain Trading Simulator.

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL running in a separate process/VM (not included in this Docker setup)

## Setup

### 1. Create Environment File

Create a `.env` file in `apps/api/trade-simulator-docker/` with your configuration, similar to [.env.example](../.env.example).

### 2. Run the Application

#### Option A: Using Docker Compose (Recommended)

From the `apps/api/trade-simulator-docker` directory, run:

```bash
# Start the application (builds if needed)
docker-compose -f docker-compose.yml up --build

# Or run in detached mode (background)
docker-compose -f docker-compose.yml up --build -d

# Stop and remove containers
docker-compose -f docker-compose.yml down
```

#### Option B: Using Docker Build + Run

From the repository root directory, build the image:

```bash
docker build -t "my-api-tag:latest" -f apps/api/trade-simulator-docker/Dockerfile .
```

Then run the container:

```bash
docker run -p 3000:3000 --env-file apps/api/trade-simulator-docker/.env my-api-tag:latest
```

## Notes

- This setup assumes PostgreSQL is running separately (not in Docker)
- Make sure your `DATABASE_URL` points to your external PostgreSQL instance
- The application will automatically handle database migrations on startup
