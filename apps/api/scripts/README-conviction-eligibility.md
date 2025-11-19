# Conviction Claims Eligibility Calculator

## Overview

The `calculate-next-season-eligibility.ts` script calculates which accounts are eligible for the next season of conviction claims airdrop based on their active stakes. It determines the reward distribution by analyzing forfeited amounts from previous seasons and proportionally distributing them to active stakers.

## How It Works

### 1. Eligibility Criteria

- An account is eligible if they have **active stakes** at the reference time
- Active stake = conviction claim where `blockTimestamp + duration > reference_time`
- Only claims with `duration > 0` are considered (excludes instant claims)

### 2. Reward Pool Calculation

The available reward pool is calculated as:

```
Available Rewards = Total Forfeited - Claims from Subsequent Seasons
```

Where:

- **Total Forfeited** = Sum of all `(eligibleAmount - claimedAmount)` across all seasons
- **Claims from Subsequent Seasons** = Sum of all claims from season 1 onwards

### 3. Individual Reward Calculation

Each eligible account receives rewards proportional to their active stake:

```
Account Reward = (Account's Active Stake / Total Active Stakes) × Available Rewards
```

## Staking Durations & Forfeit Rates

| Duration         | Claim % | Forfeit % |
| ---------------- | ------- | --------- |
| 0 days (instant) | 10%     | 90%       |
| 30 days          | 20%     | 80%       |
| 90 days          | 40%     | 60%       |
| 180 days         | 60%     | 40%       |
| 365 days         | 100%    | 0%        |

## Usage

### Prerequisites

Ensure you have Node.js installed and the PATH is set:

```bash
export PATH="/home/joe/.nvm/versions/node/v22.13.1/bin:$PATH"
```

### Running the Script

```bash
cd apps/api
pnpm tsx scripts/calculate-next-season-eligibility.ts --season <number> --time <ISO-date> [--concat]
```

### Parameters

- `--season, -s`: Season number for the output (required)

  - Used in the output CSV filename and data
  - Example: `--season 2`

- `--time, -t`: Reference time in ISO format (required)

  - Determines which stakes are active
  - Format: `YYYY-MM-DDTHH:MM:SSZ`
  - Example: `--time "2024-12-31T00:00:00Z"`

- `--concat, -c`: Append new data to existing airdrop-data.csv (optional)

  - When set, adds the new season data to the master CSV file
  - Preserves existing data and appends new entries

- `--help, -h`: Show help message

### Examples

Calculate eligibility for season 2 as of December 31, 2024:

```bash
pnpm tsx scripts/calculate-next-season-eligibility.ts --season 2 --time "2024-12-31T00:00:00Z"
```

Calculate eligibility and append to master airdrop-data.csv:

```bash
pnpm tsx scripts/calculate-next-season-eligibility.ts --season 2 --time "2024-12-31T00:00:00Z" --concat
```

## Output

The script generates a CSV file named `airdrop-season-<season_number>.csv` in the `scripts/data/` directory. If the `--concat` flag is used, the data is also appended to `scripts/data/airdrop-data.csv`.

The CSV contains the following columns:

| Column              | Description                              |
| ------------------- | ---------------------------------------- |
| address             | Wallet address eligible for rewards      |
| amount              | Reward amount in wei                     |
| season              | Season number (as specified in --season) |
| category            | Set to "conviction_staking"              |
| sybilClassification | Empty (for compatibility)                |
| flaggedAt           | Empty (for compatibility)                |
| flaggingReason      | Empty (for compatibility)                |
| powerUser           | Default: 0                               |
| recallSnapper       | Default: 0                               |
| aiBuilder           | Default: 0                               |
| aiExplorer          | Default: 0                               |

### Console Output

The script provides detailed console output including:

1. Number of accounts with active stakes
2. Total active stakes amount
3. Total forfeited amounts by season
4. Claims from subsequent seasons
5. Available rewards pool
6. Top 5 recipients
7. Summary statistics

## Example Workflow

1. **Determine the reference time** for the new season (e.g., season start date)

2. **Run the script** with appropriate parameters:

   ```bash
   pnpm tsx scripts/calculate-next-season-eligibility.ts --season 3 --time "2025-01-01T00:00:00Z"
   ```

3. **Review the console output** to verify:

   - Total eligible accounts
   - Available rewards pool
   - Distribution amounts

4. **Optionally append to master file**:

   ```bash
   pnpm tsx scripts/calculate-next-season-eligibility.ts --season 3 --time "2025-01-01T00:00:00Z" --concat
   ```

   This will add the new data to `airdrop-data.csv` while preserving existing entries.

5. **Use the generated CSV** files for:
   - Individual season file: `scripts/data/airdrop-season-3.csv`
   - Master file (if --concat used): `scripts/data/airdrop-data.csv`
   - Further analysis and distribution

## Technical Details

### Database Tables Used

- `conviction_claims`: Stores all conviction claim events with stake durations

### Key Calculations

#### Active Stake Detection

```sql
WHERE blockTimestamp + (duration * interval '1 second') > reference_time
  AND duration > 0
```

#### Forfeit Calculation

For each claim:

```
Forfeited Amount = eligibleAmount - claimedAmount
```

#### Proportional Distribution

```
Individual Reward = (Individual Active Stake / Sum of All Active Stakes) × Available Pool
```

## Notes

- Multiple stakes from the same account are aggregated
- Accounts with instant claims (duration = 0) are not eligible
- The script only reads from the database, making no modifications
- Output is sorted by reward amount (highest first)
- All amounts are in wei (smallest unit)

## Troubleshooting

### No eligible accounts found

- Check if the reference time is too far in the future (no stakes active)
- Verify that there are claims with duration > 0 in the database

### Zero available rewards

- This can happen if all forfeited amounts have been claimed in subsequent seasons
- Check the console output for forfeited vs claimed amounts

### Database connection errors

- Ensure the `.env` file has correct database credentials
- Verify PostgreSQL is running and accessible

## Related Scripts

- `backfill-internal-tx-claims.ts`: Backfills missing conviction claims
- `generate-merkle-tree.ts`: Generates merkle tree for airdrop distribution
- `rewards-allocate.ts`: Allocates rewards for competitions
