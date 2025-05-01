# Trading Simulator Application: Multiple Competition Support Analysis

## Executive Summary

This document provides a comprehensive analysis of the current trading simulator application architecture and outlines the changes required to transition from supporting only one active competition at a time to supporting multiple simultaneous competitions. The analysis covers database schema dependencies, repository layer implementations, service layer constraints, and API design considerations.

## Table of Contents

1. [Current Architectural Dependencies](#current-architectural-dependencies)
2. [Required Changes for Multiple Competition Support](#required-changes)
3. [Implementation Considerations and Constraints](#implementation-considerations)
4. [Recommended Implementation Architecture](#recommended-implementation-architecture)

<a name="current-architectural-dependencies"></a>

## 1. Current Architectural Dependencies on Single-Competition Design

### 1.1 Database Schema Dependencies

- **Balances Table**: The most critical limitation is that the `balances` table does not have a `competition_id` column. This means team balances are global rather than competition-specific.

- **Competition Identification**: While the database has a `competitions` table that can store multiple competitions, and tables like `trades` and `portfolio_snapshots` include `competition_id` references, the application enforces a single active competition constraint.

- **Configuration Storage**: There is no table for storing competition-specific configuration settings, forcing settings to be applied globally.

### 1.2 Repository Layer Dependencies

- **CompetitionRepository.findActive()**: This method includes a `LIMIT 1` clause, enforcing the return of only one active competition even if multiple have "ACTIVE" status:

```typescript
async findActive(client?: PoolClient): Promise<Competition | null> {
  try {
    const query = `
      SELECT * FROM competitions
      WHERE status = $1
      LIMIT 1
    `;
    // ...
  }
}
```

- **Balance Repository Methods**: Methods like `getBalance`, `saveBalance`, and `getTeamBalances` don't include a `competitionId` parameter, making balances global rather than competition-specific.

### 1.3 Service Layer Dependencies

- **CompetitionManager**: Explicitly prevents starting a new competition if another is already active:

```typescript
async startCompetition(competitionId: string, teamIds: string[]): Promise<Competition> {
  // ...
  const activeCompetition = await repositories.competitionRepository.findActive();
  if (activeCompetition) {
    throw new Error(`Another competition is already active: ${activeCompetition.id}`);
  }
  // ...
}
```

- **ActiveCompetitionCache**: Uses a single string variable to cache the active competition ID:

```typescript
private activeCompetitionCache: string | null = null;
```

- **BalanceManager**: Manages balances globally without competition context. When a new competition starts, all participating teams' balances are reset:

```typescript
// In CompetitionManager.startCompetition
for (const teamId of teamIds) {
  // Reset balances
  await this.balanceManager.resetTeamBalances(teamId);
  // ...
}
```

- **SchedulerService**: Takes portfolio snapshots only for the single active competition:

```typescript
async takePortfolioSnapshots(): Promise<void> {
  // ...
  const activeCompetition = await this.competitionManager.getActiveCompetition();
  if (!activeCompetition) {
    console.log("[SchedulerService] No active competition, skipping portfolio snapshots");
    return;
  }
  // ...
  await this.competitionManager.takePortfolioSnapshots(activeCompetition.id);
}
```

- **ConfigurationService**: Applies settings from the single active competition globally:

```typescript
async loadCompetitionSettings(): Promise<void> {
  // ...
  const activeCompetition = await repositories.competitionRepository.findActive();
  if (activeCompetition) {
    features.ALLOW_CROSS_CHAIN_TRADING = activeCompetition.allowCrossChainTrading;
    // ...
  }
}
```

- **TradeSimulator**: Interacts with balances without competition context, making it impossible to maintain separate balances for multiple competitions:

```typescript
// In TradeSimulator.executeTrade
const currentBalance = await this.balanceManager.getBalance(teamId, fromToken);
// Later when executing the trade
await this.balanceManager.subtractAmount(teamId, fromToken, fromAmount);
await this.balanceManager.addAmount(teamId, toToken, toAmount);
```

- **Portfolio Value Calculation**: The TradeSimulator's calculatePortfolioValue method doesn't accept a competitionId parameter:

```typescript
// In TradeSimulator
async calculatePortfolioValue(teamId: string): Promise<number> {
  let totalValue = 0;
  const balances = await this.balanceManager.getAllBalances(teamId);
  // Calculate value without competition context
}
```

- **Trade Cache**: The TradeSimulator's trade cache is only keyed by teamId without consideration for competition:

```typescript
// In TradeSimulator
private tradeCache: Map<string, Trade[]>;

// When updating cache
const cachedTrades = this.tradeCache.get(teamId) || [];
cachedTrades.unshift(trade);
this.tradeCache.set(teamId, cachedTrades);
```

### 1.4 Controller and Middleware Dependencies

- **Auth Middleware**: Automatically sets the active competition ID for trade routes:

```typescript
if (fullRoutePath.includes("/api/trade/execute") && req.method === "POST") {
  if (!activeCompetition) {
    throw new ApiError(403, "No active competition");
  }
  // Set competition ID in request
  req.competitionId = activeCompetition.id;
}
```

- **TradeController**: Relies on the competition ID being set by middleware rather than as a parameter:

```typescript
const teamId = req.teamId as string;
const competitionId = req.competitionId as string;
```

- **CompetitionController**: Methods like `getLeaderboard` and `getStatus` primarily focus on the active competition, with limited support for viewing past competitions.

- **Rate Limiter Middleware**: Implements rate limiting on a per-team basis without consideration for competitions:

```typescript
// Map to store per-team rate limiters
const rateLimiters = new Map<string, Map<string, RateLimiterMemory>>();

// Function to get rate limiter for a team
function getRateLimiter(
  teamId: string,
  type: "trade" | "price" | "account" | "global" | "hourly",
): RateLimiterMemory {
  // ...
}

// When applying limits
await getRateLimiter(teamId, "trade").consume(`trade:${teamId}`);
```

This means that teams participating in multiple simultaneous competitions would be subject to the same rate limits as teams in a single competition, which could unfairly restrict their activities.

- **AccountController**: Account-related endpoints don't specify competition context:

```typescript
// In AccountController.getPortfolio
const activeCompetition = await repositories.competitionRepository.findActive();
// Only works with a single active competition

// In AccountController.getBalances
const balances = await services.balanceManager.getAllBalances(teamId);
// Gets all balances without competition filtering

// In AccountController.getTrades
const trades = await services.tradeSimulator.getTeamTrades(teamId);
// Gets all trades without competition filtering
```

- **Authentication Model**: The current authentication system associates API keys with teams but not with specific competitions, making it difficult to maintain different access levels across competitions:

```typescript
// In TeamManager.validateApiKey
async validateApiKey(apiKey: string): Promise<string | null> {
  // Only checks if the team is valid, not which competitions they can access
}
```

### 1.5 User Interface and Client Application Dependencies

- **Competition Selection**: No user interface elements or API endpoints for teams to select which competition they want to interact with

- **API Documentation**: Current API documentation doesn't include parameters for competition selection

- **Client Applications**: Client applications are designed with the assumption of a single active competition

### 1.6 Team Participation Management

- **Competition Registration**: No mechanisms for teams to register for specific competitions after initial team creation

- **Team Statuses**: Team active/inactive status is global rather than per-competition

- **Competition Access Control**: No validation to ensure teams only access competitions they're allowed to participate in

<a name="required-changes"></a>

## 2. Required Changes for Multiple Competition Support

### 2.1 Database Schema Changes

- **Balances Table**:
  - Add `competition_id` column with foreign key reference to competitions
  - Create appropriate indexes for performance
  - Update unique constraints to include competition_id

```sql
-- Add competition_id to balances
ALTER TABLE balances ADD COLUMN competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE;
CREATE INDEX idx_balances_competition_id ON balances(competition_id);
CREATE INDEX idx_balances_team_comp_token ON balances(team_id, competition_id, token_address);

-- Update unique constraint
ALTER TABLE balances DROP CONSTRAINT balances_team_id_token_address_key;
ALTER TABLE balances ADD CONSTRAINT balances_team_id_token_address_competition_id_key UNIQUE(team_id, token_address, competition_id);

-- Add partial index for active competitions' balances for faster queries
CREATE INDEX idx_balances_active_competitions ON balances(team_id, token_address, amount)
WHERE competition_id IN (SELECT id FROM competitions WHERE status = 'ACTIVE');
```

- **Team Competition States Table**:
  - Create a new table to track team participation and status per competition
  - This enables more granular control over team status in different competitions

```sql
CREATE TABLE team_competition_states (
  id SERIAL PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  deactivation_reason TEXT,
  deactivation_date TIMESTAMP WITH TIME ZONE,
  initial_portfolio_snapshot_id INTEGER,
  last_trade_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, competition_id)
);

CREATE INDEX idx_team_competition_states_status ON team_competition_states(status);
CREATE INDEX idx_team_competition_states_team_comp ON team_competition_states(team_id, competition_id);
```

- **Competition Configurations Table**:
  - Create a new table for competition-specific settings
  - This allows different competitions to have different parameters

```sql
CREATE TABLE competition_configurations (
  id SERIAL PRIMARY KEY,
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(competition_id, key)
);

CREATE INDEX idx_competition_configurations_key ON competition_configurations(key);
```

- **Rate Limits Table**:
  - Create a new table for competition-specific rate limits
  - This allows different rate limits for different competitions

```sql
CREATE TABLE competition_rate_limits (
  id SERIAL PRIMARY KEY,
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  limit_type VARCHAR(50) NOT NULL, -- e.g., 'trade', 'price', 'account'
  points INTEGER NOT NULL, -- Rate limit points
  duration INTEGER NOT NULL, -- Duration in seconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(competition_id, limit_type)
);
```

- **Competitions Table Updates**:
  - Add additional fields to the competitions table

```sql
ALTER TABLE competitions
ADD COLUMN max_trade_percentage DECIMAL(5,2),
ADD COLUMN max_teams INTEGER,
ADD COLUMN public BOOLEAN DEFAULT true,
ADD COLUMN registration_open BOOLEAN DEFAULT false;
```

### 2.2 Repository Layer Changes

- **CompetitionRepository**:
  - Modify `findActive()` to return multiple active competitions
  - Add a new method `findAllActive()` to get all active competitions

```typescript
// Add new method to get all active competitions
async findAllActive(client?: PoolClient): Promise<Competition[]> {
  try {
    const query = `
      SELECT * FROM competitions
      WHERE status = $1
    `;

    const result = client
      ? await client.query(query, [CompetitionStatus.ACTIVE])
      : await this.db.query(query, [CompetitionStatus.ACTIVE]);

    return result.rows.map(row =>
      this.mapToEntity(this.toCamelCase(row))
    );
  } catch (error) {
    console.error("[CompetitionRepository] Error in findAllActive:", error);
    throw error;
  }
}

// Implementation of findActive using findAllActive for backward compatibility
async findActive(client?: PoolClient): Promise<Competition | null> {
  try {
    const activeCompetitions = await this.findAllActive(client);
    return activeCompetitions.length > 0 ? activeCompetitions[0] : null;
  } catch (error) {
    console.error("[CompetitionRepository] Error in findActive:", error);
    throw error;
  }
}

// Add method to check if a team is part of a competition
async isTeamInCompetition(teamId: string, competitionId: string, client?: PoolClient): Promise<boolean> {
  try {
    const query = `
      SELECT 1 FROM team_competition_states
      WHERE team_id = $1 AND competition_id = $2 AND status = 'ACTIVE'
      LIMIT 1
    `;

    const result = client
      ? await client.query(query, [teamId, competitionId])
      : await this.db.query(query, [teamId, competitionId]);

    return result.rows.length > 0;
  } catch (error) {
    console.error("[CompetitionRepository] Error in isTeamInCompetition:", error);
    throw error;
  }
}

// Add a method to get competitions a team is participating in
async getTeamCompetitions(teamId: string, client?: PoolClient): Promise<Competition[]> {
  try {
    const query = `
      SELECT c.* FROM competitions c
      JOIN team_competition_states tcs ON c.id = tcs.competition_id
      WHERE tcs.team_id = $1 AND tcs.status = 'ACTIVE'
      ORDER BY c.start_date DESC
    `;

    const result = client
      ? await client.query(query, [teamId])
      : await this.db.query(query, [teamId]);

    return result.rows.map(row => this.mapToEntity(this.toCamelCase(row)));
  } catch (error) {
    console.error("[CompetitionRepository] Error in getTeamCompetitions:", error);
    throw error;
  }
}
```

- **BalanceRepository**:
  - Update all methods to include competitionId parameter
  - Modify queries to filter by competition_id

```typescript
// Update getBalance method
async getBalance(
  teamId: string,
  tokenAddress: string,
  competitionId: string,
  client?: PoolClient,
): Promise<Balance | null> {
  try {
    const query = `
      SELECT id, team_id, token_address, amount, competition_id, specific_chain, created_at, updated_at
      FROM balances
      WHERE team_id = $1 AND token_address = $2 AND competition_id = $3
    `;

    const values = [teamId, tokenAddress, competitionId];

    const result = client
      ? await client.query(query, values)
      : await this.db.query(query, values);

    return result.rows.length > 0
      ? this.mapToEntity(this.toCamelCase(result.rows[0]))
      : null;
  } catch (error) {
    console.error("[BalanceRepository] Error in getBalance:", error);
    throw error;
  }
}

// Update saveBalance method
async saveBalance(
  teamId: string,
  tokenAddress: string,
  amount: number,
  competitionId: string,
  client?: PoolClient,
): Promise<Balance> {
  try {
    const query = `
      INSERT INTO balances (team_id, token_address, amount, competition_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (team_id, token_address, competition_id)
      DO UPDATE SET amount = $3, updated_at = NOW()
      RETURNING id, team_id, token_address, amount, competition_id, specific_chain, created_at, updated_at
    `;

    const values = [teamId, tokenAddress, amount, competitionId];

    const result = client
      ? await client.query(query, values)
      : await this.db.query(query, values);

    return this.mapToEntity(this.toCamelCase(result.rows[0]));
  } catch (error) {
    console.error("[BalanceRepository] Error in saveBalance:", error);
    throw error;
  }
}

// Update getTeamBalances method
async getTeamBalances(
  teamId: string,
  competitionId: string,
  client?: PoolClient,
): Promise<Balance[]> {
  try {
    const query = `
      SELECT id, team_id, token_address, amount, competition_id, specific_chain, created_at, updated_at
      FROM balances
      WHERE team_id = $1 AND competition_id = $2
    `;

    const values = [teamId, competitionId];

    const result = client
      ? await client.query(query, values)
      : await this.db.query(query, values);

    return result.rows.map(row =>
      this.mapToEntity(this.toCamelCase(row))
    );
  } catch (error) {
    console.error("[BalanceRepository] Error in getTeamBalances:", error);
    throw error;
  }
}

// Add competition-specific initialization
async initializeTeamBalancesForCompetition(
  teamId: string,
  competitionId: string,
  initialBalances: Map<string, number>,
  client?: PoolClient,
): Promise<void> {
  try {
    // Use a transaction if no client is provided
    if (!client) {
      await this.db.transaction(async (transactionClient) => {
        await this.initializeBalancesInTransaction(
          teamId,
          competitionId,
          initialBalances,
          transactionClient,
        );
      });
    } else {
      await this.initializeBalancesInTransaction(
        teamId,
        competitionId,
        initialBalances,
        client,
      );
    }
  } catch (error) {
    console.error(
      `[BalanceRepository] Error in initializeTeamBalancesForCompetition:`,
      error,
    );
    throw error;
  }
}

// Update the balance initialization transaction to be competition-specific
private async initializeBalancesInTransaction(
  teamId: string,
  competitionId: string,
  initialBalances: Map<string, number>,
  client: PoolClient,
): Promise<void> {
  for (const [tokenAddress, amount] of initialBalances.entries()) {
    // Determine the specific chain for this token
    const specificChain = this.getTokenSpecificChain(tokenAddress);

    const query = `
      INSERT INTO balances (team_id, token_address, amount, competition_id, specific_chain)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (team_id, token_address, competition_id)
      DO UPDATE SET amount = $3, specific_chain = $5, updated_at = NOW()
    `;

    await client.query(query, [teamId, tokenAddress, amount, competitionId, specificChain]);
  }
}

// Update resetTeamBalances to be competition-specific
async resetTeamBalancesForCompetition(
  teamId: string,
  competitionId: string,
  initialBalances: Map<string, number>,
  client?: PoolClient,
): Promise<void> {
  try {
    // Use a transaction if no client is provided
    if (!client) {
      await this.db.transaction(async (transactionClient) => {
        // First delete current balances for this team in this competition
        await transactionClient.query(
          "DELETE FROM balances WHERE team_id = $1 AND competition_id = $2",
          [teamId, competitionId],
        );

        // Then initialize new ones
        await this.initializeBalancesInTransaction(
          teamId,
          competitionId,
          initialBalances,
          transactionClient,
        );
      });
    } else {
      // First delete current balances for this team in this competition
      await client.query(
        "DELETE FROM balances WHERE team_id = $1 AND competition_id = $2",
        [teamId, competitionId],
      );

      // Then initialize new ones
      await this.initializeBalancesInTransaction(
        teamId,
        competitionId,
        initialBalances,
        client,
      );
    }
  } catch (error) {
    console.error("[BalanceRepository] Error in resetTeamBalancesForCompetition:", error);
    throw error;
  }
}
```

- **TradeRepository**:
  - Update methods to better support competition-specific filtering
  - Add more efficient queries for competition insights

```typescript
// Update getTeamTrades method to include competitionId
async getTeamTrades(
  teamId: string,
  competitionId?: string,
  limit?: number,
  offset?: number,
  client?: PoolClient
): Promise<Trade[]> {
  try {
    let query = `
      SELECT * FROM trades
      WHERE team_id = $1
    `;

    const params: any[] = [teamId];
    let paramIndex = 2;

    // Add competition filter if provided
    if (competitionId) {
      query += ` AND competition_id = $${paramIndex++}`;
      params.push(competitionId);
    }

    // Add ordering
    query += ` ORDER BY timestamp DESC`;

    // Add pagination if specified
    if (limit !== undefined) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(limit);

      if (offset !== undefined) {
        query += ` OFFSET $${paramIndex++}`;
        params.push(offset);
      }
    }

    const result = client
      ? await client.query(query, params)
      : await this.db.query(query, params);

    return result.rows.map(row => this.mapToEntity(this.toCamelCase(row)));
  } catch (error) {
    console.error("[TradeRepository] Error in getTeamTrades:", error);
    throw error;
  }
}

// Add method to get team trade statistics per competition
async getTeamTradeStats(
  teamId: string,
  competitionId: string,
  client?: PoolClient
): Promise<{
  totalTrades: number;
  totalVolume: number;
  lastTradeDate: Date | null;
}> {
  try {
    const query = `
      SELECT
        COUNT(*) as total_trades,
        SUM(from_amount) as total_volume,
        MAX(timestamp) as last_trade_date
      FROM trades
      WHERE team_id = $1 AND competition_id = $2
    `;

    const result = client
      ? await client.query(query, [teamId, competitionId])
      : await this.db.query(query, [teamId, competitionId]);

    const row = result.rows[0];
    return {
      totalTrades: parseInt(row.total_trades || '0', 10),
      totalVolume: parseFloat(row.total_volume || '0'),
      lastTradeDate: row.last_trade_date ? new Date(row.last_trade_date) : null
    };
  } catch (error) {
    console.error("[TradeRepository] Error in getTeamTradeStats:", error);
    throw error;
  }
}
```

### 2.3 Service Layer Changes

- **CompetitionManager**:
  - Replace single activeCompetitionCache with a collection
  - Update methods to handle multiple active competitions
  - Remove the active competition check from startCompetition

```typescript
// Replace single cache
private activeCompetitionsCache: Set<string> = new Set();

// Add method to get all active competitions
async getActiveCompetitions(): Promise<Competition[]> {
  // First check cache for better performance
  if (this.activeCompetitionsCache.size > 0) {
    const competitions = [];
    for (const id of this.activeCompetitionsCache) {
      const competition = await repositories.competitionRepository.findById(id);
      if (competition?.status === CompetitionStatus.ACTIVE) {
        competitions.push(competition);
      } else {
        // Cache is out of sync, remove this ID
        this.activeCompetitionsCache.delete(id);
      }
    }

    if (competitions.length > 0) {
      return competitions;
    }
  }

  // Fallback to database query
  const activeCompetitions = await repositories.competitionRepository.findAllActive();
  this.activeCompetitionsCache.clear();
  for (const competition of activeCompetitions) {
    this.activeCompetitionsCache.add(competition.id);
  }
  return activeCompetitions;
}

// Update getActiveCompetition for backward compatibility
async getActiveCompetition(): Promise<Competition | null> {
  const competitions = await this.getActiveCompetitions();
  return competitions.length > 0 ? competitions[0] : null;
}

// Modify startCompetition to remove check for existing active competitions
async startCompetition(competitionId: string, teamIds: string[]): Promise<Competition> {
  const competition = await repositories.competitionRepository.findById(competitionId);
  if (!competition) {
    throw new Error(`Competition not found: ${competitionId}`);
  }

  if (competition.status !== CompetitionStatus.PENDING) {
    throw new Error(`Competition cannot be started: ${competition.status}`);
  }

  // Process all team additions and activations
  for (const teamId of teamIds) {
    // Reset balances for this competition
    await this.balanceManager.resetTeamBalancesForCompetition(teamId, competitionId);

    // Register team in the competition
    await repositories.competitionRepository.addTeamToCompetition(competitionId, teamId);

    // Create team competition state record
    await repositories.teamRepository.createTeamCompetitionState(teamId, competitionId);

    // Activate team
    await services.teamManager.activateTeamForCompetition(teamId, competitionId);
    console.log(`[CompetitionManager] Activated team ${teamId} for competition ${competitionId}`);
  }

  // Update competition status
  competition.status = CompetitionStatus.ACTIVE;
  competition.startDate = new Date();
  competition.updatedAt = new Date();
  await repositories.competitionRepository.update(competition);

  // Update cache
  this.activeCompetitionsCache.add(competitionId);

  // Take initial portfolio snapshots
  await this.takePortfolioSnapshots(competitionId);

  // Reload competition-specific configuration settings
  await services.configurationService.loadCompetitionSettings(competitionId);

  return competition;
}

// Update endCompetition to handle multiple active competitions
async endCompetition(competitionId: string): Promise<Competition> {
  const competition = await repositories.competitionRepository.findById(competitionId);
  if (!competition) {
    throw new Error(`Competition not found: ${competitionId}`);
  }

  if (competition.status !== CompetitionStatus.ACTIVE) {
    throw new Error(`Competition is not active: ${competition.status}`);
  }

  // Check if this competition is in our active cache
  if (!this.activeCompetitionsCache.has(competitionId)) {
    throw new Error(`Competition not found in active cache: ${competitionId}`);
  }

  // Take final portfolio snapshots
  await this.takePortfolioSnapshots(competitionId);

  // Get teams in the competition
  const competitionTeams = await repositories.competitionRepository.getCompetitionTeams(competitionId);

  // Deactivate all teams in this competition
  console.log(`[CompetitionManager] Deactivating ${competitionTeams.length} teams for ended competition ${competitionId}`);
  for (const teamId of competitionTeams) {
    try {
      await services.teamManager.deactivateTeamForCompetition(
        teamId,
        competitionId,
        `Competition ${competition.name} (${competitionId}) ended`
      );
    } catch (error) {
      console.error(`[CompetitionManager] Error deactivating team ${teamId}:`, error);
    }
  }

  // Update competition status
  competition.status = CompetitionStatus.COMPLETED;
  competition.endDate = new Date();
  competition.updatedAt = new Date();
  await repositories.competitionRepository.update(competition);

  // Update cache
  this.activeCompetitionsCache.delete(competitionId);

  // Reload configuration settings
  await services.configurationService.loadCompetitionSettings();

  return competition;
}
```

- **BalanceManager**:
  - Update balance cache structure for competition-specific balances
  - Modify all methods to include competitionId parameter

```typescript
// Update balance cache structure
private balanceCache: Map<string, Map<string, Map<string, number>>> = new Map();
// teamId -> competitionId -> tokenAddress -> amount

// Update getBalance method
async getBalance(teamId: string, tokenAddress: string, competitionId: string): Promise<number> {
  try {
    // First check cache
    const teamCache = this.balanceCache.get(teamId);
    if (teamCache) {
      const compCache = teamCache.get(competitionId);
      if (compCache && compCache.has(tokenAddress)) {
        return compCache.get(tokenAddress) || 0;
      }
    }

    // Get from database
    const balance = await repositories.balanceRepository.getBalance(
      teamId,
      tokenAddress,
      competitionId
    );

    // Update cache
    if (!this.balanceCache.has(teamId)) {
      this.balanceCache.set(teamId, new Map<string, Map<string, number>>());
    }

    if (!this.balanceCache.get(teamId)?.has(competitionId)) {
      this.balanceCache.get(teamId)?.set(competitionId, new Map<string, number>());
    }

    this.balanceCache.get(teamId)?.get(competitionId)?.set(
      tokenAddress,
      balance ? balance.amount : 0
    );

    return balance ? balance.amount : 0;
  } catch (error) {
    console.error(`[BalanceManager] Error getting balance:`, error);
    return 0;
  }
}

// Update getAllBalances to filter by competition
async getAllBalances(teamId: string, competitionId: string): Promise<Balance[]> {
  try {
    // Get from database
    const balances = await repositories.balanceRepository.getTeamBalances(
      teamId,
      competitionId
    );

    // Update cache
    if (!this.balanceCache.has(teamId)) {
      this.balanceCache.set(teamId, new Map<string, Map<string, number>>());
    }

    if (!this.balanceCache.get(teamId)?.has(competitionId)) {
      this.balanceCache.get(teamId)?.set(competitionId, new Map<string, number>());
    }

    const balanceMap = this.balanceCache.get(teamId)?.get(competitionId);
    if (balanceMap) {
      balances.forEach((balance) => {
        balanceMap.set(balance.token, balance.amount);
      });
    }

    return balances;
  } catch (error) {
    console.error(`[BalanceManager] Error getting all balances:`, error);
    return [];
  }
}

// Update updateBalance to include competitionId
async updateBalance(
  teamId: string,
  tokenAddress: string,
  amount: number,
  competitionId: string
): Promise<void> {
  try {
    if (amount < 0) {
      throw new Error("Balance cannot be negative");
    }

    // Save to database
    await repositories.balanceRepository.saveBalance(
      teamId,
      tokenAddress,
      amount,
      competitionId
    );

    // Update cache
    if (!this.balanceCache.has(teamId)) {
      this.balanceCache.set(teamId, new Map<string, Map<string, number>>());
    }

    if (!this.balanceCache.get(teamId)?.has(competitionId)) {
      this.balanceCache.get(teamId)?.set(competitionId, new Map<string, number>());
    }

    this.balanceCache.get(teamId)?.get(competitionId)?.set(tokenAddress, amount);

    console.log(
      `[BalanceManager] Updated balance for team ${teamId}, competition ${competitionId}, token ${tokenAddress}: ${amount}`
    );
  } catch (error) {
    console.error(`[BalanceManager] Error updating balance:`, error);
    throw error;
  }
}

// Update addAmount to include competitionId
async addAmount(
  teamId: string,
  tokenAddress: string,
  amount: number,
  competitionId: string
): Promise<void> {
  const currentBalance = await this.getBalance(teamId, tokenAddress, competitionId);
  await this.updateBalance(teamId, tokenAddress, currentBalance + amount, competitionId);
}

// Update subtractAmount to include competitionId
async subtractAmount(
  teamId: string,
  tokenAddress: string,
  amount: number,
  competitionId: string
): Promise<void> {
  const currentBalance = await this.getBalance(teamId, tokenAddress, competitionId);
  if (currentBalance < amount) {
    throw new Error(`Insufficient balance: ${currentBalance} < ${amount}`);
  }
  await this.updateBalance(teamId, tokenAddress, currentBalance - amount, competitionId);
}

// Add competition-specific initialization
async initializeTeamBalancesForCompetition(teamId: string, competitionId: string): Promise<void> {
  console.log(`[BalanceManager] Initializing balances for team ${teamId} in competition ${competitionId}`);

  try {
    const initialBalances = new Map<string, number>();

    // Add specific chain token balances
    this.addSpecificChainTokensToBalances(initialBalances);

    // Save to database with competition context
    await repositories.balanceRepository.initializeTeamBalancesForCompetition(
      teamId,
      competitionId,
      initialBalances
    );

    // Update cache
    if (!this.balanceCache.has(teamId)) {
      this.balanceCache.set(teamId, new Map<string, Map<string, number>>());
    }

    this.balanceCache.get(teamId)?.set(competitionId, initialBalances);

    console.log(`[BalanceManager] Initialized ${initialBalances.size} token balances for team ${teamId} in competition ${competitionId}`);
  } catch (error) {
    console.error(`[BalanceManager] Error initializing balances:`, error);
    throw error;
  }
}

// Add competition-specific reset
async resetTeamBalancesForCompetition(teamId: string, competitionId: string): Promise<void> {
  console.log(`[BalanceManager] Resetting balances for team ${teamId} in competition ${competitionId}`);

  try {
    const initialBalances = new Map<string, number>();

    // Add specific chain token balances
    this.addSpecificChainTokensToBalances(initialBalances);

    // Reset in database with competition context
    await repositories.balanceRepository.resetTeamBalancesForCompetition(
      teamId,
      competitionId,
      initialBalances
    );

    // Update cache
    if (!this.balanceCache.has(teamId)) {
      this.balanceCache.set(teamId, new Map<string, Map<string, number>>());
    }

    this.balanceCache.get(teamId)?.set(competitionId, initialBalances);

    console.log(`[BalanceManager] Reset ${initialBalances.size} token balances for team ${teamId} in competition ${competitionId}`);
  } catch (error) {
    console.error(`[BalanceManager] Error resetting balances:`, error);
    throw error;
  }
}

// Update hasSufficientBalance to include competitionId
async hasSufficientBalance(
  teamId: string,
  tokenAddress: string,
  amount: number,
  competitionId: string
): Promise<boolean> {
  const balance = await this.getBalance(teamId, tokenAddress, competitionId);
  return balance >= amount;
}
```

- **SchedulerService**:
  - Update to handle taking snapshots for all active competitions

```typescript
async takePortfolioSnapshots(): Promise<void> {
  try {
    // Get all active competitions
    const activeCompetitions = await this.competitionManager.getActiveCompetitions();

    if (activeCompetitions.length === 0) {
      console.log("[SchedulerService] No active competitions, skipping portfolio snapshots");
      return;
    }

    console.log(`[SchedulerService] Taking scheduled portfolio snapshots for ${activeCompetitions.length} active competitions`);

    // Take snapshots for each active competition
    for (const competition of activeCompetitions) {
      try {
        console.log(`[SchedulerService] Processing competition: ${competition.id}`);
        await this.competitionManager.takePortfolioSnapshots(competition.id);
      } catch (error) {
        console.error(
          `[SchedulerService] Error taking portfolio snapshots for competition ${competition.id}:`,
          error
        );
        // Continue with next competition even if one fails
      }
    }
  } catch (error) {
    console.error("[SchedulerService] Error taking portfolio snapshots:", error);
    throw error;
  }
}
```

- **ConfigurationService**:
  - Create a new service for competition-specific configurations

```typescript
class CompetitionConfigService {
  private configCache: Map<string, Map<string, any>> = new Map();

  async getCompetitionConfig<T>(
    competitionId: string,
    key: string,
    defaultValue?: T,
  ): Promise<T | null> {
    try {
      // First check cache
      if (
        this.configCache.has(competitionId) &&
        this.configCache.get(competitionId)?.has(key)
      ) {
        return this.configCache.get(competitionId)?.get(key) as T;
      }

      // Get from database
      const query = `
        SELECT value FROM competition_configurations
        WHERE competition_id = $1 AND key = $2
      `;

      const result = await repositories.db.query(query, [competitionId, key]);

      if (result.rows.length > 0) {
        const value = JSON.parse(result.rows[0].value);

        // Update cache
        if (!this.configCache.has(competitionId)) {
          this.configCache.set(competitionId, new Map<string, any>());
        }

        this.configCache.get(competitionId)?.set(key, value);

        return value as T;
      }

      return defaultValue !== undefined ? defaultValue : null;
    } catch (error) {
      console.error(`[CompetitionConfigService] Error getting config:`, error);
      return defaultValue !== undefined ? defaultValue : null;
    }
  }

  async setCompetitionConfig(
    competitionId: string,
    key: string,
    value: any,
  ): Promise<void> {
    try {
      const stringValue = JSON.stringify(value);

      // Save to database
      const query = `
        INSERT INTO competition_configurations (competition_id, key, value)
        VALUES ($1, $2, $3)
        ON CONFLICT (competition_id, key) 
        DO UPDATE SET value = $3, updated_at = NOW()
      `;

      await repositories.db.query(query, [competitionId, key, stringValue]);

      // Update cache
      if (!this.configCache.has(competitionId)) {
        this.configCache.set(competitionId, new Map<string, any>());
      }

      this.configCache.get(competitionId)?.set(key, value);

      console.log(
        `[CompetitionConfigService] Set config ${key} for competition ${competitionId}`,
      );
    } catch (error) {
      console.error(`[CompetitionConfigService] Error setting config:`, error);
      throw error;
    }
  }

  async getCompetitionFeatures(competitionId: string): Promise<{
    allowCrossChainTrading: boolean;
    maxTradePercentage: number;
    // Other features
  }> {
    try {
      // First try to get from competition directly
      const competition =
        await repositories.competitionRepository.findById(competitionId);

      if (!competition) {
        throw new Error(`Competition not found: ${competitionId}`);
      }

      // Get additional features from configuration table
      const maxTradePercentage = await this.getCompetitionConfig<number>(
        competitionId,
        "maxTradePercentage",
        config.maxTradePercentage, // Fallback to global config
      );

      return {
        allowCrossChainTrading: competition.allowCrossChainTrading,
        maxTradePercentage: maxTradePercentage || config.maxTradePercentage,
        // Add other features as needed
      };
    } catch (error) {
      console.error(
        `[CompetitionConfigService] Error getting features:`,
        error,
      );

      // Fallback to default features
      return {
        allowCrossChainTrading: false,
        maxTradePercentage: config.maxTradePercentage,
        // Add other features with defaults
      };
    }
  }

  // Load settings for a specific competition
  async loadCompetitionSettings(competitionId?: string): Promise<void> {
    try {
      // If no competition ID is provided, try to use global settings
      if (!competitionId) {
        // Reset to defaults from configuration
        features.ALLOW_CROSS_CHAIN_TRADING = config.allowCrossChainTrading;
        console.log(`[CompetitionConfigService] Reset to default settings`);
        return;
      }

      // Get competition
      const competition =
        await repositories.competitionRepository.findById(competitionId);

      if (competition) {
        // Apply competition-specific settings
        features.ALLOW_CROSS_CHAIN_TRADING = competition.allowCrossChainTrading;

        console.log(
          `[CompetitionConfigService] Loaded settings for competition ${competitionId}:`,
        );
        console.log(
          `- ALLOW_CROSS_CHAIN_TRADING: ${features.ALLOW_CROSS_CHAIN_TRADING}`,
        );
      } else {
        console.log(
          `[CompetitionConfigService] Competition not found: ${competitionId}`,
        );
        // Reset to defaults
        features.ALLOW_CROSS_CHAIN_TRADING = config.allowCrossChainTrading;
      }
    } catch (error) {
      console.error(
        `[CompetitionConfigService] Error loading settings:`,
        error,
      );
      // Reset to defaults on error
      features.ALLOW_CROSS_CHAIN_TRADING = config.allowCrossChainTrading;
    }
  }
}
```

- **TradeSimulator**:
  - Update all balance interactions to include competitionId
  - Modify the trade cache to be competition-aware
  - Update portfolio value calculation to be competition-specific

```typescript
// Update trade cache structure
private tradeCache: Map<string, Map<string, Trade[]>> = new Map();
// teamId -> competitionId -> trades[]

// Update executeTrade method
async executeTrade(
  teamId: string,
  competitionId: string,
  fromToken: string,
  toToken: string,
  fromAmount: number,
  reason: string,
  slippageTolerance?: number,
  chainOptions?: ChainOptions,
): Promise<TradeResult> {
  try {
    console.log(`[TradeSimulator] Executing trade for team ${teamId} in competition ${competitionId}`);

    // Validation checks...

    // Get competition-specific features
    const competitionFeatures = await services.competitionConfigService.getCompetitionFeatures(competitionId);

    // Validate balances with competition context
    const currentBalance = await this.balanceManager.getBalance(
      teamId,
      fromToken,
      competitionId
    );

    if (currentBalance < fromAmount) {
      return {
        success: false,
        error: "Insufficient balance",
      };
    }

    // Handle cross-chain trading check
    if (
      !competitionFeatures.allowCrossChainTrading &&
      // cross-chain check logic...
      false
    ) {
      return {
        success: false,
        error: "Cross-chain trading is disabled for this competition",
      };
    }

    // Calculate portfolio value for this competition
    const portfolioValue = await this.calculatePortfolioValue(teamId, competitionId);
    const maxTradeValue = portfolioValue * (competitionFeatures.maxTradePercentage / 100);

    // Slippage and price calculations...

    // Execute the trade with competition context
    await this.balanceManager.subtractAmount(teamId, fromToken, fromAmount, competitionId);
    await this.balanceManager.addAmount(teamId, toToken, toAmount, competitionId);

    // Create trade record with competition ID
    const trade: Trade = {
      id: uuidv4(),
      timestamp: new Date(),
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      price: toAmount / fromAmount,
      success: true,
      teamId,
      competitionId,
      reason,
      // Chain information...
      fromChain,
      toChain,
      fromSpecificChain,
      toSpecificChain,
    };

    // Store the trade in database
    await repositories.tradeRepository.create(trade);

    // Update cache with competition context
    const teamCache = this.tradeCache.get(teamId) || new Map<string, Trade[]>();
    const compTrades = teamCache.get(competitionId) || [];
    compTrades.unshift(trade);
    // Limit cache size to 100 trades per team per competition
    if (compTrades.length > 100) {
      compTrades.pop();
    }
    teamCache.set(competitionId, compTrades);
    this.tradeCache.set(teamId, teamCache);

    // Trigger a portfolio snapshot after successful trade
    services.competitionManager
      .takePortfolioSnapshots(competitionId)
      .catch((error) => {
        console.error(
          `[TradeSimulator] Error taking portfolio snapshot after trade: ${error.message}`,
        );
      });

    return {
      success: true,
      trade,
    };
  } catch (error) {
    // Error handling...
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// Update portfolio value calculation to accept competitionId
async calculatePortfolioValue(teamId: string, competitionId: string): Promise<number> {
  try {
    let totalValue = 0;

    // Get balances for this team in this competition
    const balances = await this.balanceManager.getAllBalances(teamId, competitionId);

    // Loop through balances and calculate value
    for (const balance of balances) {
      if (balance.amount <= 0) continue;

      // Get price information
      const tokenPrice = await this.priceTracker.getPrice(balance.token);

      if (tokenPrice && tokenPrice.price > 0) {
        const valueUSD = balance.amount * tokenPrice.price;
        totalValue += valueUSD;
      }
    }

    return totalValue;
  } catch (error) {
    console.error(`[TradeSimulator] Error calculating portfolio value:`, error);
    return 0;
  }
}

// Update getTeamTrades method to use competitionId
async getTeamTrades(
  teamId: string,
  competitionId?: string,
  limit?: number,
  offset?: number
): Promise<Trade[]> {
  try {
    // First check cache if looking for a specific competition
    if (competitionId) {
      const teamCache = this.tradeCache.get(teamId);
      if (teamCache) {
        const compTrades = teamCache.get(competitionId);
        if (compTrades && compTrades.length > 0) {
          if (limit) {
            return compTrades.slice(offset || 0, (offset || 0) + limit);
          }
          return compTrades;
        }
      }
    }

    // Get from database with optional competition filter
    const trades = await repositories.tradeRepository.getTeamTrades(
      teamId,
      competitionId,
      limit,
      offset
    );

    // If for a specific competition, update cache
    if (competitionId && trades.length > 0) {
      const teamCache = this.tradeCache.get(teamId) || new Map<string, Trade[]>();
      teamCache.set(competitionId, trades);
      this.tradeCache.set(teamId, teamCache);
    }

    return trades;
  } catch (error) {
    console.error(`[TradeSimulator] Error getting team trades:`, error);
    return [];
  }
}
```

### 2.4 Controller and Middleware Changes

- **Auth Middleware**:
  - Update to require competitionId for trade routes
  - Add validation that team is part of the specified competition

```typescript
// For trade endpoints, ensure competition is specified and team is part of it
if (fullRoutePath.includes("/api/trade/execute") && req.method === "POST") {
  // Try to get competitionId from request body
  const competitionId = req.body.competitionId;

  if (!competitionId) {
    throw new ApiError(400, "Competition ID is required for trade execution");
  }

  // Verify competition exists
  const competition =
    await repositories.competitionRepository.findById(competitionId);

  if (!competition) {
    throw new ApiError(404, "Competition not found");
  }

  // Verify competition is active
  if (competition.status !== CompetitionStatus.ACTIVE) {
    throw new ApiError(403, `Competition is not active: ${competition.status}`);
  }

  // Verify team is part of the competition
  const isTeamInCompetition =
    await repositories.competitionRepository.isTeamInCompetition(
      teamId,
      competitionId,
    );

  if (!isTeamInCompetition && !isAdmin) {
    throw new ApiError(
      403,
      "Your team is not participating in this competition",
    );
  }

  req.competitionId = competitionId;
}

// For account routes, try to get from query params or default to body
if (
  fullRoutePath.includes("/api/account/") &&
  (req.path.includes("/balances") ||
    req.path.includes("/portfolio") ||
    req.path.includes("/trades"))
) {
  // Get competitionId from query or body
  let competitionId = req.query.competitionId || req.body.competitionId;

  if (!competitionId) {
    // If not provided, try to get the first active competition this team participates in
    const teamCompetitions =
      await repositories.competitionRepository.getTeamCompetitions(teamId);

    if (teamCompetitions.length === 0) {
      throw new ApiError(
        400,
        "Competition ID is required and no active competitions found for your team",
      );
    }

    competitionId = teamCompetitions[0].id;
    console.log(
      `[AuthMiddleware] Using default competition ID: ${competitionId}`,
    );
  } else {
    // Verify team is part of the competition
    const isTeamInCompetition =
      await repositories.competitionRepository.isTeamInCompetition(
        teamId,
        competitionId,
      );

    if (!isTeamInCompetition && !isAdmin) {
      throw new ApiError(
        403,
        "Your team is not participating in this competition",
      );
    }
  }

  req.competitionId = competitionId;
  console.log(
    `[AuthMiddleware] Set competition ID for account route: ${competitionId}`,
  );
}
```

- **TradeController**:
  - Update to accept competitionId as a parameter
  - Add validation for the specified competition

```typescript
static async executeTrade(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      fromToken,
      toToken,
      amount,
      reason,
      slippageTolerance,
      competitionId, // Add competitionId to expected parameters
      // Other parameters...
    } = req.body;

    const teamId = req.teamId as string;

    // Get competitionId from body or from req object (set by middleware)
    const tradeCompetitionId = competitionId || req.competitionId;

    // Validate that we have a competition ID
    if (!tradeCompetitionId) {
      throw new ApiError(
        400,
        "Missing competitionId: Please provide a competition ID"
      );
    }

    // Validation checks
    if (!fromToken || !toToken || !amount) {
      throw new ApiError(400, "Missing required parameters: fromToken, toToken, amount");
    }

    // Execute the trade with competition context
    const result = await services.tradeSimulator.executeTrade(
      teamId,
      tradeCompetitionId,
      fromToken,
      toToken,
      parseFloat(amount),
      reason,
      slippageTolerance ? parseFloat(slippageTolerance) : undefined,
      // Chain options...
    );

    if (!result.success) {
      throw new ApiError(400, result.error || "Trade execution failed");
    }

    res.status(200).json({
      success: true,
      transaction: result.trade
    });
  } catch (error) {
    next(error);
  }
}

// Update getQuote to include competitionId
static async getQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      fromToken,
      toToken,
      amount,
      competitionId, // Add competitionId to expected parameters
      // Other parameters...
    } = req.query;

    const teamId = req.teamId as string;

    // Get competitionId from query or from req object (set by middleware)
    const quoteCompetitionId = competitionId || req.competitionId;

    // Rest of the implementation...

    // Return quote with competition context
    res.status(200).json({
      fromToken,
      toToken,
      competitionId: quoteCompetitionId, // Include in response
      fromAmount: parsedAmount,
      toAmount,
      exchangeRate: toAmount / parsedAmount,
      slippage: slippagePercentage,
      // Other response fields...
    });
  } catch (error) {
    next(error);
  }
}
```

- **CompetitionController**:
  - Add endpoints for teams to view and select competitions
  - Update existing endpoints to better handle multiple active competitions

```typescript
// New controller method for getting available competitions
static async getUserCompetitions(req: Request, res: Response, next: NextFunction) {
  try {
    const teamId = req.teamId as string;

    // Get competitions the team is participating in
    const competitions = await repositories.competitionRepository.getTeamCompetitions(teamId);

    // Get all active competitions for admin users
    if (req.isAdmin) {
      const allActive = await services.competitionManager.getActiveCompetitions();

      // Create a set of competition IDs the team is already in
      const teamCompetitionIds = new Set(competitions.map(c => c.id));

      // Add any active competitions the team isn't already in
      for (const comp of allActive) {
        if (!teamCompetitionIds.has(comp.id)) {
          competitions.push({
            ...comp,
            canJoin: true
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      competitions: competitions.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
        isActive: c.status === 'ACTIVE',
        canJoin: c.canJoin || false
      }))
    });
  } catch (error) {
    next(error);
  }
}

// New controller method for joining a competition
static async joinCompetition(req: Request, res: Response, next: NextFunction) {
  try {
    const teamId = req.teamId as string;
    const { competitionId } = req.params;

    if (!competitionId) {
      throw new ApiError(400, "Competition ID is required");
    }

    // First check if competition exists and is active
    const competition = await repositories.competitionRepository.findById(competitionId);

    if (!competition) {
      throw new ApiError(404, "Competition not found");
    }

    if (competition.status !== CompetitionStatus.ACTIVE) {
      throw new ApiError(403, `Competition is not active: ${competition.status}`);
    }

    // Check if team is already in this competition
    const isAlreadyInCompetition = await repositories.competitionRepository.isTeamInCompetition(
      teamId,
      competitionId
    );

    if (isAlreadyInCompetition) {
      throw new ApiError(400, "Your team is already participating in this competition");
    }

    // Add team to competition
    await repositories.competitionRepository.addTeamToCompetition(competitionId, teamId);

    // Create team competition state record
    await repositories.teamRepository.createTeamCompetitionState(teamId, competitionId);

    // Initialize team balances for this competition
    await services.balanceManager.initializeTeamBalancesForCompetition(teamId, competitionId);

    // Activate team for this competition
    await services.teamManager.activateTeamForCompetition(teamId, competitionId);

    res.status(200).json({
      success: true,
      message: `Successfully joined competition: ${competition.name}`
    });
  } catch (error) {
    next(error);
  }
}

// Update getLeaderboard to be more competition-aware
static async getLeaderboard(req: Request, res: Response, next: NextFunction) {
  try {
    // Get competitionId from query params or use the one from auth middleware
    const competitionId = req.query.competitionId as string || req.competitionId as string;

    if (!competitionId) {
      throw new ApiError(400, "Competition ID is required");
    }

    // Get the leaderboard for the specified competition
    const leaderboard = await services.competitionManager.getLeaderboard(competitionId);

    // Get competition details
    const competition = await repositories.competitionRepository.findById(competitionId);

    if (!competition) {
      throw new ApiError(404, "Competition not found");
    }

    // Get team names for the leaderboard entries
    const leaderboardWithNames = await Promise.all(
      leaderboard.map(async (entry) => {
        const team = await services.teamManager.getTeam(entry.teamId);
        return {
          ...entry,
          teamName: team ? team.name : 'Unknown Team'
        };
      })
    );

    res.status(200).json({
      success: true,
      competition: {
        id: competition.id,
        name: competition.name,
        status: competition.status,
        startDate: competition.startDate,
        endDate: competition.endDate
      },
      leaderboard: leaderboardWithNames
    });
  } catch (error) {
    next(error);
  }
}
```

- **AccountController**:
  - Update methods to use competitionId
  - Add competition filtering for balances, portfolio, and trades

```typescript
// Update getBalances to use competitionId
static async getBalances(req: Request, res: Response, next: NextFunction) {
  try {
    const teamId = req.teamId as string;
    const competitionId = req.competitionId as string;

    if (!competitionId) {
      throw new ApiError(400, "Competition ID is required");
    }

    // Get balances for this team in this competition
    const balances = await services.balanceManager.getAllBalances(teamId, competitionId);

    // Transform balances for response
    const balancesWithDetails = await Promise.all(
      balances.map(async (balance) => {
        // Get price information for each token
        const priceInfo = await services.priceTracker.getPrice(balance.token);

        return {
          token: balance.token,
          amount: balance.amount,
          valueUsd: priceInfo ? balance.amount * priceInfo.price : null,
          price: priceInfo ? priceInfo.price : null,
          chain: priceInfo ? priceInfo.chain : null,
          specificChain: priceInfo ? priceInfo.specificChain : null
        };
      })
    );

    // Get competition details
    const competition = await repositories.competitionRepository.findById(competitionId);

    res.status(200).json({
      success: true,
      teamId,
      competitionId,
      competitionName: competition ? competition.name : null,
      balances: balancesWithDetails
    });
  } catch (error) {
    next(error);
  }
}

// Update getPortfolio to use competitionId
static async getPortfolio(req: Request, res: Response, next: NextFunction) {
  try {
    const teamId = req.teamId as string;
    const competitionId = req.competitionId as string;

    if (!competitionId) {
      throw new ApiError(400, "Competition ID is required");
    }

    // Get competition details
    const competition = await repositories.competitionRepository.findById(competitionId);

    if (!competition) {
      throw new ApiError(404, "Competition not found");
    }

    // Get all balances for this team in this competition
    const balances = await services.balanceManager.getAllBalances(teamId, competitionId);

    // Get portfolio value
    const portfolioValue = await services.tradeSimulator.calculatePortfolioValue(teamId, competitionId);

    // Transform balances for response with price information
    const tokens = await Promise.all(
      balances.map(async (balance) => {
        // Get price information for each token
        const priceInfo = await services.priceTracker.getPrice(balance.token);

        return {
          token: balance.token,
          amount: balance.amount,
          valueUsd: priceInfo ? balance.amount * priceInfo.price : 0,
          price: priceInfo ? priceInfo.price : 0,
          chain: priceInfo ? priceInfo.chain : null,
          specificChain: priceInfo ? priceInfo.specificChain : null
        };
      })
    );

    // Filter out zero balances and sort by value (highest first)
    const nonZeroTokens = tokens
      .filter(token => token.amount > 0)
      .sort((a, b) => b.valueUsd - a.valueUsd);

    // Get team's position on the leaderboard
    const leaderboard = await services.competitionManager.getLeaderboard(competitionId);
    const leaderboardPosition = leaderboard.findIndex(entry => entry.teamId === teamId) + 1;

    res.status(200).json({
      success: true,
      teamId,
      competitionId,
      competitionName: competition.name,
      portfolio: {
        totalValue: portfolioValue,
        tokens: nonZeroTokens,
        leaderboardPosition: leaderboardPosition || null,
        leaderboardTotal: leaderboard.length
      }
    });
  } catch (error) {
    next(error);
  }
}

// Update getTrades to use competitionId
static async getTrades(req: Request, res: Response, next: NextFunction) {
  try {
    const teamId = req.teamId as string;
    const competitionId = req.competitionId as string;

    // Get pagination parameters
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;

    // Get the trades for this team in this competition
    const trades = await services.tradeSimulator.getTeamTrades(
      teamId,
      competitionId,
      limit,
      offset
    );

    // Sort trades by timestamp (newest first)
    const sortedTrades = [...trades].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    // Get competition details
    const competition = await repositories.competitionRepository.findById(competitionId);

    // Return the trades
    res.status(200).json({
      success: true,
      teamId,
      competitionId,
      competitionName: competition ? competition.name : null,
      trades: sortedTrades,
      pagination: {
        limit,
        offset,
        total: await repositories.tradeRepository.countTeamTradesInCompetition(teamId, competitionId)
      }
    });
  } catch (error) {
    next(error);
  }
}
```

- **Rate Limiter Middleware**:
  - Update to be competition-aware
  - Implement competition-specific rate limiting
  - Allow for different rate limits for teams in multiple competitions

```typescript
// Update rate limiter key structure to include competition context
function getRateLimiter(
  teamId: string,
  competitionId: string,
  type: "trade" | "price" | "account" | "global" | "hourly",
): RateLimiterMemory {
  // Create a composite key that includes both team and competition
  const key = `${teamId}:${competitionId}`;

  if (!rateLimiters.has(key)) {
    rateLimiters.set(key, new Map<string, RateLimiterMemory>());
  }

  const limiters = rateLimiters.get(key)!;

  if (!limiters.has(type)) {
    // Try to get competition-specific rate limits
    let options: IRateLimiterOptions;

    try {
      // Get competition-specific rate limits if available
      const competitionLimits = getCompetitionRateLimits(competitionId, type);
      if (competitionLimits) {
        options = competitionLimits;
      } else {
        // Default to global limits
        options = rateLimiterConfigs[type];
      }
    } catch (error) {
      // Default to global limits on error
      options = rateLimiterConfigs[type];
    }

    limiters.set(type, new RateLimiterMemory(options));
  }

  return limiters.get(type)!;
}

// Helper function to get competition-specific rate limits
async function getCompetitionRateLimits(
  competitionId: string,
  type: "trade" | "price" | "account" | "global" | "hourly",
): Promise<IRateLimiterOptions | null> {
  try {
    const query = `
      SELECT points, duration
      FROM competition_rate_limits
      WHERE competition_id = $1 AND limit_type = $2
    `;

    const result = await repositories.db.query(query, [competitionId, type]);

    if (result.rows.length > 0) {
      const { points, duration } = result.rows[0];

      return {
        points: parseInt(points),
        duration: parseInt(duration),
        blockDuration: rateLimiterConfigs[type].blockDuration, // Use default block duration
      };
    }

    return null;
  } catch (error) {
    console.error(
      `[RateLimiter] Error getting competition rate limits:`,
      error,
    );
    return null;
  }
}

// Middleware function implementation
export const rateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const teamId = req.teamId;

    if (!teamId) {
      // No team ID, skip rate limiting
      return next();
    }

    // Extract competition ID from request (body, query, params or set by auth middleware)
    const competitionId =
      req.body?.competitionId ||
      req.query?.competitionId ||
      req.params?.competitionId ||
      req.competitionId;

    if (!competitionId) {
      // Try to get first active competition for this team
      const activeCompetitions =
        await repositories.competitionRepository.getTeamCompetitions(teamId);

      if (activeCompetitions.length > 0) {
        req.competitionId = activeCompetitions[0].id;
      } else {
        // No competition context, apply global rate limits
        await applyGlobalRateLimits(req, teamId);
        return next();
      }
    }

    // Apply competition-specific rate limits
    await applyCompetitionRateLimits(req, teamId, req.competitionId as string);

    next();
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      // Rate limit exceeded
      const retryAfter = Math.ceil(error.msBeforeNext / 1000) || 1;
      res.set("Retry-After", `${retryAfter}`);

      return res.status(429).json({
        success: false,
        error: "Too many requests, please try again later",
        retryAfter,
      });
    }

    next(error);
  }
};

// Helper function to apply global rate limits
async function applyGlobalRateLimits(
  req: Request,
  teamId: string,
): Promise<void> {
  // Apply different rate limits based on route
  if (req.path.includes("/trade")) {
    await getRateLimiter(teamId, "global", "trade").consume(`trade:${teamId}`);
  } else if (req.path.includes("/price")) {
    await getRateLimiter(teamId, "global", "price").consume(`price:${teamId}`);
  } else if (req.path.includes("/account")) {
    await getRateLimiter(teamId, "global", "account").consume(
      `account:${teamId}`,
    );
  }

  // Apply global hourly limit to all requests
  await getRateLimiter(teamId, "global", "hourly").consume(`hourly:${teamId}`);
}

// Helper function to apply competition-specific rate limits
async function applyCompetitionRateLimits(
  req: Request,
  teamId: string,
  competitionId: string,
): Promise<void> {
  // Apply different rate limits based on route
  if (req.path.includes("/trade")) {
    await getRateLimiter(teamId, competitionId, "trade").consume(
      `trade:${teamId}:${competitionId}`,
    );
  } else if (req.path.includes("/price")) {
    await getRateLimiter(teamId, competitionId, "price").consume(
      `price:${teamId}:${competitionId}`,
    );
  } else if (req.path.includes("/account")) {
    await getRateLimiter(teamId, competitionId, "account").consume(
      `account:${teamId}:${competitionId}`,
    );
  }

  // Apply competition hourly limit to all requests
  await getRateLimiter(teamId, competitionId, "hourly").consume(
    `hourly:${teamId}:${competitionId}`,
  );
}
```

### 2.5 API Updates

- **Trade Endpoints**:
  - Update to require competitionId parameter
  - Update documentation to reflect new requirements

```typescript
/**
 * @openapi
 * /api/trade/execute:
 *   post:
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             required:
 *               - fromToken
 *               - toToken
 *               - amount
 *               - reason
 *               - competitionId
 *             properties:
 *               // Existing properties...
 *               competitionId:
 *                 type: string
 *                 description: ID of the competition to execute the trade in
 */
```

- **New Endpoints**:
  - Add endpoints for listing available competitions
  - Add competition selection functionality

```typescript
/**
 * @openapi
 * /api/team/competitions:
 *   get:
 *     summary: Get competitions the team is participating in
 *     // Documentation...
 */
```

### 2.6 Account and Portfolio API Updates

- **Portfolio Endpoint**:
  - Update to accept competitionId parameter
  - Add filtering by competition

```typescript
/**
 * @openapi
 * /api/account/portfolio:
 *   get:
 *     parameters:
 *       - in: query
 *         name: competitionId
 *         schema:
 *           type: string
 *         description: ID of the competition to get portfolio for
 *         required: true
 */
```

- **Balances Endpoint**:
  - Update to accept competitionId parameter
  - Filter balances by competition

```typescript
/**
 * @openapi
 * /api/account/balances:
 *   get:
 *     parameters:
 *       - in: query
 *         name: competitionId
 *         schema:
 *           type: string
 *         description: ID of the competition to get balances for
 *         required: true
 */
```

- **Trades Endpoint**:
  - Update to accept competitionId parameter
  - Filter trades by competition

```typescript
/**
 * @openapi
 * /api/account/trades:
 *   get:
 *     parameters:
 *       - in: query
 *         name: competitionId
 *         schema:
 *           type: string
 *         description: ID of the competition to get trades for
 *         required: true
 */
```

### 2.7 Team and Competition Management

- **Team Participation Management**:
  - Add endpoints for teams to view available competitions
  - Create a mechanism for teams to join or leave competitions

```typescript
/**
 * @openapi
 * /api/team/competitions:
 *   get:
 *     summary: Get competitions the team is participating in
 *     // Documentation...
 *
 * /api/team/competitions/{competitionId}/join:
 *   post:
 *     summary: Join a competition
 *     // Documentation...
 */
```

- **Team Competition State**:
  - Add a table to track team status per competition
  - Update the team deactivation process to be competition-specific

```sql
CREATE TABLE team_competition_states (
  id SERIAL PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  deactivation_reason TEXT,
  deactivation_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, competition_id)
);
```

- **Competition Selection UI**:
  - Implement UI components for selecting active competition
  - Add competition selection to API client libraries

### 2.8 Authentication Model Updates

- **API Key Validation**:
  - Update to check if team has access to the specified competition
  - Add validation in auth middleware for competition-specific permissions

```typescript
// Update auth middleware to validate competition access
if (competitionId) {
  const isTeamInCompetition =
    await repositories.teamRepository.isTeamInCompetition(
      teamId,
      competitionId,
    );

  if (!isTeamInCompetition && !isAdmin) {
    throw new ApiError(
      403,
      "Your team is not participating in this competition",
    );
  }
}
```

- **Competition-Specific API Keys** (Optional):
  - Consider supporting competition-specific API keys for advanced use cases
  - Update authentication model to associate keys with team-competition pairs

<a name="implementation-considerations"></a>

## 3. Implementation Considerations and Constraints

### 3.1 Performance Implications

- **Database Load**:

  - Multiple active competitions will significantly increase database load
  - Queries will be more complex with additional filtering by competition_id
  - Consider indexing strategies to optimize competition-specific queries:
    - Composite indexes on (team_id, competition_id) for quick lookups
    - Partial indexes for active competitions to speed up common queries
    - Consider index-only scans for frequently accessed data

- **Memory Usage**:

  - Competition-specific caching will increase memory requirements
  - Need for more sophisticated cache management with TTL and eviction policies
  - Implement tiered caching strategies:
    - Level 1: In-memory cache for ultra-fast access to current competition data
    - Level 2: Shared Redis cache for cross-instance data sharing
    - Level 3: Database as the source of truth
  - Set appropriate TTL values for different types of cached data:
    - Short TTL for volatile data (prices, active trades)
    - Longer TTL for stable data (team info, competition settings)

- **Concurrent Operations**:

  - Multiple competitions running portfolio snapshots simultaneously
  - Need for more robust transaction handling and concurrency control
  - Implement job scheduling with prioritization:
    - Use a proper job queue (e.g., Bull) for background processing
    - Prioritize jobs based on competition importance
    - Implement circuit breakers to prevent cascade failures

- **API Throughput**:
  - More complex validation and processing for each request
  - Increased load from teams participating in multiple competitions
  - Implement request queuing and backpressure mechanisms:
    - Set appropriate timeouts for different types of operations
    - Implement exponential backoff for retries
    - Consider rate limiting at the API gateway level

### 3.2 Scaling Considerations

- **Vertical Scaling**:

  - Initial approach: Increase resources (CPU, memory, database)
  - Set reasonable limits on number of concurrent competitions
  - Monitor resource usage carefully with competition-specific metrics
  - Consider hosting resource-intensive competitions during off-peak hours

- **Horizontal Scaling**:

  - For larger deployments, consider distributing competitions across instances
  - Implement competition-aware load balancing
  - Potential approaches:
    - Shard by competition ID
    - Use consistent hashing to distribute load
    - Implement competition affinity to specific servers

- **Database Optimization**:

  - Consider table partitioning for large tables like trades and balances:
    - Partition trades and portfolio_snapshots by competition_id
    - This improves query performance by scanning only relevant partitions
    - Helps with data lifecycle management (archiving old competitions)
  - Implement read replicas for reporting and analytics:
    - Use read replicas for leaderboards and reporting
    - Keep write operations on primary database
    - Consider eventual consistency model where appropriate

- **Competition Prioritization**:

  - Implement resource allocation based on competition importance
  - Stagger intensive operations like portfolio snapshots
  - Create competition classes with different resource allocations:
    - Premium competitions with higher quotas
    - Standard competitions with balanced resources
    - Basic competitions with more constraints

- **Rate Limiting Strategies**:
  - Implement competition-specific rate limits
  - Consider weighted quotas for teams in multiple competitions
  - Create hierarchical rate limits:
    - Per-competition limits (most permissive)
    - Global team limits (caps total usage)
    - System-wide limits (prevents overall overload)
  - Implement adaptive rate limiting:
    - Adjust limits based on current load
    - Implement "slow start" for new competitions
    - Provide feedback mechanisms to inform users of their limit usage

### 3.3 Data Storage Architecture

- **Database Design**:

  - All data tables must include competition_id as a primary key component
  - Design schemas with competition isolation in mind from the start
  - Implement appropriate indexes and constraints for performance

- **Data Partitioning**:

  - Design the database with partitioning by competition_id in mind
  - Consider horizontal partitioning for high-volume competitions
  - Implement separate logical databases for different competition tiers if needed

- **Data Lifecycle Management**:

  - Build in tools for archiving completed competitions
  - Design for easy competition data export and import
  - Implement competition data integrity verification tools

- **Data Isolation**:

  - Strictly enforce isolation between competition data at all layers:
    - Database: Use constraints and triggers to prevent cross-competition data access
    - Repository: Add validation to all methods to verify competition context
    - Service: Implement competition-specific context objects that flow through the app
    - Controller: Validate that API requests only access authorized competitions
  - Consider using database row-level security for critical tables
  - Implement audit logging for any cross-competition data access
  - Create data isolation tests to verify boundaries remain intact

- **Transaction Handling**:
  - Design transaction boundaries with competition context in mind
  - Use serializable isolation level for operations that span multiple tables
  - Implement optimistic concurrency control for high-contention operations
  - Consider transaction patterns:
    - Use atomic transactions for operations within a single competition
    - Avoid transactions that span multiple competitions when possible
    - Implement saga patterns for complex flows that need compensation
  - Handle race conditions:
    - Use advisory locks for competition-specific operations
    - Implement proper retry mechanisms with exponential backoff
    - Consider queue-based architecture for high-contention operations

### 3.4 Operational Considerations

- **Monitoring Architecture**:

  - Competition-specific monitoring and alerts
  - Comprehensive dashboard for system health across competitions
  - Structured logging with competition context:
    - Include competition_id in all log entries
    - Create competition-specific log views
    - Set up alerting based on competition-specific thresholds
  - Comprehensive metrics:
    - Per-competition active users, trade volume, etc.
    - Resource usage by competition
    - Performance metrics for key operations

- **API Validation and Error Handling**:

  - Implement consistent API parameter validation:
    - Required competitionId parameter for all endpoints
    - Standardized error responses for missing or invalid competition context
    - Clear indication of which competitions are accessible to the user
  - Enhance error reporting:
    - Include competition context in error messages
    - Provide helpful suggestions when competition access is denied
    - Log detailed information about competition-related errors
  - Design graceful fallbacks:
    - Default to most recent competition when no competitionId is provided
    - Allow admins to view and manage all competitions
    - Implement competition selection UI components

- **Quota and Resource Management**:

  - Design competition-specific quota management:
    - Assign resource quotas per competition (API calls, trades, etc.)
    - Monitor and enforce team quotas within each competition
    - Implement graduated throttling instead of hard cutoffs
  - Resource allocation:
    - Prioritize resources for premium competitions
    - Implement fair resource sharing across competitions
    - Consider time-based resource allocation for scheduled events

- **Backup and Recovery Strategies**:
  - Implement competition-specific backup policies:
    - Consider point-in-time recovery for active competitions
    - Design backup frequency based on competition importance
    - Enable competition-level restore operations
  - Disaster recovery planning:
    - Document competition recovery order in DR scenarios
    - Establish competition-specific recovery time objectives
    - Test competition isolation during recovery scenarios

## 4. Recommended Implementation Architecture

### Core Architecture Components

1. **Database Layer**

   - Competition-centric schema design
   - Proper indexing and partitioning strategy
   - Isolation between competition data

2. **Repository Layer**

   - All methods accept competitionId parameter
   - Competition-specific data access patterns
   - Optimized queries for multi-competition scenarios

3. **Service Layer**

   - Competition Manager service to handle all competition-related operations
   - Balance Manager with competition-specific balance handling
   - Trade Simulator that manages trades within competition context
   - Configuration service for competition-specific settings

4. **API Layer**

   - RESTful API with competition ID as a required parameter
   - Comprehensive validation of competition access permissions
   - Clear error messages for invalid competition operations

5. **Authentication & Authorization**

   - Competition-specific access control
   - Team participation management
   - API keys with competition-specific permissions

6. **User Interface**

   - Competition selection as a core UI component
   - Clear indication of active competition
   - Competition-specific dashboards and views

7. **Monitoring & Operations**
   - Competition-specific metrics and logs
   - Alerting based on competition thresholds
   - Tools for competition management

## Conclusion

The trading simulator application should be designed with multiple simultaneous competitions as a core architectural requirement. By building competition context into every layer of the application from the ground up, we can create a robust and scalable platform capable of supporting various trading competitions with different configurations running concurrently.

This design approach will provide significantly greater flexibility and capacity to serve different user groups with specialized trading competitions. While implementing a multi-competition model increases complexity, proper design patterns and architectural decisions from the start will ensure a maintainable and scalable system.
