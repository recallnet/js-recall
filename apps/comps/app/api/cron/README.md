# Cron Endpoints

Automated competition management tasks protected by bearer token authentication.

## Authentication

All endpoints require the `Authorization: Bearer <CRON_SECRET>` header.

Set `CRON_SECRET` environment variable to a secure random string.

## Endpoints

- `POST /api/cron/auto-start-competitions` - Starts competitions that reached their start date
- `POST /api/cron/auto-end-competitions` - Ends competitions that reached their end date
- `POST /api/cron/auto-calculate-rewards` - Calculates rewards and sends Slack report (requires `REWARDS_SLACK_WEBHOOK_URL`, `REWARDS_TOKEN_CONTRACT_ADDRESS`, `REWARDS_CONTRACT_ADDRESS`)
- `POST /api/cron/nfl/plays` - Ingests live NFL play-by-play data every minute for active competitions (requires `SPORTSDATAIO_API_KEY`)
- `POST /api/cron/nfl/schedule` - Syncs NFL schedules every 5 minutes; accepts optional `season` query parameter (defaults to current year) and requires `SPORTSDATAIO_API_KEY`

## Setup

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/auto-start-competitions",
      "schedule": "* * * * *"
    }
  ]
}
```

## Testing

```bash
curl -X POST https://your-domain.com/api/cron/auto-start-competitions \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
