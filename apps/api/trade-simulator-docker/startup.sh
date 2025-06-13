#!/bin/sh
set -e

# Function to check if database is initialized
check_db_initialized() {
    # Check if the main schema exists
    psql "$DATABASE_URL" -t -c "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'trading_comps';" 2>/dev/null | grep -q 1
}

# Wait for database to be ready
echo "Waiting for database to be ready..."
until pg_isready -d "$DATABASE_URL" 2>/dev/null; do
    echo "Database not ready, waiting..."
    sleep 2
done

# Check if we need to run migrations
if ! check_db_initialized; then
    echo "Database not initialized, running migrations..."
    
    # Check if we should run baseline + migrations or just migrations
    if [ "${RUN_BACKFILL:-true}" = "true" ]; then
        echo "Running baseline and migrations (RUN_BACKFILL=true)..."
        cd /workdir/apps/api && pnpm db:prepare-production
        echo "Baseline and migrations completed"
    else
        echo "Running migrations only (RUN_BACKFILL=false)..."
        cd /workdir/apps/api && pnpm db:migrate
        echo "Migrations completed"
    fi
else
    echo "Database already initialized, skipping migrations"
fi

# Start the application
exec node dist/src/index.js 