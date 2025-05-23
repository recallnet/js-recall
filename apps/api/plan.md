# Implementation Plan: Teams → Users + Agents Architecture

## Overview

This document outlines the comprehensive changes required to migrate from the current `teams`-based architecture to a new `users` + `agents` architecture. The implementation plan involves splitting the current `teams` table into two separate entities:

- **Users**: Represent the actual human users who own agents
- **Agents**: Represent the AI agents that participate in competitions and perform trading activities

## Current State Analysis

### Current Schema Structure

- `teams` table serves as the primary entity for all operations
- All trading activity, competition participation, and authentication is tied to `teamId`
- Tables with foreign keys to `teams`:
  - `competition_teams.team_id` → `teams.id`
  - `trading_comps.balances.team_id` → `teams.id`
  - `trading_comps.trades.team_id` → `teams.id`
  - `trading_comps.portfolio_snapshots.team_id` → `teams.id`

### Current Application Layers

- **Repository Layer**: 5 repositories with team-centric operations
- **Service Layer**: 9 services with team-based business logic
- **Controller Layer**: 3 main controllers handling team operations
- **Middleware Layer**: Authentication tied to team API keys
- **Type System**: Extensive use of `teamId` throughout interfaces

---

## AUTHORIZATION & PERMISSION MODEL

### Overview

The new architecture implements strict permission boundaries between users, agents, and admins:

### User Management Permissions

#### Admin-Only User Operations

- **User Registration**: Only admins can register new users
- **User Status Management**: Only admins can suspend/delete users
- **User Wallet Address**: Only admins can modify wallet addresses
- **User Metadata**: Only admins can modify user metadata
- **Full User Profile Access**: Admins can view and edit all user fields

#### User Self-Service Operations (Limited)

- **Profile Updates**: Users can only update `name` and `imageUrl`
- **View Own Profile**: Users can view their own complete profile
- **Create Agents**: Users can create new agents under their ownership
- **View Own Agents**: Users can list and view details of agents they own

#### Forbidden User Operations

- Users **CANNOT** modify their own:
  - `walletAddress` (set during admin registration)
  - `status` (active/suspended/deleted)
  - `metadata` (admin-controlled settings)
  - `id` or `createdAt`/`updatedAt` timestamps

### Agent Management Permissions

#### Admin-Only Agent Operations

- **Agent Status Management**: Deactivate/reactivate agents
- **Agent API Key Management**: View, reset, or regenerate API keys
- **Agent Owner Transfer**: Change `ownerId` (transfer ownership)
- **Agent Wallet Address**: Modify `walletAddress`
- **Agent Metadata**: Modify agent metadata
- **Delete Agents**: Permanently delete agents
- **Full Agent Access**: View and edit all agent fields across all users

#### User Self-Service Agent Operations (Limited)

- **Agent Creation**: Create new agents under their ownership
- **Agent Profile Updates**: Update only `name`, `description`, and `imageUrl`
- **View Own Agents**: View details of agents they own
- **Request API Key**: Get their agent's API key (for distribution)

#### Forbidden User Agent Operations

- Users **CANNOT** modify their agents':
  - `ownerId` (ownership cannot be transferred by user)
  - `apiKey` (cannot reset or regenerate)
  - `status` (cannot deactivate/reactivate)
  - `walletAddress` (admin-controlled)
  - `metadata` (admin-controlled settings)
  - Agents owned by other users

### Admin Management Permissions

#### Admin-Only Operations

- **User Registration**: Register new users in the system
- **Competition Management**: Create, start, end competitions
- **Agent Competition Control**: Add/remove agents from competitions
- **System Reports**: Access performance reports and analytics
- **User/Agent Search**: Search across all users and agents
- **Status Management**: Suspend/reactivate users and agents

### Authentication Requirements

#### User Endpoints

- **Session-Based Auth**: SIWE authentication required
- **Scope**: Operations limited to own profile and owned agents
- **Session Data**: Must contain valid `userId`

#### Agent API Endpoints

- **API Key Auth**: Agent API key in Authorization header
- **Scope**: Trading and account operations for the specific agent
- **Request Data**: Must contain valid `agentId`

#### Admin Endpoints

- **Admin API Key Auth**: Admin API key in Authorization header
- **Scope**: Full system access to all users, agents, competitions
- **Request Data**: Must contain valid `adminId` and `isAdmin=true`

---

## 1. DATABASE SCHEMA CHANGES

### 1.1 New Tables to Create

#### Users Table

```sql
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY NOT NULL,
  "wallet_address" varchar(42) UNIQUE NOT NULL,
  "name" varchar(100),
  "email" varchar(100),
  "image_url" text,
  "is_admin" boolean DEFAULT false NOT NULL,
  "metadata" jsonb,
  "status" varchar(20) DEFAULT 'active' NOT NULL, -- 'active', 'suspended', 'deleted'
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
```

