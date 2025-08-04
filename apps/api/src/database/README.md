# Database Module Documentation

This module provides database connectivity and operations for the trading simulator API. It uses PostgreSQL with Drizzle ORM and supports both primary database and read replica connections for optimal performance.

## Database Connections

### Primary Database (`db`)

The primary database connection handles all write operations and read operations that require immediate consistency.

**Use for:**

- All write operations (`INSERT`, `UPDATE`, `DELETE`)
- Read operations that need guaranteed consistency
- Transactions that mix reads and writes
- Read-after-write scenarios where consistency is critical

```typescript
import { db } from "@/database/db.js";

// Write operations
const agent = await db.insert(agents).values(data).returning();

// Reads that need consistency (e.g., after a write)
const updatedAgent = await db
  .select()
  .from(agents)
  .where(eq(agents.id, agentId));
```

### Read Replica (`dbRead`)

The read replica connection handles read-only operations that can tolerate slight replication lag (typically milliseconds to seconds).

**Use for:**

- Dashboard queries and analytics
- Leaderboard displays
- Search functionality
- Reporting and data exports
- Public API endpoints that serve cached-like data
- Background jobs that process historical data

**Benefits:**

- Reduces load on primary database
- Improves overall system performance
- Better resource utilization

```typescript
import { dbRead } from "@/database/db.js";

// Analytics and reporting queries
const leaderboard = await dbRead.select().from(competitionsLeaderboard);

// Search operations
const agents = await dbRead
  .select()
  .from(agents)
  .where(ilike(agents.name, `%${searchTerm}%`));
```

## Configuration

### Environment Variables

```bash
# Primary database connection (required)
DATABASE_URL=postgresql://user:password@primary-host:5432/database

# Read replica connection (optional - falls back to primary if not set)
DATABASE_READ_REPLICA_URL=postgresql://user:password@replica-host:5432/database

# SSL configuration
DB_SSL=true
DB_CA_CERT_BASE64=base64_encoded_cert  # For Vercel deployments
DB_CA_CERT_PATH=/path/to/cert.pem      # For file-based certs
```

### Fallback Behavior

If `DATABASE_READ_REPLICA_URL` is not provided, the read replica connection will automatically fall back to using the primary database URL. This ensures the application works in development environments where you might not have a separate read replica.

## Repository Pattern

All database operations should go through repositories in `src/database/repositories/`. This provides:

- Consistent error handling
- Automatic query logging and metrics
- Proper connection management
- Type safety with Drizzle ORM

### Example Repository Usage

```typescript
// In a repository file
import { db, dbRead } from "@/database/db.js";

// Write operation - use primary
export async function createAgent(data: InsertAgent): Promise<SelectAgent> {
  const [result] = await db.insert(agents).values(data).returning();
  return result;
}

// Read operation that can use replica
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  return dbRead
    .select()
    .from(competitionsLeaderboard)
    .orderBy(desc(competitionsLeaderboard.score));
}

// Read operation that needs consistency
export async function getAgentAfterUpdate(
  agentId: string,
): Promise<SelectAgent | null> {
  const [result] = await db.select().from(agents).where(eq(agents.id, agentId));
  return result || null;
}
```

## Database Operations Utility

The `src/database/utils.ts` file provides utilities to help decide which connection to use:

```typescript
import { DB_OPERATIONS, getDbConnection } from "@/database/utils.js";

// Using the helper function
const connection = getDbConnection("read", false); // Uses read replica
const results = await connection.select().from(agents);

// Using predefined operation patterns
const operation = DB_OPERATIONS.GET_LEADERBOARD;
const dbConn = getDbConnection(operation.type, operation.requiresConsistency);
```

## Monitoring and Logging

Both database connections include automatic logging and Prometheus metrics:

- All queries are logged with operation type and trace ID
- Query counts are tracked by operation and status
- Connection errors are logged and cause process exit
- Development mode shows detailed query previews

### Log Examples

**Development:**

```
[trace-123] [DB] SELECT - SELECT * FROM agents WHERE name ILIKE $1
```

**Production:**

```json
{
  "traceId": "trace-123",
  "type": "db",
  "operation": "SELECT",
  "status": "success",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "queryPreview": "SELECT * FROM agents WHERE name ILIKE $1"
}
```

## Best Practices

### When to Use Read Replica

✅ **Good candidates:**

- Leaderboard queries
- Search and filtering operations
- Analytics dashboards
- Historical data reports
- Public API endpoints
- Background data processing

❌ **Avoid for:**

- Queries immediately after writes
- Transaction-critical reads
- Real-time consistency requirements
- Administrative operations

### Performance Considerations

1. **Query Optimization**: Both connections benefit from proper indexing and query optimization
2. **Connection Pooling**: Both connections use connection pooling for efficiency
3. **Monitoring**: Use the built-in metrics to monitor query performance
4. **Load Distribution**: Properly distributing read queries helps overall system performance

### Development vs Production

- **Development**: Usually both connections point to the same database
- **Production**: Read replica should point to a separate read-only database instance
- **Testing**: Test environments may use the same database for both connections

## Database Management Functions

```typescript
// Migration and seeding (always use primary connection)
await migrateDb(); // Run database migrations
await seedDb(); // Seed with test data
await resetDb(); // Reset database (development only)
await dropAll(); // Drop all schemas (testing only)
```

## Error Handling

Database errors are automatically handled with:

- Detailed error logging
- Prometheus metrics tracking
- Proper error propagation to calling code
- Connection recovery for transient issues

For deadlock situations (common in testing), the `resetDb()` function includes automatic retry logic with exponential backoff.
