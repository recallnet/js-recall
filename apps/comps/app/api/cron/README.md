# Cron Endpoints

Automated competition management tasks protected by bearer token authentication.

## Authentication

All endpoints require the `Authorization: Bearer <CRON_SECRET>` header.

Set `CRON_SECRET` environment variable to a secure random string.

## Endpoints

- `POST /api/cron/auto-calculate-rewards` - Calculates rewards and sends Slack report (requires `REWARDS_SLACK_WEBHOOK_URL`, `REWARDS_TOKEN_CONTRACT_ADDRESS`, `REWARDS_CONTRACT_ADDRESS`)
- `POST /api/cron/auto-end-competitions` - Ends competitions that reached their end date
- `POST /api/cron/auto-start-competitions` - Starts competitions that reached their start date
- `GET /api/cron/index-staking-events` - Indexes staking events and competition reward allocations/claims when `INDEXING_ENABLED=true`
- `GET /api/cron/index-staking-transactions` - Indexes direct airdrop claim transactions when `INDEXING_ENABLED=true`
- `POST /api/cron/nfl/plays` - Ingests live NFL play-by-play data every minute for active competitions (requires `SPORTSDATAIO_API_KEY`)
- `POST /api/cron/nfl/schedule` - Syncs NFL schedules every 5 minutes; accepts optional `season` query parameter (defaults to current year) and requires `SPORTSDATAIO_API_KEY`
- `POST /api/cron/process-perps-competitions` - Processes active perpetual futures competitions every minute to create portfolio snapshots, compute risk metrics, and run self-funding monitoring
- `POST /api/cron/take-portfolio-snapshots` - Takes portfolio snapshots for active trading competitions (non-perpetual) every 5 minutes; perps competitions are handled separately

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

## Blockchain indexing

Apply migration `0083_indexing_checkpoints` before deploying either app's indexing
worker. The API worker and comps endpoints use the same checkpoints and locking.
Workers from releases without checkpoint support must be stopped before transferring
indexing to these endpoints.

Each endpoint declares a Node runtime and a 60-second function limit. A pass has a
45-second processing budget and commits at most 20 batches. Each HyperSync request
covers at most 10,000 blocks and requests up to 100 matching logs/transactions,
subject to HyperSync's response pagination. Requests time out after 10 seconds.
The processing deadline is checked between records and before checkpoint commit.
An unfinished batch rolls back; earlier committed batches remain saved.

Every batch holds a PostgreSQL transaction-scoped advisory lock for its feed.
Domain writes, intake events, and the next unscanned block commit in that same
transaction. SQL statements have a five-second timeout and idle transactions a
15-second timeout. Transaction pooling is supported; session-level locks are not
used. The primary comps pool allows five seconds to acquire a connection.

Checkpoint identity includes the HyperSync source URL and contract filters.
Credentials and configured starting blocks are excluded. When no checkpoint exists,
the indexer starts at the greater of its configured starting block and the highest
stored matching record's block, replaying that block. Changing a starting block
does not reset an existing checkpoint. Changing the source URL or contracts creates
a different checkpoint identity; treat that as an explicit migration.

Configure both endpoints with matching production database, HyperSync, contract,
and start-block settings. Only the literal `INDEXING_ENABLED=true` enables them;
`false`, an empty value, or an unset value disables them. Other values fail
configuration validation. Scheduling is separate from these handlers and must be
enabled deliberately after the worker handoff.

Authenticated responses distinguish these outcomes:

| Status      | Meaning                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------- |
| `caught_up` | The committed next block has reached HyperSync's reported archive height.                      |
| `limited`   | The time or batch budget was reached. The following invocation resumes committed progress.     |
| `locked`    | Another worker held the feed's lock when a batch was attempted.                                |
| `disabled`  | Indexing is disabled; `success` and `ran` are false.                                           |
| HTTP 500    | A request, processing, or persistence failure occurred. The failed batch was not checkpointed. |

Responses include the indexer key, committed `fromBlock`/`nextBlock`, archive height,
block lag, batch count, examined record count, duration, and whether any batch ran.
With no committed batch, positions are null and `ran` is false. A locked result can
include earlier batches committed during that invocation. Monitor successful scans
and `indexing_checkpoints.updated_at`, not the timestamp of the most recent claim.
Quiet ranges still advance checkpoints and update the scan time.

The transaction indexer covers direct successful calls to the airdrop contract.
Contract-mediated claims and historical gaps require separate reconciliation.
Checkpointing does not add chain-reorganization repair.