#### Agents Table

```sql
CREATE TABLE "agents" (
  "id" uuid PRIMARY KEY NOT NULL,
  "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "wallet_address" varchar(42) UNIQUE, -- nullable for now
  "name" varchar(100) NOT NULL,
  "description" text,
  "image_url" text,
  "api_key" varchar(400) NOT NULL,
  "metadata" jsonb,
  "status" varchar(20) DEFAULT 'active' NOT NULL, -- 'active', 'suspended', 'deleted'
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "agents_owner_id_name_key" UNIQUE("owner_id", "name"),
  CONSTRAINT "agents_api_key_key" UNIQUE("api_key")
);
```

### 1.2 Tables to Modify

#### Competition Participation

- Rename `competition_teams` → `competition_agents`
- Change `team_id` → `agent_id`
- Update foreign key to reference `agents.id`

#### Trading Tables

- `trading_comps.balances`: `team_id` → `agent_id`
- `trading_comps.trades`: `team_id` → `agent_id`
- `trading_comps.portfolio_snapshots`: `team_id` → `agent_id`

### 1.3 Indexes to Create

```sql
-- Users table indexes
CREATE INDEX "idx_users_wallet_address" ON "users"("wallet_address");
CREATE INDEX "idx_users_status" ON "users"("status");
CREATE INDEX "idx_users_is_admin" ON "users"("is_admin");

-- Agents table indexes
CREATE INDEX "idx_agents_owner_id" ON "agents"("owner_id");
CREATE INDEX "idx_agents_status" ON "agents"("status");
CREATE INDEX "idx_agents_wallet_address" ON "agents"("wallet_address");
CREATE INDEX "idx_agents_api_key" ON "agents"("api_key");

-- Update existing indexes
-- All team_id indexes need to be recreated as agent_id indexes
```

### 1.4 Data Migration Strategy

1. **Create new tables**
2. **Create new indexes**
3. **Update foreign keys** in trading tables
4. **Verify data integrity**
5. **Drop old tables** after successful migration

- Handled automatically using Drizzle - will regenerate schema using `pnpm db:gen-migrations`

---

## 2. REPOSITORY LAYER CHANGES

### 2.1 New Repositories to Create

#### `user-repository.ts`

```typescript
// Core user operations
- create(user: InsertUser)
- findAll()
- findById(id: string)
- findByWalletAddress(walletAddress: string)
- findByEmail(email: string)
- update(user: PartialExcept<InsertUser, "id">)
- delete(id: string)
- searchUsers(searchParams: UserSearchParams)
```

#### `agent-repository.ts`

```typescript
// Core agent operations
- create(agent: InsertAgent)
- findAll()
- findById(id: string)
- findByOwnerId(ownerId: string)
- findByApiKey(apiKey: string)
- update(agent: PartialExcept<InsertAgent, "id">)
- delete(id: string)
- isAgentInCompetition(agentId: string, competitionId: string)
- deactivateAgent(agentId: string, reason: string)
- reactivateAgent(agentId: string)
- searchAgents(searchParams: AgentSearchParams)
```

### 2.2 Existing Repositories to Modify

#### `team-repository.ts` → Split into user and agent repositories

- **User-related methods** → `user-repository.ts`
- **Agent-related methods** → `agent-repository.ts`
- **Deprecate** existing team repository

#### `balance-repository.ts`

**Methods to Update:**

- `saveBalance(teamId, ...)` → `saveBalance(agentId, ...)`
- `getBalance(teamId, ...)` → `getBalance(agentId, ...)`
- `getTeamBalances(teamId)` → `getAgentBalances(agentId)`
- `initializeTeamBalances(teamId, ...)` → `initializeAgentBalances(agentId, ...)`
- `resetTeamBalances(teamId, ...)` → `resetAgentBalances(agentId, ...)`

**Database Changes:**

- All queries using `team_id` → `agent_id`
- Update foreign key references
- Update unique constraints

#### `competition-repository.ts`

**Methods to Update:**

- `addTeamToCompetition(competitionId, teamId)` → `addAgentToCompetition(competitionId, agentId)`
- `addTeams(competitionId, teamIds)` → `addAgents(competitionId, agentIds)`
- `getTeams(competitionId)` → `getAgents(competitionId)`
- `getCompetitionTeams(competitionId)` → `getCompetitionAgents(competitionId)`
- `createPortfolioSnapshot(snapshot)` → Update to use `agentId`
- `getLatestPortfolioSnapshots(competitionId)` → Update queries
- `getTeamPortfolioSnapshots(competitionId, teamId)` → `getAgentPortfolioSnapshots(competitionId, agentId)`

**Database Changes:**

- Table reference: `competitionTeams` → `competitionAgents`
- Column references: `teamId` → `agentId`

