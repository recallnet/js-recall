# Trading Simulator Docker Deployment

Simple Docker deployment for the Multi-Chain Trading Simulator.

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL running in a separate process/VM (not included in this Docker setup)

## Setup

### 1. Create Environment File

Create a `.env` file in `apps/api/trade-simulator-docker/` with your configuration, similar to [.env.example](../.env.example).

### 2. Run the Application

From the `apps/api/trade-simulator-docker` directory, run:

```bash
docker-compose -f docker-compose.yml up --build
```

## Notes

- This setup assumes PostgreSQL is running separately (not in Docker)
- Make sure your `DATABASE_URL` points to your external PostgreSQL instance
- The application will automatically handle database migrations on startup
