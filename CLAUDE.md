# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For complete development guidance including commands, architecture, and patterns, see [AGENTS.md](./AGENTS.md).

## Code Philosophy

### Database-First Architecture

We believe in leveraging PostgreSQL's power rather than reimplementing logic in application code. This means:

- Complex calculations happen in SQL, not JavaScript
- Aggregations use database functions, not array methods
- Data consistency is enforced by database constraints, not application validation alone
- Performance optimization starts with proper indexes and query design

### Type Safety Without Compromise

- **Zero tolerance for `any` types** in production code
- All external data must be validated at runtime using type guards or Zod schemas
- Database types must be properly typed in TypeScript
- Prefer compile-time safety over runtime assertions when possible

### Performance Through Design

- Every list endpoint must support pagination (no unlimited queries)
- Every expensive operation must be cached appropriately
- Every query must have appropriate indexes
- N+1 queries are considered bugs, not performance issues

### Testing as Documentation

- Tests demonstrate intended behavior better than comments
- Tests cover edge cases explicitly, not just happy paths
- Tests use realistic data scenarios, not contrived examples
- Test names clearly describe what is being tested and why
- **Current Reality**: Test coverage varies significantly by package:
  - New packages (`rewards`, `staking-contracts`): 100% required
  - Legacy apps (`api`, `comps`): Currently minimal coverage, gradually improving
  - All new critical path code needs tests regardless of package thresholds

### Clean Architecture Principles

- **Controllers**: Handle HTTP concerns only (serialization, deserialization, status codes)
- **Services**: Contain all business logic and orchestration
- **Repositories**: Manage database interactions exclusively
- **No cross-layer violations**: Controllers never call repositories directly

### Code Reuse Over Duplication

- Search for existing functionality before implementing new features
- Document why existing solutions don't work when creating alternatives
- Remove dead code immediately upon discovery
- Deprecate properly with migration paths

## Working with Claude

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

### Always Do These

- ✅ Use TypeScript strict mode
- ✅ Add indexes for foreign keys and WHERE clause columns
- ✅ Validate environment variables on startup
- ✅ Use structured JSON logging with request IDs
- ✅ Document breaking changes in PR descriptions
- ✅ Run linter and tests before marking tasks complete

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
2. Database changes require migration generation
3. All code must pass TSDoc coverage requirements (99% threshold)
4. E2E tests run against a real database - ensure proper cleanup