#### `trade-repository.ts`

**Methods to Update:**

- All methods accepting `teamId` → `agentId`
- `getTeamTrades(teamId, ...)` → `getAgentTrades(agentId, ...)`

**Database Changes:**

- All queries using `team_id` → `agent_id`

#### `price-repository.ts`

**No changes required** - doesn't reference teams directly

---

## 3. SERVICE LAYER CHANGES

### 3.1 New Services to Create

#### `user-manager.service.ts`

```typescript
class UserManager {
  // User registration and management
  - registerUser(walletAddress, name?, email?, imageUrl?)
  - getUser(userId)
  - getAllUsers()
  - updateUser(user)
  - deleteUser(userId)
  - getUserByWalletAddress(walletAddress)
  - searchUsers(searchParams)

  // Admin management
  - promoteToAdmin(userId)
  - revokeAdmin(userId)
  - isUserAdmin(userId)
}
```

#### `agent-manager.service.ts`

```typescript
class AgentManager {
  // Agent creation and management
  - createAgent(ownerId, name, description?, metadata?, imageUrl?)
  - getAgent(agentId)
  - getAgentsByOwner(ownerId)
  - updateAgent(agent)
  - deleteAgent(agentId)

  // API key management
  - generateApiKey()
  - resetApiKey(agentId)
  - validateApiKey(apiKey)
  - getDecryptedApiKeyById(agentId)

  // Agent status management
  - deactivateAgent(agentId, reason)
  - reactivateAgent(agentId)
  - isAgentInactive(agentId)

  // Competition participation
  - isAgentInCompetition(agentId, competitionId)
}
```

### 3.2 Existing Services to Modify

#### `team-manager.service.ts` → Split functionality

**Move to UserManager:**

- User registration logic
- User profile management
- User search functionality

**Move to AgentManager:**

- API key management
- Authentication logic
- Agent activation/deactivation
- Competition participation checks

**Deprecate:** Original TeamManager service

#### `balance-manager.service.ts`

**Methods to Update:**

- `initializeTeamBalances(teamId)` → `initializeAgentBalances(agentId)`
- `getBalance(teamId, tokenAddress)` → `getBalance(agentId, tokenAddress)`
- `getAllBalances(teamId)` → `getAllBalances(agentId)`
- `updateBalance(teamId, ...)` → `updateBalance(agentId, ...)`
- `addAmount(teamId, ...)` → `addAmount(agentId, ...)`
- `subtractAmount(teamId, ...)` → `subtractAmount(agentId, ...)`
- `resetTeamBalances(teamId, ...)` → `resetAgentBalances(agentId, ...)`

**Internal Changes:**

- Update cache keys: `teamId` → `agentId`
- Update logging messages
- Update error messages

#### `trade-simulator.service.ts`

**Methods to Update:**

- `executeTrade(teamId, ...)` → `executeTrade(agentId, ...)`
- `getTeamTrades(teamId, ...)` → `getAgentTrades(agentId, ...)`
- `calculatePortfolioValue(teamId)` → `calculatePortfolioValue(agentId)`

**Internal Changes:**

- Trade cache: `Map<string, Trade[]>` keys change from `teamId` → `agentId`
- Update all logging and error messages
- Update database calls

#### `portfolio-snapshotter.service.ts`

**Methods to Update:**

- `getTeamPortfolioSnapshots(competitionId, teamId)` → `getAgentPortfolioSnapshots(competitionId, agentId)`
- Internal snapshot creation logic to use `agentId`

**Internal Changes:**

- Update database calls
- Update logging messages

#### `competition-manager.service.ts`

**Methods to Update:**

- Team-related methods → Agent-related methods
- Competition participation logic
- Leaderboard generation

#### `auth.service.ts`

**Updates Required:**

- Session management to handle both `userId` and `agentId`
- Login flow may need to select which agent to use
- Update session data structure

---

## 4. CONTROLLER LAYER CHANGES

### 4.1 Existing Controllers to Modify

#### `account.controller.ts`

**Method Updates:**

- `getProfile(req, res, next)`:

  - Use `req.agentId` instead of `req.teamId`
  - Return agent profile + owner user information
  - Update response schema

- `updateProfile(req, res, next)`:

  - Update agent profile using `agentManager`
  - Handle both agent and user profile updates

- `getBalances(req, res, next)`:

  - Use `agentId` instead of `teamId`
  - Update service calls

- `getPortfolio(req, res, next)`:

  - Use `agentId` for portfolio retrieval
  - Update service calls

- `getTrades(req, res, next)`:

  - Use `agentId` for trade history
  - Update service calls

- `resetApiKey(req, res, next)`:
  - Use `agentManager` instead of `teamManager`
  - Update to work with agents

#### `trade.controller.ts`

**Method Updates:**

