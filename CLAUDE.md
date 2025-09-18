# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For complete development guidance including commands, architecture, and patterns, see [AGENTS.md](./AGENTS.md).

## Code Philosophy

### Database-First Architecture

We believe in leveraging PostgreSQL's power rather than reimplementing logic in application code. This means:

- Complex calculations happen in SQL, not JavaScript
- Aggregations use database functions (`SUM()`, `AVG()`, `COUNT()`), not array methods
- Sorting happens in SQL (`ORDER BY`), not JavaScript `.sort()`
- Use `DISTINCT ON` with proper indexes for latest-record queries
- Data consistency is enforced by database constraints, not application validation alone
- Performance optimization starts with proper indexes and query design
- Never fetch all records to filter/aggregate in memory - use SQL WHERE/GROUP BY/HAVING clauses

### Type Safety Without Compromise

- **Zero tolerance for `any` types** in production code
- All functions must have explicit return types (never rely on inference)
- Prefer named types/interfaces over inline type definitions
- All external data must be validated at runtime using type guards or Zod schemas
- Database types must be properly typed in TypeScript
- Prefer compile-time safety over runtime assertions when possible

### Performance Through Design

- Every list endpoint must support pagination (no unlimited queries)
- Caching decisions require human review (consider platform caching like Vercel first)
- Every query must have appropriate indexes
- N+1 queries (fetching a list then making separate queries per item) must be avoided - use joins or batch fetching instead

### Testing as Documentation

- Tests demonstrate intended behavior better than comments
- Tests cover edge cases explicitly, not just happy paths
- Tests use realistic data scenarios, not contrived examples
- Test names clearly describe what is being tested and why
- **Test Coverage**: See `coverage.config.json` for current thresholds
  - Coverage requirements vary by package
  - New packages start with higher coverage requirements
  - All new critical path code needs tests regardless of package thresholds

### Clean Architecture Principles

- **Controllers**: Handle HTTP concerns only (serialization, deserialization, status codes)
- **Services**: Contain all business logic and orchestration
- **Repositories**: Manage database interactions exclusively
- **No cross-layer violations**: Controllers never call repositories directly

### Code Reuse Over Duplication

- Search for existing functionality before implementing new features
- Document why existing solutions don't work when creating alternatives
- **When implementing a replacement**: Remove the old implementation in the same PR
- Remove dead code immediately upon discovery
- Deprecate properly with migration paths

## Working with Claude

### Critical Documentation Rule

**NEVER use temporal or comparative language in code comments or TSDoc**. This is crucial because:

- Comments like "new optimized method" or "replaces old implementation" become misleading over time
- Future AI reviewers lack the historical context to understand what "new" or "old" means
- Implementation details like "avoids N+1" or "atomic operation" belong in commit messages, not code

**Instead of:** "Optimized method that efficiently fetches users avoiding N+1 queries"  
**Write:** "Fetches users with their associated posts in a single query"

Always describe WHAT the code does, never HOW it compares to other code or WHY it's better.

### Key Principles When Using Claude

1. **Be Explicit About Context**: Claude works best when given clear context about the current task, existing patterns, and constraints.

2. **Leverage Existing Patterns**: Always point Claude to existing implementations of similar features in the codebase.

3. **Validate Generated Code**:

   - Check for `any` types
   - Verify database queries are optimized
   - Ensure proper error handling
   - Confirm test coverage

4. **Iterative Refinement**: Use Claude for initial implementation, then refine based on:
   - Linting results
   - Type checking
   - Test failures
   - Performance profiling

### Best Practices for Prompting

1. **Reference Specific Files**: Point to exact file paths and line numbers when discussing code.

2. **Include Error Messages**: Provide complete error messages and stack traces.

3. **Specify Requirements Clearly**:

   - Performance requirements (response times, throughput)
   - Type safety requirements
   - Testing requirements
   - Documentation needs

4. **Request Explanations**: Ask Claude to explain trade-offs and design decisions.

## Critical Rules Summary

### Never Do These

- ❌ Use `any` type (use proper type guards or generics)
- ❌ Fetch all records then filter in memory (use SQL WHERE clauses)
- ❌ Create unbounded queries (always use LIMIT)
- ❌ Mix authentication patterns (stick to one per endpoint)
- ❌ Log sensitive data (passwords, API keys, PII)
- ❌ Skip tests for critical paths (auth, payments, trading)
- ❌ Implement caching without human review (always discuss caching strategy first)
- ❌ Leave both old and new implementations when refactoring (remove replaced code immediately)
- ❌ Use temporal/comparative words in comments ("new", "optimized", "replaces", "efficient")

### Always Do These

- ✅ Use TypeScript strict mode
- ✅ Specify explicit return types for all functions
- ✅ Create named types/interfaces instead of inline type definitions
- ✅ Add indexes for foreign keys and WHERE clause columns
- ✅ Validate environment variables on startup
- ✅ Use structured JSON logging with request IDs
- ✅ Document breaking changes in PR descriptions
- ✅ Run linter and tests before marking tasks complete
- ✅ Push computation to the database (aggregations, sorting, filtering)
- ✅ Use atomic operations to prevent race conditions
- ✅ Sample high-volume logging and monitoring events (e.g., 1-10%)
- ✅ Mask sensitive data in logs (wallet addresses, API keys)
- ✅ Write comments that describe WHAT code does, not HOW it's better than before

## Quick Reference

### Commands

```bash
# Development
pnpm dev              # Start all apps
pnpm build            # Build everything
pnpm lint             # Check code style
pnpm format           # Auto-fix formatting
pnpm test             # Run tests

# Database (API)
pnpm --filter api db:gen-migrations  # Generate migration
pnpm --filter api db:migrate   # Run migrations
pnpm --filter api db:studio    # Open Drizzle Studio
```

### File Locations

- API Routes: `apps/api/src/routes/`
- Controllers: `apps/api/src/controllers/`
- Services: `apps/api/src/services/`
- Repositories: `apps/api/src/database/repositories/`
- DB Schemas: `packages/db-schema/src/`
- Frontend Components: `apps/comps/components/`

## Claude Code Specific Notes

This project is optimized for AI development assistance. All standard development patterns and commands are documented in the AGENTS.md file above.

When working with Claude Code:

1. The project uses pnpm workspaces - be aware of package boundaries
2. Database changes require migration generation (`pnpm --filter api db:gen-migrations`)
3. TSDoc coverage requirements vary by package (see `coverage.config.json`)
4. E2E tests run against a real database - ensure proper cleanup
5. Metrics are exposed via Prometheus on port 3003 - alerting is handled externally
6. Sentry is configured for error tracking with 10% sampling in production
