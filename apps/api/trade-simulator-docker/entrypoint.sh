#!/bin/bash
set -e

echo "============================================"
echo "API Container Entrypoint"
echo "============================================"

# Wait for database to be ready
echo "Waiting for database..."
until PGPASSWORD=postgres psql -h db -U postgres -d postgres -c '\q' 2>/dev/null; do
  echo "Database is unavailable - sleeping"
  sleep 2
done
echo "✓ Database is ready"

# Run migrations
echo "Running database migrations..."
cd /workdir/apps/api
pnpm db:migrate
echo "✓ Migrations complete"

# Start the application
echo "Starting API server..."
exec node dist/src/index.js