- `executeTrade(req, res, next)`:
  - Use `req.agentId` instead of `req.teamId`
  - Update service calls to use `agentId`

#### `admin.controller.ts`

**Method Updates:**

- Team management endpoints → Agent management endpoints
- `deleteTeam(req, res, next)` → `deleteAgent(req, res, next)`
- `deactivateTeam(req, res, next)` → `deactivateAgent(req, res, next)`
- `reactivateTeam(req, res, next)` → `reactivateAgent(req, res, next)`
- Competition management to work with agents
- Portfolio snapshots to use `agentId`
- Leaderboard generation to use agents

**New Endpoints Needed:**

- User management endpoints
- Agent creation/management endpoints

### 4.2 New Controllers to Consider

#### `user.controller.ts` (Optional)

- User-specific operations
- User profile management
- User search functionality

#### `agent.controller.ts` (Optional)

- Agent-specific operations
- Agent creation and management
- Could be merged with account controller

---

## 5. MIDDLEWARE LAYER CHANGES

### 5.1 Authentication Middleware

#### `auth.middleware.ts`

**Critical Changes:**

- Update API key validation to return `agentId` instead of `teamId`
- Set `req.agentId` instead of `req.teamId`
- Admin check logic needs to work with agents
- Session authentication may need both `userId` and `agentId`

**Updated Flow:**

1. **SIWE Session Auth**: Extract `userId` and potentially `agentId` from session
2. **API Key Auth**: Validate API key and get `agentId` from `AgentManager`
3. **Set Request Properties**: `req.agentId`, `req.userId`, `req.isAdmin`

#### `admin-auth.middleware.ts`

**Updates Required:**

- Check admin status through agent or user
- May need to verify agent owner is admin

#### `rate-limiter.middleware.ts`

**Updates Required:**

- Update rate limiting keys to use `agentId` instead of `teamId`

### 5.2 Express Type Definitions

#### `express.d.ts`

**Updates Required:**

```typescript
declare global {
  namespace Express {
    interface Request {
      session?: IronSession<SessionData>;
      agentId?: string; // New
      userId?: string; // New
      wallet?: string;
      isAdmin?: boolean;
      admin?: {
        id: string;
        name: string;
      };
      competitionId?: string;
    }
  }
}
```

---

## 6. ROUTE LAYER CHANGES

### 6.1 Existing Routes to Update

#### `account.routes.ts`

**Documentation Updates:**

- Update OpenAPI specs to reflect agent-based system
- Update request/response schemas
- Change terminology from "team" to "agent"
- Update parameter descriptions

#### `trade.routes.ts`

**Documentation Updates:**

- Update OpenAPI documentation
- Change team references to agent references
- Update response schemas

#### `admin.routes.ts`

**Route Updates:**

- Team management routes → Agent management routes
- Update route parameters: `teamId` → `agentId`
- Add new user management routes
- Update OpenAPI documentation

#### `auth.routes.ts`

**Updates Required:**

- Update authentication flow documentation
- May need separate user registration vs agent creation flows

### 6.2 New Routes to Consider

#### User Management Routes

```
GET    /api/admin/users
POST   /api/admin/users
GET    /api/admin/users/:userId
PUT    /api/admin/users/:userId
DELETE /api/admin/users/:userId
```

#### Agent Management Routes

```
GET    /api/admin/agents
POST   /api/admin/agents
GET    /api/admin/agents/:agentId
PUT    /api/admin/agents/:agentId
DELETE /api/admin/agents/:agentId
GET    /api/admin/users/:userId/agents
```

---

## 7. TYPE DEFINITIONS CHANGES

### 7.1 Database Schema Types

#### `core/types.ts`

**New Types to Add:**

```typescript
export type SelectUser = typeof defs.users.$inferSelect;
export type InsertUser = typeof defs.users.$inferInsert;

export type SelectAgent = typeof defs.agents.$inferSelect;
export type InsertAgent = typeof defs.agents.$inferInsert;

export type SelectCompetitionAgent = typeof defs.competitionAgents.$inferSelect;
export type InsertCompetitionAgent = typeof defs.competitionAgents.$inferInsert;
```

### 7.2 Application Types

#### `types/index.ts`

**New Interfaces:**

```typescript
export interface User {
  id: string;
  walletAddress: string;
  name?: string;
  email?: string;
  imageUrl?: string;
  metadata?: any;
  status: "active" | "suspended" | "deleted";
  createdAt: Date;
  updatedAt: Date;
}

export interface Agent {
  id: string;
  ownerId: string;
  walletAddress?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  apiKey: string;
  metadata?: AgentMetadata;
  status: "active" | "suspended" | "deleted";
  createdAt: Date;
  updatedAt: Date;
}
```

**Updated Interfaces:**

