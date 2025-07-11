# Trading Simulator Docker Deployment

Simple Docker deployment for the Multi-Chain Trading Simulator.

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL running in a separate process/VM (not included in this Docker setup)

## Setup

### 1. Create Environment File

Create a `.env` file in `apps/api/trade-simulator-docker/` with your configuration, similar to [.env.example](.env.example).

### 2. Run the Application

#### Option A: Using Docker Compose (Recommended)

From the `apps/api/trade-simulator-docker` directory, run:

```bash
# Start the application (builds if needed)
docker-compose -f docker-compose.test.yml up

# Or run in detached mode (background)
docker-compose -f docker-compose.test.yml up -d

# Stop and remove containers
docker-compose -f docker-compose.test.yml down --volumes
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

## Health Checks

The application provides health check endpoints that respect the `API_PREFIX` environment variable:

### Main API Server (Port 3000)

- **No API_PREFIX**: Health checks available at `/health` and `/api/health`
- **With API_PREFIX** (e.g., `API_PREFIX=testing-grounds`): Health checks at `/testing-grounds/health` and `/testing-grounds/api/health`

### Metrics Server (Port 3003)

- **Health check**: `GET :3003/health` (no authentication required)
- **Prometheus metrics**: `GET :3003/metrics` (no authentication required)
- **Service info**: `GET :3003/` (service information)

The Docker Compose health check automatically adjusts to use the correct endpoint based on your `API_PREFIX` setting.

## Configuration

### Environment Variables

The following environment variables control the server configuration:

| Variable       | Default     | Description                                |
| -------------- | ----------- | ------------------------------------------ |
| `PORT`         | `3000`      | Main API server port                       |
| `METRICS_PORT` | `3003`      | Metrics server port                        |
| `METRICS_HOST` | `127.0.0.1` | Metrics server bind address                |
| `API_PREFIX`   | (none)      | API route prefix (e.g., `testing-grounds`) |

### Port Access

- **Main API**: Access your API at `http://localhost:3000` (or your configured `PORT`)
- **Metrics**: Access Prometheus metrics at `http://localhost:3003/metrics` (or your configured `METRICS_PORT`)

For production deployments, the metrics server binds to localhost by default for security. Set `METRICS_HOST=0.0.0.0` only in secure network environments.

## Notes

- This setup assumes PostgreSQL is running separately (not in Docker)
- Make sure your `DATABASE_URL` points to your external PostgreSQL instance
- The application will automatically handle database migrations on startup
- Both main API and metrics servers start automatically
- Set `API_PREFIX` in your `.env` file if you need custom API routing (e.g., `API_PREFIX=testing-grounds`)

## Database Initialization Options

The Docker container supports two database initialization modes controlled by the `RUN_BACKFILL` environment variable:

### Legacy/Production Setup (Default)

```bash
RUN_BACKFILL=true  # Default if not specified
```

- Applies baseline SQL file (if present at `apps/api/baseline/baseline.sql`)
- Then runs all Drizzle migrations
- Use this for production deployments with historical data

### Modern/Clean Setup

```bash
RUN_BACKFILL=false
```

- Runs only Drizzle migrations (no baseline)
- Use this for fresh deployments without legacy data

### Setup Instructions

**For legacy/production databases:**

1. Place your baseline SQL file at `apps/api/baseline/baseline.sql`
2. Set `RUN_BACKFILL=true` in your `.env` (or omit it, as this is the default)
3. Start the container - baseline and migrations will be applied automatically

**For modern/clean databases:**

1. Set `RUN_BACKFILL=false` in your `.env`
2. Start the container - only Drizzle migrations will be applied

**Note:** If the database is already initialized, the container will skip migration steps on subsequent runs regardless of the `RUN_BACKFILL` setting.
