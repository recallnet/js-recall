#!/bin/sh

# Cron runner script for local development
# Calls the comps app cron endpoints with proper authentication

set -e

COMPS_URL="${COMPS_URL:-http://host.docker.internal:3001}"
CRON_SECRET="${CRON_SECRET:-local-dev-secret}"

# Silent retry - if endpoint is unavailable, just log and continue
call_cron() {
  endpoint="$1"

  echo "[$(date -Iseconds)] Running: $endpoint"

  response=$(curl -s -w "\n%{http_code}" -X GET \
    "${COMPS_URL}/api/cron/${endpoint}" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "Content-Type: application/json" \
    --connect-timeout 5 \
    --max-time 120 \
    2>/dev/null) || {
      echo "[$(date -Iseconds)] $endpoint: Connection failed (comps not ready?)"
      return 0
    }

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "200" ]; then
    echo "[$(date -Iseconds)] $endpoint: OK"
  else
    echo "[$(date -Iseconds)] $endpoint: HTTP $http_code"
    echo "$body" | head -c 200
    echo ""
  fi
}

# Main entry point - called by supercronic with endpoint name as argument
case "$1" in
  "auto-start-competitions"|"auto-end-competitions"|"take-portfolio-snapshots"|"process-perps-competitions"|"auto-calculate-rewards"|"index-staking-events"|"index-staking-transactions")
    call_cron "$1"
    ;;
  *)
    echo "Usage: $0 <endpoint>"
    echo "Valid endpoints:"
    echo "  auto-start-competitions"
    echo "  auto-end-competitions"
    echo "  take-portfolio-snapshots"
    echo "  process-perps-competitions"
    echo "  auto-calculate-rewards"
    echo "  index-staking-events"
    echo "  index-staking-transactions"
    exit 1
    ;;
esac