```typescript
// Update existing interfaces to use agentId
export interface Trade {
  // ... existing fields
  agentId: string; // Changed from teamId
  // ... rest of fields
}

export interface PortfolioValue {
  agentId: string; // Changed from teamId
  // ... rest of fields
}

export interface ApiAuth {
  agentId: string; // Changed from teamId
  key: string;
}

export interface AuthenticatedRequest extends Request {
  session?: IronSession<SessionData>;
  agentId?: string; // New
  userId?: string; // New
  wallet?: string;
  isAdmin?: boolean;
  // ... rest of fields
}

export interface SessionData {
  nonce?: string;
  siwe?: SiweMessage;
  agentId?: string; // New
  userId?: string; // New
  wallet?: string;
}
```

**New Search Interfaces:**

```typescript
export interface UserSearchParams {
  email?: string;
  name?: string;
  walletAddress?: string;
  status?: "active" | "suspended" | "deleted";
}

export interface AgentSearchParams {
  name?: string;
  ownerId?: string;
  status?: "active" | "suspended" | "deleted";
}
```

---

## 8. TESTING CHANGES

### 8.1 Unit Tests

**All repository tests** need updates for new schema and method signatures
**All service tests** need updates for new method signatures and business logic
**All controller tests** need updates for new request/response formats

### 8.2 Integration Tests

#### `e2e/tests/multi-team-competition.test.ts`

- Update to create users and agents instead of teams
- Update competition setup to use agents
- Update assertions to check agent-based data

#### `e2e/tests/admin.test.ts`

- Update admin operations to work with users and agents
- Update test data creation
- Update API calls and assertions

#### `e2e/tests/auth.test.ts`

- Update authentication tests for new flow
- Test both user and agent authentication
- Update session management tests

#### `e2e/tests/trading.test.ts`

- Update all trading tests to use agents
- Update test data setup
- Update API calls and assertions

#### `e2e/utils/api-client.ts`

**Methods to Update:**

- `registerTeam()` → `registerUser()` and `createAgent()`
- `deleteTeam()` → `deleteAgent()`
- Team-related methods → Agent-related methods
- Update all API calls to use new endpoints

#### `e2e/utils/api-types.ts`

- Update all type definitions
- Add new user and agent types
- Update existing types to use `agentId`

---

## 9. ADMIN MANAGEMENT SYSTEM

### 9.1 Overview

The current system stores admins as teams with `is_admin=true`, but in the new architecture, admins are conceptually different from users and agents. Admins manage the system and competitions but don't participate in trading themselves. Therefore, a separate `admins` table with dedicated authentication and management systems is the optimal approach.

### 9.2 Database Schema for Admins

#### New Admins Table

```sql
CREATE TABLE "admins" (
  "id" uuid PRIMARY KEY NOT NULL,
  "username" varchar(50) UNIQUE NOT NULL,
  "email" varchar(100) UNIQUE NOT NULL,
  "password_hash" varchar(255) NOT NULL,
  "api_key" varchar(400) UNIQUE, -- for programmatic access
  "name" varchar(100),
  "image_url" text,
  "metadata" jsonb,
  "status" varchar(20) DEFAULT 'active' NOT NULL, -- 'active', 'suspended'
  "last_login_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
```

#### Indexes for Admins Table

```sql
CREATE INDEX "idx_admins_username" ON "admins"("username");
CREATE INDEX "idx_admins_email" ON "admins"("email");
CREATE INDEX "idx_admins_api_key" ON "admins"("api_key");
CREATE INDEX "idx_admins_status" ON "admins"("status");
```

### 9.3 Admin Data Migration Strategy

#### Migration from Teams to Admins

1. **Extract admin teams** where `is_admin=true`
2. **Create admin records**:
   - username = name (or generate if needed)
   - email = email
   - password_hash = empty (require password reset on first login)
   - api_key = existing API key (decrypted and re-encrypted with admin system)
   - created_at/updated_at = preserve from team record
3. **Remove admin teams** from teams table after migration validation

### 9.4 Repository Layer Changes

#### New Admin Repository (`admin-repository.ts`)

```typescript
// Core admin operations
- create(admin: InsertAdmin)
- findAll()
- findById(id: string)
- findByUsername(username: string)
- findByEmail(email: string)
- findByApiKey(apiKey: string)
- update(admin: PartialExcept<InsertAdmin, "id">)
- delete(id: string)
- setApiKey(id: string, apiKey: string)
- updateLastLogin(id: string)
- updatePassword(id: string, passwordHash: string)
- searchAdmins(searchParams: AdminSearchParams)
```

#### Remove Admin Logic from Team Repository

- Remove `is_admin` related queries and methods
- Update team creation to not handle admin accounts
- Simplify team management operations

### 9.5 Service Layer Changes

#### New Admin Manager Service (`admin-manager.service.ts`)

```typescript
class AdminManager {
  // Admin registration and management
  - setupInitialAdmin(username: string, password: string, email: string)
  - createAdmin(adminData: CreateAdminRequest)
  - getAdmin(adminId: string)
  - getAllAdmins()
  - updateAdmin(admin: UpdateAdminRequest)
  - deleteAdmin(adminId: string)

  // Authentication services
  - authenticatePassword(username: string, password: string): Promise<string | null>
  - validateApiKey(apiKey: string): Promise<string | null>
  - generateApiKey(adminId: string): Promise<string>
  - resetApiKey(adminId: string): Promise<string>

  // Password management
  - hashPassword(password: string): Promise<string>
  - updatePassword(adminId: string, newPassword: string): Promise<void>
  - validatePassword(adminId: string, password: string): Promise<boolean>
  - requirePasswordReset(adminId: string): Promise<void>

  // Session and security
  - updateLastLogin(adminId: string): Promise<void>
  - isAdminActive(adminId: string): Promise<boolean>
  - suspendAdmin(adminId: string, reason: string): Promise<void>
  - reactivateAdmin(adminId: string): Promise<void>

  // Utilities
  - encryptApiKey(apiKey: string): string
  - decryptApiKey(encryptedKey: string): string
  - searchAdmins(searchParams: AdminSearchParams)
}
```

#### Update Team Manager Service

- Remove admin-specific functionality
- Remove `isAdmin` checks and admin creation logic
- Focus purely on team/agent management

### 9.6 Middleware Layer Changes

#### Updated Admin Authentication Middleware (`admin-auth.middleware.ts`)

```typescript
export const adminAuthMiddleware = (adminManager: AdminManager) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Try API key authentication first
      const apiKey = extractApiKey(req);

      if (apiKey) {
        const adminId = await adminManager.validateApiKey(apiKey);
        if (adminId) {
          const admin = await adminManager.getAdmin(adminId);
          if (admin && admin.status === "active") {
            req.adminId = adminId;
            req.isAdmin = true;
            req.admin = {
              id: adminId,
              username: admin.username,
              email: admin.email,
            };
            await adminManager.updateLastLogin(adminId);
            return next();
          }
        }
      }

      // Try session authentication (for web interfaces)
      if (req.session?.adminId) {
        const adminId = req.session.adminId;
        const admin = await adminManager.getAdmin(adminId);
        if (admin && admin.status === "active") {
          req.adminId = adminId;
          req.isAdmin = true;
          req.admin = {
            id: adminId,
            username: admin.username,
            email: admin.email,
          };
          return next();
        }
      }

      throw new ApiError(401, "Admin authentication required");
    } catch (error) {
      next(error);
    }
  };
};
```

#### Remove Admin Logic from Regular Auth Middleware

- `auth.middleware.ts` should only handle user/agent authentication
- Remove team-based admin checks
- Simplify to focus on agent API key validation

### 9.7 Controller Layer Changes

#### Updated Admin Controller (`admin.controller.ts`)

**Setup Method Updates:**

```typescript
async setupAdmin(req: Request, res: Response, next: NextFunction) {
  // Check if any admin exists
  const admins = await adminManager.getAllAdmins();
  if (admins.length > 0) {
    throw new ApiError(403, "Admin setup not allowed - admin already exists");
  }

  // Create admin in admins table instead of teams table
  const { username, password, email } = req.body;
  const adminId = await adminManager.setupInitialAdmin(username, password, email);

  // Generate API key for programmatic access
  const apiKey = await adminManager.generateApiKey(adminId);

  // Return admin info with API key
  res.status(201).json({
    success: true,
    message: "Admin account created successfully",
    admin: { id: adminId, username, email, apiKey }
  });
}
```

**User/Agent Management Updates:**

```typescript
// Change from team-centric to user/agent-centric operations
async registerUser(req: Request, res: Response, next: NextFunction) {
  // Create user and agent instead of team
  const user = await userManager.createUser(userData);
  const agent = await agentManager.createAgent(user.id, agentData);
  // Return both user and agent information
}

async deleteAgent(req: Request, res: Response, next: NextFunction) {
  // Delete agent instead of team
  const { agentId } = req.params;
  await agentManager.deleteAgent(agentId);
}

// Update all other methods to work with agents instead of teams
```

**New Admin Management Methods:**

```typescript
async getAdminProfile(req: Request, res: Response, next: NextFunction) {
  const admin = await adminManager.getAdmin(req.adminId!);
  res.json({ success: true, admin });
}

async updateAdminProfile(req: Request, res: Response, next: NextFunction) {
  const updates = req.body;
  await adminManager.updateAdmin({ id: req.adminId!, ...updates });
  res.json({ success: true });
}

async changeAdminPassword(req: Request, res: Response, next: NextFunction) {
  const { currentPassword, newPassword } = req.body;
  const isValid = await adminManager.validatePassword(req.adminId!, currentPassword);
  if (!isValid) throw new ApiError(400, "Invalid current password");

  await adminManager.updatePassword(req.adminId!, newPassword);
  res.json({ success: true });
}

async resetAdminApiKey(req: Request, res: Response, next: NextFunction) {
  const newApiKey = await adminManager.resetApiKey(req.adminId!);
  res.json({ success: true, apiKey: newApiKey });
}
```

### 9.8 Route Layer Changes

#### Admin Setup Routes (`admin-setup.routes.ts`)

**No URL changes required, but update implementation:**

- Use `AdminManager` instead of `TeamManager`
- Create admin in `admins` table
- Generate proper admin API key

#### Admin Management Routes (`admin.routes.ts`)

**Update existing routes for new terminology:**

```typescript
// Change from teams to users/agents
POST   /api/admin/users/register     // was /teams/register
GET    /api/admin/agents             // list all agents
DELETE /api/admin/agents/:agentId    // was /teams/:teamId
POST   /api/admin/agents/:agentId/deactivate
POST   /api/admin/agents/:agentId/reactivate
GET    /api/admin/agents/:agentId/key
GET    /api/admin/agents/search

// New admin self-management routes
GET    /api/admin/profile
PUT    /api/admin/profile
POST   /api/admin/change-password
POST   /api/admin/reset-api-key

// User management routes
GET    /api/admin/users
POST   /api/admin/users
GET    /api/admin/users/:userId
PUT    /api/admin/users/:userId
DELETE /api/admin/users/:userId
```

### 9.9 Type Definitions Changes

#### New Admin Types

```typescript
export interface Admin {
  id: string;
  username: string;
  email: string;
  name?: string;
  imageUrl?: string;
  apiKey: string;
  metadata?: any;
  status: "active" | "suspended";
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAdminRequest {
  username: string;
  email: string;
  password: string;
  name?: string;
  imageUrl?: string;
  metadata?: any;
}

export interface UpdateAdminRequest {
  id: string;
  username?: string;
  email?: string;
  name?: string;
  imageUrl?: string;
  metadata?: any;
}

export interface AdminSearchParams {
  username?: string;
  email?: string;
  name?: string;
  status?: "active" | "suspended";
}
```

#### Express Request Updates

```typescript
declare global {
  namespace Express {
    interface Request {
      session?: IronSession<SessionData>;
      agentId?: string;
      userId?: string;
      adminId?: string; // New for admin authentication
      wallet?: string;
      isAdmin?: boolean;
      admin?: {
        // Enhanced admin info
        id: string;
        username: string;
        email: string;
      };
      competitionId?: string;
    }
  }
}

export interface SessionData {
  nonce?: string;
  siwe?: SiweMessage;
  agentId?: string;
  userId?: string;
  adminId?: string; // New for admin sessions
  wallet?: string;
}
```

### 9.10 Testing Changes

#### New Admin Tests

**Unit Tests:**

- `admin-repository.test.ts`: Test admin CRUD operations
- `admin-manager.service.test.ts`: Test admin business logic
- `admin-auth.middleware.test.ts`: Test admin authentication flows

**Integration Tests:**

- Admin setup flow testing
- Admin API key authentication
- Admin password authentication (if implemented)
- Admin self-management operations

#### Updated Existing Tests

**E2E Tests (`e2e/tests/admin.test.ts`):**

- Update admin setup to use new admin system
- Update admin operations to work with users/agents
- Test new admin self-management endpoints
- Validate admin authentication flows

**API Client Updates (`e2e/utils/api-client.ts`):**

```typescript
// New admin methods
- setupAdmin(username: string, password: string, email: string)
- loginAdmin(username: string, password: string)
- getAdminProfile()
- updateAdminProfile(updates: any)
- changeAdminPassword(currentPassword: string, newPassword: string)
- resetAdminApiKey()

// Updated user/agent methods
- registerUser(userData: any) // was registerTeam
- createAgent(ownerId: string, agentData: any)
- deleteAgent(agentId: string) // was deleteTeam
```

### 9.11 Migration Strategy for Admins

#### Phase 1: Create Admin Infrastructure

1. **Create admins table** with proper schema
2. **Implement AdminManager service** and repository
3. **Update admin authentication middleware**
4. **Create admin management endpoints**

#### Phase 2: Migrate Admin Data

- We don't care about migrating admin data

#### Phase 3: Update Admin Operations

1. **Update admin controller** to use new services
2. **Update route handlers** for user/agent management
3. **Test all admin operations** with new system
4. **Validate API compatibility**

#### Phase 4: Cleanup

1. **Remove admin logic** from team-related code
2. **Drop is_admin column** from teams table
3. **Update documentation** and OpenAPI specs
4. **Remove deprecated admin-team code**

### 9.12 Security Considerations

#### Password Security

- Use existing encryption/decryption scheme found in [team manager](src/services/team-manager.service.ts)

---

## 10. SCRIPTS AND UTILITIES

### 10.1 Existing Scripts to Update

#### `scripts/delete-team.ts`

- Update to `scripts/delete-agent.ts`
- Add option to delete users
- Update to work with new schema

#### `scripts/setup-competition.ts`

- Update to work with agents instead of teams
- Update team selection → agent selection
- Update database calls

---

## 11. MIGRATION EXECUTION PLAN

- We don't care about migrations for this task

---

## 12. IMPLEMENTATION CHECKLIST

### Phase 1: Foundation (Database & Core Services)

- [✅] Create Drizzle schema definitions
- [✅] Generate and run database migrations
- [✅] Implement user repository
- [✅] Implement agent repository
- [✅] Implement admin repository
- [✅] Update existing repositories (balance, competition, trade) to use agentId
- [✅] Update service registry to include new managers

### Phase 2: Business Logic (Services)

- [✅] Implement UserManager service
- [✅] Implement AgentManager service
- [✅] Implement AdminManager service
- [✅] Update existing services to use new repositories

### Phase 3: API Layer (Controllers & Routes)

- [✅] Update authentication middleware
- [✅] **Create new controller architecture with clear authentication boundaries**
  - [✅] Create UserController for user operations (SIWE session auth → req.userId)
    - [✅] getProfile() - Get user profile
    - [✅] updateProfile() - Update name, imageUrl only (user self-service)
    - [✅] createAgent() - Create new agent for authenticated user
    - [✅] getAgents() - List user's owned agents
    - [✅] getAgent() - Get specific agent details (with ownership validation)
  - [✅] Create AgentController for trading operations (agent API key auth → req.agentId)
    - [✅] getProfile() - Get agent profile + owner info
    - [✅] updateProfile() - Update name, description, imageUrl only (agent self-service)
    - [✅] getBalances() - Get agent's trading balances
    - [✅] getPortfolio() - Get agent's portfolio value
    - [✅] getTrades() - Get agent's trading history
    - [✅] resetApiKey() - Reset agent's API key
  - [✅] Update AdminController for user/agent management (admin API key auth → req.adminId)
    - [✅] User management: registerUser(), listAllUsers(), searchUsersAndAgents()
    - [✅] Agent management: getCompetitionSnapshots() updated for agents
    - [✅] Competition management (existing functionality) updated for agents
    - [✅] Setup admin functionality updated to use AdminManager
- [✅] **Update route structure with clear authentication boundaries**
  - [✅] Agent routes: /api/agent/\* (agent API key authentication)
  - [✅] User routes: /api/user/\* (SIWE session authentication)
  - [ ] Admin routes: /api/admin/\* (admin API key authentication)
- [✅] **Deprecate existing account controller** (replace with new controllers)
- [✅] Update OpenAPI documentation
- [ ] Add input validation schemas

### Phase 4: Permission Implementation & Validation

- [ ] **Implement authorization middleware for different permission levels**
  - [ ] Admin-only operations middleware
  - [ ] User self-service operations middleware
  - [ ] Agent owner validation middleware
- [ ] **Add field-level permission validation**
  - [ ] User profile update validation (name, imageUrl only)
  - [ ] Agent profile update validation (name, description, imageUrl only)
  - [ ] Admin operation validation (all fields allowed)
- [ ] **Update existing endpoints to respect new permission model**
  - [ ] Remove team registration from admin routes
  - [ ] Add user registration to admin routes (admin-only)
  - [ ] Add user self-service routes with limited permissions
  - [ ] Add agent self-service routes with limited permissions

### Phase 5: Testing & Validation

- [ ] Update unit tests
- [ ] Update integration tests
- [ ] Update E2E tests
- [ ] **Add permission boundary tests**
  - [ ] Test user cannot modify restricted fields
  - [ ] Test user cannot access other users' agents
  - [ ] Test admin can access all operations
  - [ ] Test proper authorization errors for unauthorized operations
- [ ] Manual testing of all endpoints

- [ ] Add transaction management for user+agent creation
      **Detailed Plan:**
  - [ ] Create user controller (`user.controller.ts`) with agent creation endpoint
    - [ ] `POST /users/me/agents` - Create new agent for authenticated user
    - [ ] Extract `userId` from authenticated session
    - [ ] Call `agentManager.createAgent(userId, name, description, metadata, imageUrl, walletAddress)`
    - [ ] Return created agent with API key to user
  - [ ] Add authentication middleware to ensure only authenticated users can create agents
  - [ ] Add route validation for agent creation parameters (name required, optional fields)
  - [ ] Update auth middleware to properly handle user sessions (not just agent API keys)
  - [ ] Test the full flow: SIWE auth → create agent → agent gets proper `ownerId` association
