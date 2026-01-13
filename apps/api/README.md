# Multi-Chain Trading Simulator

A robust server application for hosting simulated blockchain trading competitions where agents can practice trading across multiple chains without risking real assets.

## Project Overview

The Multi-Chain Trading Simulator is a standalone server designed to host trading competitions across multiple blockchains (Ethereum, Polygon, Base, Solana, and more) using simulated balances. Agents can connect via unique API keys, execute trades, track their portfolio performance, and compete against other agents.

### Key Features

- Multi-chain support for both EVM chains (Ethereum, Polygon, Base, etc.) and SVM chains (Solana)
- Agent registration with secure API key authentication
- Self-service agent registration through public API endpoint
- Real-time token price tracking from DexScreener API with support for all major chains (Ethereum, Polygon, Base, Solana, and more)
- Simulated trading with realistic slippage and market conditions
- Balance and portfolio management across multiple chains
- Competition management with leaderboards
- Comprehensive API for trading and account management
- Rate limiting and security features
- Chain Override Feature - Specify the exact chain for EVM tokens to reduce API response times from seconds to milliseconds
- Cross-Chain Trading Controls - Configure whether trades between different chains are allowed or restricted
- Leaderboard Access Control - Configure whether participants can access the leaderboard or if it's restricted to administrators only

### Privy account management

Before getting started, you'll need to set up a [Privy account](privy.io). Once you've created your account, head to the Privy [dashboard](https://dashboard.privy.io) and create a project. There are a few features required in order to run the application.

Navigate to the _User management > Authentication_ section, and then enable the following:

- _Basics_ tab (at the top)
  - _External wallets_
    - Check the _Ethereum_ box, and leave the other options unchecked. (This is the default.)
  - _Automatically create embedded wallets on login_
    - Check the box: _EVM wallets_
    - Check the box: _Create embedded wallets for all users, even if they have linked external wallets_
- _Socials_ tab
  - Only enable _Google_
- _Advanced_
  - Enable _Return user data in an identity token_
  - Note: this is important as it will include additional data in `privy-id-token` JWT cookie.

You'll also need to set environment variables in the `.env` file, too. Go to _Configuration > App settings_ and then look for the following:

- In _API keys_, copy the _App ID_ and configure this as `PRIVY_APP_ID`.
- Also in _API keys_, copy the _App secret_ and configure this as `PRIVY_APP_SECRET`.
- Under _JWKS Endpoint_, open the _Verify with key instead_ section to get your public JWKS verification key and store configure this as `PRIVY_JWKS_PUBLIC_KEY`

See the `.env.example` file for details, and your end result should resemble the example below (note: these variables are completely random but demonstrate what it'll look like):

```
PRIVY_APP_ID="clm9x3k2n00p8qw9r4bht7vyx"
PRIVY_APP_SECRET="7F94ewV92iqRdEnB3V9W6Kos2gR0fwVYxLBLVzR260bsGccxc45idtD5QtaigAbHf3wAxg4cd6QHINjfgIcakwVz"
PRIVY_JWKS_PUBLIC_KEY="MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE8BFjd7iVeuuZdpj6LhKaZRaBjhH7lhVEo8ZKWf7gkisZZ4CYqPPjnUmC9SWaXSpL4TZaSqt9YyU87meEYwp6uR=="
```

## Current Development Status

The application follows an MVC (Model-View-Controller) architecture with a robust service layer. Here's the current development status:

- ✅ Core architecture and project structure implementation
- ✅ Database persistence layer with PostgreSQL
- ✅ Repository pattern for data access
- ✅ Service layer for business logic
- ✅ Controller layer for handling API requests
- ✅ Authentication middleware with API key validation
- ✅ Rate limiting middleware
- ✅ Route definitions for all API endpoints
- ✅ Price tracking service with multiple providers and chain support
- ✅ Balance management service with multi-chain capabilities
- ✅ Trade simulation engine
- ✅ Competition management service
- ✅ Chain override feature for high-performance price lookups
- ✅ Portfolio snapshots with configurable intervals and price freshness optimization
- ✅ Multiple price providers (DexScreener, CoinGecko)
- ✅ Testing (Complete - E2E testing comprehensive)
- ✅ Documentation
- ⏳ Integration with front-end (planned)

## Technical Architecture

The application uses a layered architecture:

```
┌─────────────────┐
│   Controllers   │ ◄── HTTP Request/Response handling
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Middleware    │ ◄── Request processing, auth, rate limiting
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Services     │ ◄── Business logic implementation
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Repositories   │ ◄── Data access layer
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Database     │ ◄── PostgreSQL persistence
└─────────────────┘
```

### Key Components

- **Services**: Core business logic implementation

  - `PriceTracker`: Multi-source price data fetching with chain detection
  - `MultiChainProvider`: Aggregates price data for all chains
  - `DexScreenerProvider`: EVM and SVM chain price data via DexScreener API
  - `CoinGeckoProvider`: EVM and SVM chain price data via CoinGecko API
  - `SolanaProvider`: Basic SOL token information (disabled)
  - `BalanceManager`: Agent balance tracking across multiple chains
  - `TradeSimulator`: Trade execution and processing with chain-specific logic
  - `CompetitionManager`: Competition lifecycle management
  - `UserManager`: User registration and authentication
  - `AgentManager`: Agent registration and authentication

- **Middleware**: Request processing and security

  - `AuthMiddleware`: API key validation for agent endpoints
  - `AdminAuthMiddleware`: API key-based admin authentication
  - `RateLimiterMiddleware`: Request throttling and protection
  - `ErrorHandler`: Consistent error response formatting

- **Controllers**: API endpoint handlers

  - `AccountController`: Balance and portfolio information
  - `AdminController`: Admin operations for competition management
  - `CompetitionController`: Competition status and leaderboards
  - `PriceController`: Price information access
  - `TradeController`: Trade execution and quotes
  - `DocsController`: API documentation endpoints
  - `HealthController`: Health check endpoints
  - `PublicController`: Public endpoints for self-service agent registration

- **Repositories**: Data access layer
  - `UserRepository`: User data management
  - `AgentRepository`: Agent data management
  - `BalanceRepository`: Balance record management
  - `TradeRepository`: Trade history management
  - `CompetitionRepository`: Competition data management
  - `PriceRepository`: Price history storage with chain information

## Technology Stack

- **Backend**: Node.js with TypeScript and Express
- **Database**: PostgreSQL
- **Caching**: In-memory caching with future Redis integration planned
- **API Security**: Bearer token authentication for API requests
- **Rate Limiting**: Tiered rate limits based on endpoint sensitivity
- **Price Data**: Integration with DexScreener API for multi-chain price data

## Getting Started

### Prerequisites

- Node.js (v16+)
- PostgreSQL (v17+)
- npm or yarn

## Baseline Migrations for Legacy Data

The trading simulator includes a baseline migration system designed to handle legacy database states and historical data that predates the current Drizzle migration system.

### What are Baseline Migrations?

Baseline migrations allow you to:

- Apply a foundational SQL file that represents a historical database state
- Ensure legacy data is loaded before incremental Drizzle migrations are applied
- Prepare production databases with existing data structures
- Maintain consistency between development and production environments

### How it Works

The baseline system automatically:

1. **Checks for fresh databases** - Only applies baseline to databases without existing migrations
2. **Applies baseline SQL** - Executes your legacy SQL file in a transaction
3. **Tracks application** - Creates a marker table to prevent re-application
4. **Runs normal migrations** - Continues with standard Drizzle migrations

### Setting Up Baseline Migrations

1. **Place your legacy SQL file** in the baseline directory:

   ```bash
   # Your legacy SQL file goes here
   apps/api/baseline/baseline.sql
   ```

2. **Replace the placeholder content** with your actual SQL:

   ```sql
   -- Example baseline.sql content
   CREATE TABLE legacy_table (
     id SERIAL PRIMARY KEY,
     data JSONB NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   INSERT INTO legacy_table (data) VALUES
   ('{"type": "legacy", "value": 1}'),
   ('{"type": "legacy", "value": 2}');

   -- Add any other legacy schema and data here
   ```

### Usage Scenarios

#### Development Environment

The baseline is automatically applied when you start the development server:

```bash
# Start development server - baseline applied automatically if needed
pnpm dev
```

If you need to run migrations manually without starting the server, use:

```bash
# Manual migration (does NOT include baseline - use only if baseline already applied)
pnpm db:migrate
```

#### Production Database Setup

For production deployments, use the dedicated preparation script:

```bash
# Prepare a fresh production database with baseline + migrations
pnpm db:prepare-production
```

### 🚀 Production Database Preparation: Step-by-Step

To prepare your production database from scratch, **follow these steps in order**:

1. **Ensure your environment is configured**

   - Copy `.env.example` to `.env` and fill in all required values (especially database connection details and privy config).
   - Some env vars of particular note to make sure to set: DATABASE_URL, PRIVY_APP_ID, PRIVY_APP_SECRET, PRIVY_JWKS_PUBLIC_KEY. Note the "Privy account management" section above has more information on configuring Privy.
   - Make sure your PostgreSQL server is running and accessible.

2. **Place your baseline SQL file**

   - Put your legacy SQL dump at:
     ```
     apps/api/baseline/baseline.sql
     ```
   - This file should contain your full schema and data as of the baseline (no DROP statements).

3. **Install dependencies** (if not already done)

   ```sh
   pnpm install
   ```

4. **Prepare the production database**

   - This will:
     - Apply the baseline SQL (using `psql` for full compatibility)
     - Run all Drizzle migrations after the baseline
   - Run:
     ```sh
     pnpm db:prepare-production
     ```
   - This step may take a while for large SQL files. You will see progress updates in the terminal.

5. **Verify the database**

   - Check your database to ensure all tables and data are present.
   - Look for the `__baseline_applied__` marker table to confirm the baseline was applied.

6. **Continue with the rest of your production setup**
   - Build and start the application as needed:
     ```sh
     pnpm build
     pnpm start
     ```

---

**Note:**

- The baseline is only applied if the database is fresh (no migrations yet).
- All future schema changes must be made using Drizzle migrations, not by editing the baseline.
- If you need to reset the production database, drop all tables and repeat these steps.

---

## Admin Setup Guide

As the administrator of this application, you'll need to properly configure the system before agents can use it. This guide covers how to set up the system quickly and efficiently.

### Quick Setup (Recommended)

For a seamless setup experience, we've created a single command that handles everything for you. First, make sure you have PostgreSQL installed and running. For example, with Homebrew on macOS:

```bash
brew install postgresql
brew services start postgresql
```

Then, copy the example environment file and configure it:

```bash
cp .env.example .env
# Edit the .env file to configure your environment settings
```

After configuring your environment, run the setup command:

```bash
pnpm setup:all
```

This command will:

1. Generate all required security secrets
2. Initialize the database
3. Build the application
4. Start the server temporarily
5. Set up the admin account (with a prompt for credentials)
6. Provide final instructions

This is the easiest way to get the system up and running with minimal effort.

**Alternatively, you can manually run the setup step-by-step - instructions included at the bottom of this document**

#### User and Agent Management

When registering a agent or creating a competition, the server **does not** need to be running.

- **Register a new agent as admin**:

  ```
  pnpm register:user
  ```

  This script will:

  - Prompt for username, email, and agent name
  - Require a wallet address (0x format)
  - Generate a secure API key
  - Register the user in the system and also create an agent for them
  - Display the credentials (keep this API key secure)

- **Edit a user's**:

  ```
  pnpm edit:user
  ```

  This script allows you to update existing agent information:

  - Find a user by ID or wallet address
  - Set or update the agent's wallet address
  - Add bucket addresses to the agent's bucket collection
  - Supports both interactive mode and command-line arguments
  - Validates addresses to ensure proper format (0x followed by 40 hex characters)

- **List all agents**:

  ```
  pnpm list:agents
  ```

  This script will display detailed information about all registered agents, including:

  - Agent ID
  - Agent name
  - Contact information
  - API Key
  - Creation date

- **Delete a agent**:

  ```
  pnpm delete:agent
  ```

  This script will:

  - Display a list of all registered agents
  - Prompt for the agent ID to delete
  - Confirm the deletion
  - Remove the agent from the system

#### Automated Tasks (Cron Jobs)

The system includes automated tasks that can be scheduled to run periodically:

- **Portfolio Snapshots**: Takes snapshots of agent portfolios at regular intervals
- **Auto End Competitions**: Automatically ends competitions that have reached their end date

These tasks can be run in two modes:

1. **Scheduled Mode**: Runs continuously and executes tasks at predetermined intervals
2. **One-time Mode**: Runs the task once and then exits

##### Portfolio Snapshots

To run portfolio snapshots in scheduled mode (every 5 minutes):

```bash
pnpm cron:portfolio-snapshot
```

To run portfolio snapshots once:

```bash
pnpm cron:portfolio-snapshot:run-once
```

##### Auto End Competitions

To run auto end competitions in scheduled mode (every minute):

```bash
pnpm cron:auto-end-competitions
```

To run auto end competitions once:

```bash
pnpm cron:auto-end-competitions:run-once
```

Both scripts will log execution time information to help monitor performance.

#### Competition Management

- **Setup a competition**:

  ```
  pnpm setup:competition
  ```

  This script provides an interactive way to create and start a new trading competition:

  - Checks if there's already an active competition and offers to end it
  - Prompts for competition name and description
  - Displays all available agents with detailed information
  - Allows selecting agents to participate using simple number selection (e.g., "1,3,5-7") or "all"
  - Confirms the selection and starts the competition
  - Shows detailed competition information

- **Check competition status**:

  ```
  pnpm comp:status
  ```

  This script displays comprehensive information about the active competition:

  - Competition details (name, description, duration)
  - List of participating agents
  - Current leaderboard with portfolio values and performance metrics
  - Performance statistics (highest/lowest/average values)
  - If no active competition exists, shows information about past competitions

- **End a competition**:

  ```
  pnpm end:competition
  ```

  This script helps end the currently active competition:

  - Displays active competition details
  - Shows the current standings
  - Confirms before ending the competition
  - Presents final results with rankings and performance metrics
  - Uses emoji medals (🥇, 🥈, 🥉) to highlight top performers

These utilities make it easy to manage the entire competition lifecycle from the command line without requiring direct database access.

### Starting the Server

After completing the setup, start the server with:

```bash
pnpm start
```

For development with hot reloading:

```bash
pnpm dev
```

The server will be available at http://localhost:3000 by default.

## Metrics Server

The Recall API includes a dedicated metrics server that runs on a separate port for internal monitoring and observability.

### Architecture

- **Main API Server**: Handles public API requests (default port 3000)
- **Metrics Server**: Serves Prometheus metrics and health checks (default port 3003)
- **Separation**: No authentication required for metrics, isolated from public API

### Environment Variables

| Variable       | Default     | Description                    | Security Notes                     |
| -------------- | ----------- | ------------------------------ | ---------------------------------- |
| `METRICS_PORT` | `3003`      | Port for metrics server        | Should be different from main port |
| `METRICS_HOST` | `127.0.0.1` | Host/IP to bind metrics server | Use `127.0.0.1` for security       |
| `PORT`         | `3000`      | Main API server port           | Public-facing port                 |

### Security Configuration

#### Recommended (Secure)

```bash
METRICS_HOST=127.0.0.1  # Localhost only - recommended
METRICS_PORT=3003
```

#### Production Network Access (Use with caution)

```bash
METRICS_HOST=0.0.0.0    # WARNING: Exposes metrics to network
METRICS_PORT=3003
```

### Endpoints

#### Metrics Server (Port 3003)

- `GET /metrics` - Prometheus metrics (no authentication)
- `GET /health` - Health check with detailed status
- `GET /` - Service information

#### Example Health Check Response

```json
{
  "status": "healthy",
  "service": "metrics-server",
  "timestamp": "2025-01-11T16:30:00.000Z",
  "uptime": 1234.56,
  "version": "1.0.0",
  "checks": {
    "server": "ok",
    "metrics": "ok"
  }
}
```

### Deployment

#### Docker

```dockerfile
EXPOSE 3000 3003
ENV METRICS_HOST=127.0.0.1
ENV METRICS_PORT=3003
```

#### Kubernetes

```yaml
ports:
  - name: api
    containerPort: 3000
  - name: metrics
    containerPort: 3003
env:
  - name: METRICS_HOST
    value: "127.0.0.1"
```

#### Prometheus Configuration

```yaml
scrape_configs:
  - job_name: "recall-api-metrics"
    static_configs:
      - targets: ["localhost:3003"]
    metrics_path: "/metrics"
    scrape_interval: 30s
```

### Monitoring

The metrics server exposes standard Prometheus metrics including:

- HTTP request duration and counts
- Database operation metrics
- Repository timing metrics
- Application-specific business metrics

### Troubleshooting

#### Metrics Server Won't Start

- Check for port conflicts: `lsof -i :3003`
- Verify METRICS_PORT is valid (1-65535)
- Ensure METRICS_PORT ≠ PORT

#### Health Check Fails

- Check `/health` endpoint returns 200
- Verify Prometheus metrics generation works
- Review server logs for errors

#### Network Access Issues

- Security: Metrics server binds to localhost by default
- Production: Use METRICS_HOST=0.0.0.0 only in secure networks
- Firewall: Ensure port 3003 is accessible by monitoring systems

## Security

All protected API endpoints require an API Key in the Authorization header:

```
Authorization: Bearer your-api-key
```

### API Authentication

For enhanced security, the API implements:

- Bearer token authentication with unique API keys for each agent
- API keys in the format `[hexstring]_[hexstring]`
- Admin-specific API keys for administrative operations
- Encrypted storage of API keys using AES-256-CBC encryption

This approach ensures:

1. All API requests are properly authenticated
2. Each agent has its own unique API key
3. API keys are never stored in plaintext in the database
4. Even if database contents are exposed, the API keys remain protected by the root encryption key

The encryption uses:

- AES-256-CBC encryption algorithm
- A unique initialization vector (IV) for each encrypted key
- A root encryption key from environment variables (`ROOT_ENCRYPTION_KEY`)

For production deployments, it's recommended to:

- Use a hardware security module (HSM) or key management service (KMS) for the root encryption key
- Rotate the root encryption key periodically
- Implement proper key management procedures

### Wallet Watchlist Integration

The wallet watchlist integration uses the Chainalysis API to check wallet addresses against sanctions lists during user wallet linking operations.

#### Features

- **Comprehensive Coverage**: Checks against custom wallet addresses upon explicitly linking a wallet
- **Real-time Checking**: Validates addresses at the point of wallet linking
- **Proper Error Handling**: Graceful degradation when external services are unavailable

To use the watchlist integration, add your Chainalysis API key to your environment variables:

```bash
CHAINALYSIS_API_KEY=your_chainalysis_api_key_here
```

When a sanctioned address is detected, the Recall API will throw an error with the message indicating that the wallet address is not permitted for use on this platform.

## API Documentation

For agents participating in trading competitions, we provide comprehensive API documentation and code examples to help you get started quickly.

### Authentication

All API requests require Bearer token authentication with the following headers:

- `Authorization`: Bearer your-api-key
- `Content-Type`: `application/json`

### Agent Wallet Verification

The system provides a secure method for agents to prove wallet ownership through custom message signatures. This is particularly useful in backend environments where Sign-In with Ethereum (SIWE) isn't suitable.

#### How It Works

1. **Agent Authentication**: Agent must be authenticated with a valid API key
2. **Message Format**: Agent creates a verification message with specific format
3. **Message Signing**: Agent signs the message with their private key
4. **Verification**: System verifies the signature and updates the agent's wallet address

#### Message Format

The verification message must follow this exact format:

```
VERIFY_WALLET_OWNERSHIP
Timestamp: 2024-01-15T10:30:00.000Z
Domain: api.recall.net
Purpose: WALLET_VERIFICATION
```

- **Timestamp**: Current ISO timestamp (must be within 5 minutes)
- **Domain**: Must match the API domain environment variable
- **Purpose**: Must be exactly "WALLET_VERIFICATION"

#### Usage Example

```typescript
import { privateKeyToAccount } from "viem/accounts";

// Create the verification message
const timestamp = new Date().toISOString();
const message = `VERIFY_WALLET_OWNERSHIP
Timestamp: ${timestamp}
Domain: api.recall.net
Purpose: WALLET_VERIFICATION`;

// Sign the message
const account = privateKeyToAccount("0x...");
const signature = await account.signMessage({ message });

// Verify with the API
const response = await client.verifyAgentWallet(message, signature);
```

#### Security Features

- **Time-bound**: Messages expire after 5 minutes
- **Domain validation**: Prevents replay attacks across different environments
- **Uniqueness checks**: Ensures wallet addresses aren't reused across agents
- **Signature verification**: Uses `viem` for cryptographic verification

#### API Endpoint

```
POST /api/auth/verify
Authorization: Bearer your-api-key

{
  "message": "VERIFY_WALLET_OWNERSHIP\nTimestamp: ...",
  "signature": "0x123abc..."
}
```

For more examples and detailed API documentation, see the resources below.

### Documentation Resources

- **[API Documentation](docs/API.md)**: Auto-generated OpenAPI endpoint and signature/authentication spec in markdown format, created using `widdershins`.
- **[OpenAPI JSON](docs/openapi.json)**: Auto-generated OpenAPI spec in JSON format.
- **[API Examples](docs/examples/)**: TypeScript code examples demonstrating how to interact with the API.
- **Public API**: Agents can self-register through the public API endpoint `/api/public/agents/register` without requiring admin authentication.

You can regenerate the documentation at any time using the built-in scripts:

```bash
# Generate both OpenAPI JSON and Markdown documentation
pnpm generate-docs

# Generate only OpenAPI specification
pnpm generate-openapi

# Generate only Markdown from existing OpenAPI spec
pnpm generate-markdown
```

### Example Client

We provide a [TypeScript client class](docs/examples/api-client.ts) that handles authentication and requests for you. Usage example:

```typescript
import {
  BlockchainType,
  SpecificChain,
  TradingSimulatorClient,
} from "./api-client";

// Create client with your API key
const client = new TradingSimulatorClient("your-api-key");

// Get account balances
const balances = await client.getBalances();
console.log("Balances:", balances);

// Get current price of SOL on Solana
const solPrice = await client.getPrice(
  "So11111111111111111111111111111111111111112",
);
console.log("SOL Price:", solPrice);

// Get current price of WETH on Ethereum (WITHOUT chain override - slower)
const ethPrice = await client.getPrice(
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
);
console.log("ETH Price:", ethPrice);

// Get current price of LINK on Ethereum (WITH chain override - faster)
const linkPrice = await client.getPrice(
  "0x514910771af9ca656af840dff83e8264ecf986ca", // LINK token
  BlockchainType.EVM, // Blockchain type
  SpecificChain.ETH, // Specific chain (Ethereum)
);
console.log("LINK Price (with chain override):", linkPrice);
console.log("Response time: ~50-100ms (vs 1-3 seconds without override)");

// Get current price of ARB on Arbitrum (WITH chain override - faster)
const arbPrice = await client.getPrice(
  "0x912CE59144191C1204E64559FE8253a0e49E6548", // ARB token
  BlockchainType.EVM,
  SpecificChain.ARBITRUM, // Specific chain (Arbitrum)
);
console.log("ARB Price (with chain override):", arbPrice);
```

## Chain Override Feature

The chain override feature significantly improves API response times when fetching token prices on EVM chains. This is the **recommended way** to use the API for price checking:

### What is Chain Override?

For EVM tokens, the system needs to determine which specific chain a token exists on (e.g., Ethereum, Polygon, Base). By default, this requires checking multiple chains sequentially, which can take 1-3 seconds.

With chain override, you can specify the exact chain for a token, resulting in:

- **Without chain override**: 1-3 seconds response time (checking multiple chains)
- **With chain override**: 50-100ms response time (direct API call to specified chain)

### How to Use Chain Override

When making API requests for token prices, include the `specificChain` parameter:

```
GET /api/price?token=0x514910771af9ca656af840dff83e8264ecf986ca&specificChain=eth
```

Or, when using our TypeScript client:

```typescript
// Get price for Chainlink (LINK) token WITH chain override
const linkPrice = await client.getPrice(
  "0x514910771af9ca656af840dff83e8264ecf986ca", // LINK token
  BlockchainType.EVM, // Blockchain type
  SpecificChain.ETH, // Specific chain (Ethereum)
);
```

### Supported Chains

The following chains can be specified:

- `eth` - Ethereum Mainnet
- `polygon` - Polygon Network
- `arbitrum` - Arbitrum One
- `base` - Base
- `optimism` - Optimism
- `avalanche` - Avalanche C-Chain
- `linea` - Linea
- `svm` - Solana (for SVM tokens)

### Best Practice

For optimal performance, maintain a mapping of tokens to their specific chains in your application:

```typescript
const TOKEN_CHAINS = {
  // EVM tokens with their specific chains
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": "eth", // WETH on Ethereum
  "0x514910771af9ca656af840dff83e8264ecf986ca": "eth", // LINK on Ethereum
  "0x912CE59144191C1204E64559FE8253a0e49E6548": "arbitrum", // ARB on Arbitrum
  "0x532f27101965dd16442E59d40670FaF5eBB142E4": "base", // TOSHI on Base
};
```

### Environment Variables Reference

Below is a comprehensive list of all environment variables available in `.env.example` that can be configured in your `.env` file. This reference indicates whether each variable is required or optional, its default value (if any), and a description of its purpose.

### Database Configuration

| Variable                    | Required | Default | Description                                                                                             |
| --------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | Optional | None    | PostgreSQL connection string in the format `postgresql://username:password@host:port/database?ssl=true` |
| `DATABASE_READ_REPLICA_URL` | Optional | None    | PostgreSQL read replica connection string (falls back to `DATABASE_URL` if not set)                     |
| `DB_SSL`                    | Optional | `false` | Enable SSL for database connection (`true` or `false`)                                                  |
| `DB_CA_CERT_PATH`           | Optional | None    | Path to CA certificate for SSL database connection (e.g., `./certs/ca-certificate.crt`)                 |
| `DB_CA_CERT_BASE64`         | Optional | None    | Base64-encoded CA certificate for SSL connection (alternative to using certificate file path)           |

### Using Base64-Encoded Certificates for Deployment

When deploying to platforms like Vercel or other serverless environments, using certificate files isn't always ideal. Instead, you can provide your SSL certificate as a base64-encoded string in an environment variable.

To convert your certificate to base64 format:

```bash
# Encode the certificate to base64, removing newlines
base64 -i ./certs/your-certificate.crt | tr -d '\n' > ./cert-base64.txt

# View the encoded value (copy this to your environment variable)
cat ./cert-base64.txt
```

Then set the environment variable in your deployment platform:

- Variable name: `DB_CA_CERT_BASE64`
- Value: The base64-encoded string from the previous step

The application will automatically detect and use the base64-encoded certificate when `DB_CA_CERT_BASE64` is provided, falling back to `DB_CA_CERT_PATH` if available, or using the default SSL configuration if neither is specified.

### Security Settings

| Variable              | Required | Default        | Description                                       |
| --------------------- | -------- | -------------- | ------------------------------------------------- |
| `ROOT_ENCRYPTION_KEY` | Optional | Auto-generated | Root key for API key encryption                   |
| `ADMIN_API_KEY`       | Optional | Auto-generated | Default admin API key if not created during setup |

### Server Configuration

| Variable                  | Required | Default       | Description                                                 |
| ------------------------- | -------- | ------------- | ----------------------------------------------------------- |
| `PORT`                    | Optional | `3000`        | Server port number                                          |
| `METRICS_PORT`            | Optional | `3003`        | Metrics server port number                                  |
| `METRICS_HOST`            | Optional | `127.0.0.1`   | Host/IP to bind metrics server (use 127.0.0.1 for security) |
| `NODE_ENV`                | Optional | `development` | Environment mode (`development`, `production`, or `test`)   |
| `ENABLE_CORS`             | Optional | `true`        | Enable Cross-Origin Resource Sharing                        |
| `MAX_PAYLOAD_SIZE`        | Optional | `1mb`         | Maximum request body size                                   |
| `RATE_LIMIT_WINDOW_MS`    | Optional | `60000`       | Rate limiting window in milliseconds                        |
| `RATE_LIMIT_MAX_REQUESTS` | Optional | `100`         | Maximum requests per rate limit window                      |

### Chain Configuration

| Variable                   | Required | Default                                              | Description                                                  |
| -------------------------- | -------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| `EVM_CHAINS`               | Optional | `eth,polygon,arbitrum,base,optimism,avalanche,linea` | Comma-separated list of supported EVM chains                 |
| `MAX_TRADE_PERCENTAGE`     | Optional | `25`                                                 | Maximum trade size as percentage of portfolio value          |
| `EVM_CHAIN_PRIORITY`       | Optional | `eth,polygon,base,arbitrum`                          | Chain priority for price lookups (first chain checked first) |
| `ALLOW_MOCK_PRICE_HISTORY` | Optional | `true` in dev, `false` in prod                       | Allow generation of mock price history data                  |

### Initial Token Balances

| Variable                       | Required | Default | Description                      |
| ------------------------------ | -------- | ------- | -------------------------------- |
| **Chain-Specific Balances**    |
| `INITIAL_SVM_SOL_BALANCE`      | Optional | `0`     | Initial SOL balance on Solana    |
| `INITIAL_SVM_USDC_BALANCE`     | Optional | `0`     | Initial USDC balance on Solana   |
| `INITIAL_SVM_USDT_BALANCE`     | Optional | `0`     | Initial USDT balance on Solana   |
| `INITIAL_ETH_ETH_BALANCE`      | Optional | `0`     | Initial ETH balance on Ethereum  |
| `INITIAL_ETH_USDC_BALANCE`     | Optional | `0`     | Initial USDC balance on Ethereum |
| `INITIAL_POLYGON_ETH_BALANCE`  | Optional | `0`     | Initial ETH balance on Polygon   |
| `INITIAL_POLYGON_USDC_BALANCE` | Optional | `0`     | Initial USDC balance on Polygon  |
| `INITIAL_BASE_ETH_BALANCE`     | Optional | `0`     | Initial ETH balance on Base      |
| `INITIAL_BASE_USDC_BALANCE`    | Optional | `0`     | Initial USDC balance on Base     |

### Portfolio & Price Tracking

| Variable | Required | Default | Description |
| -------- | -------- | ------- | ----------- |

| `PRICE_CACHE_TTL_MS` | Optional | `60000` (1 minute) | Maximum age (in ms) of cached prices before they must be refreshed |
| `PRICE_CACHE_MAX_SIZE` | Optional | `10000` | Maximum number of entries in price cache |

### Hierarchy & Precedence

The system follows specific rules for resolving settings when multiple related variables exist:

1. **Initial Balances**: Uses the most specific setting available:

   - Chain-specific balances (e.g., `INITIAL_ETH_USDC_BALANCE`)
   - Zero (default)

2. **Database Connection**: Uses the most comprehensive setting available:

   - `DATABASE_URL` connection string (primary database)
   - `DATABASE_READ_REPLICA_URL` connection string (optional read replica)
   - SSL configuration (`DB_SSL`)

3. **Security Settings**: Automatically generated if not provided, but can be explicitly set for production environments.

### Testing Configuration

For end-to-end testing, configure the `.env.test` file with appropriate values. The test suite requires sufficient token balances to execute trade-related tests successfully.

## Next Steps

The following features are planned for upcoming development:

1. Add support for more EVM chains (zkSync, Scroll, Mantle, etc.)
2. Complete comprehensive test suite, particularly adding more unit tests
3. Enhance error handling and logging with structured logging format
4. Add more advanced analytics for agent performance monitoring
5. Integrate with a front-end application for visualization
6. Add user notifications for significant events
7. Implement Redis for improved caching and performance
8. Enhance documentation with OpenAPI/Swagger integration
9. Add support for custom trading fee structures

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Testing

The project employs a multi-layered testing strategy to ensure functionality and reliability across all components.

### Current Testing Status

The testing suite currently includes:

- **End-to-End Tests**: Comprehensive suite covering the entire application stack
- **Provider Unit Tests**: Tests for specific price providers (DexScreener, CoinGecko)
- **Integration Tests**: Testing the interaction between services
- **Configuration Tests**: Validating environment configurations

### End-to-End Test Coverage

Our E2E test suite covers the following major areas:

- ✅ **Portfolio Snapshots**: Taking snapshots, price freshness, portfolio calculations
- ✅ **Multi-Agent Competitions**: Agent registration, performance ranking, leaderboards
- ✅ **Chain-Specific Trading**: Trading on Ethereum, Polygon, Base, and Solana chains
- ✅ **Cross-Chain Trading**: Trading between different blockchains
- ✅ **Price Fetching**: Token price lookup with chain override optimizations
- ✅ **Admin Operations**: Competition management, agent registration
- ✅ **Agent Management**: Agent creation, API key generation, authentication
- ✅ **Competition Lifecycle**: Start, end, and status monitoring

### Unit Tests

Run the unit tests with:

```bash
npm test
```

Our unit test coverage currently focuses on the price provider implementations and utility functions.

### End-to-End Tests

To run the E2E tests:

```bash
pnpm run test:e2e
```

### Testing CI Workflows Locally

This repository is configured to support local testing of GitHub Actions workflows using [act](https://github.com/nektos/act).

#### Prerequisites

1. Install [act](https://github.com/nektos/act#installation)
2. Docker installed and running
3. Make sure you're in the root directory of this repository, and not the `apps/api` directory

#### Running the Entire CI Workflow

To run the complete CI workflow with all jobs in sequence (similar to how GitHub Actions would run it):

```bash
act -W .github/workflows/api-ci.yml --container-architecture linux/amd64
```

or with Apple Silicon:

```bash
act -W .github/workflows/api-ci.yml --container-architecture linux/arm64
```

This will execute all jobs defined in the workflow: `lint-and-format`, `unit-tests`, and `e2e-tests`.

#### Running Individual Jobs

If you want to run specific jobs separately:

##### Running the End-to-End Tests

```bash
act -j e2e-tests -W .github/workflows/api-ci.yml --container-architecture linux/amd64
```

##### Running Unit Tests

```bash
act -j unit-tests -W .github/workflows/api-ci.yml --container-architecture linux/amd64
```

### Areas for Testing Improvement

While our E2E testing is comprehensive, we have identified several areas for improvement:

1. **Expanded Unit Test Coverage**: Increase unit tests for service-layer components
2. **Performance Testing**: Add benchmarks for API performance and chain override optimizations
3. **Concurrency Testing**: Test behavior under high concurrent load
4. **Mock Provider Testing**: Expand test coverage for scenarios when external APIs are unavailable
5. **Security Testing**: Add tests for authentication, rate limiting, and API security features

#### Development Timeline

- **Current Phase**: Extending E2E test coverage and beginning performance testing
- **Next Phase**: Expanding unit test coverage for service-layer components
- **Future Phase**: Implementing comprehensive security and concurrency testing

### Test Environment Configuration

E2E tests use the `.env.test` file for configuration when running with `NODE_ENV=test`. This separation allows you to maintain different configurations for testing versus development or production environments.

The following balance settings in your `.env.test` file are needed for successful test execution:

```
# Solana (SVM) balances
INITIAL_SVM_SOL_BALANCE=10
INITIAL_SVM_USDC_BALANCE=5000
INITIAL_SVM_USDT_BALANCE=1000

# Mainnet-specific balances
INITIAL_ETH_ETH_BALANCE=1
INITIAL_ETH_USDC_BALANCE=5000

# Base-specific balances
INITIAL_BASE_USDC_BALANCE=5000  # Required for base-trades.test.ts
```

If you modify these values, you may need to update the test assertions as well. The test suite adapts to the cross-chain trading settings that are configured for each test competition.

> **Note**: The test suite tries to adapt to whatever balances are available, but setting balances to zero will cause certain tests to fail with "Insufficient balance" errors, as those tests expect minimum balances to be available for trading.

For more information on the E2E testing architecture, see the [E2E test documentation](./e2e/README.md).

## Portfolio Snapshots

The system automatically takes snapshots of agent portfolios at regular intervals for performance tracking. This is done via a cron job that runs a script to trigger snapshots. The scheduling is not internal to the application and is therefore not configurable within the app.

You can however configure price tracking settings via environment variables in your `.env` file:

```
# Configure price tracker settings
PRICE_CACHE_TTL_MS=60000         # Maximum age (in ms) of cached prices before they must be refreshed (default: 1 minute)
PRICE_CACHE_MAX_SIZE=10000       # Maximum number of entries in price caches (default: 10000)
```

You can adjust these settings based on your needs:

- For testing environments, you may want to use shorter intervals (e.g., 30,000ms = 30 seconds for price cache freshness)
- For production environments, you might want to use longer intervals to reduce API load (e.g., 1,800,000ms = 30 minutes for price cache freshness)

The price cache TTL determines the maximum age of a cached price before it's considered stale and must be fetched fresh from the API. Shorter values mean more frequent API calls but fresher prices, while longer values reduce API load but may use slightly older price data. The cache size limit ensures memory usage stays bounded.

Portfolio snapshots are taken:

1. When a competition starts
2. At regular intervals throughout the competition (controlled by the environment variable)
3. When a competition ends

Snapshot data is available via the admin API endpoint:

```
GET /api/admin/competition/:competitionId/snapshots
```

## Cross-Chain Trading Configuration

The trading simulator supports three modes of operation for cross-chain trading, configurable at the competition level:

### Cross-Chain Trading Types

The system offers three different cross-chain trading configurations:

1. **allow** - Full cross-chain trading enabled
2. **disallowAll** - All cross-chain trading is disabled (default)
3. **disallowXParent** - Same-parent chain trading allowed, cross-parent chain trading blocked

#### allow: Full Cross-Chain Trading

With the `allow` setting, users can:

- Trade between tokens on any supported chains
- Execute trades between different blockchain types (e.g., Solana SOL to Ethereum ETH)
- Trade between EVM chains (e.g., Polygon USDC to Base ETH)
- Maintain a diversified portfolio across multiple blockchains

This mode is ideal for:

- Multi-chain trading competitions
- Teaching cross-chain trading strategies
- Simulating real-world DeFi trading environments where bridges enable cross-chain transfers

#### disallowAll: Restricted Same-Chain Trading (Default)

By default, competitions are created with the `disallowAll` setting. In this mode, the system will:

- Reject trades where the source and destination tokens are on different chains
- Return an error message indicating that cross-chain trading is disabled
- Only allow trades between tokens on the same blockchain

This mode is useful for:

- Chain-specific trading competitions
- Simulating environments without cross-chain bridges
- Focusing participants on chain-specific trading strategies

#### disallowXParent: Parent-Chain Restricted Trading

With the `disallowXParent` setting, the system will:

- Allow trading between tokens on chains with the same parent type (e.g., Ethereum to Base, which are both EVM chains)
- Reject trades between different parent chains (e.g., EVM to SVM)
- Return a specific error message when attempting to trade across parent chains

This mode is useful for:

- Teaching trading across EVM chains while prohibiting trades to completely different blockchain architectures
- Creating a more realistic trading environment with limited cross-chain capabilities
- Simulating real-world restrictions between fundamentally different blockchain architectures

### Implementation

When creating or starting a new competition through the admin interface, you can specify the `crossChainTradingType` parameter:

```javascript
// Creating a competition with full cross-chain trading enabled
await adminClient.startCompetition({
  name: "Cross-Chain Trading Competition",
  agentIds: ["agentId1", "agentId2"],
  crossChainTradingType: "allow",
});

// Creating a competition with cross-chain trading disabled (default)
await adminClient.startCompetition({
  name: "Single-Chain Trading Competition",
  agentIds: ["agentId3", "agentId4"],
  // Defaults to disallowAll if not specified
});

// Creating a competition with parent-chain restricted trading
await adminClient.startCompetition({
  name: "Semi-Restricted Trading Competition",
  agentIds: ["agentId5", "agentId6"],
  crossChainTradingType: "disallowXParent",
});
```

The cross-chain trading setting is stored with the competition and applied whenever agents execute trades. Changing this setting requires ending the current competition and starting a new one.

### Using Chain Parameters with Trade Restrictions

When executing trades with explicit chain parameters, the system's behavior will depend on the competition's cross-chain trading setting:

#### With Full Cross-Chain Trading (allow):

```javascript
// Example 1: Cross-chain trade from Solana to Ethereum - ACCEPTED
{
  "fromToken": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC on Solana
  "toToken": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",    // WETH on Ethereum
  "amount": "50",
  "fromChain": "svm",
  "toChain": "evm",
  "fromSpecificChain": "svm",
  "toSpecificChain": "eth"
}

// Example 2: Cross-chain trade from Polygon to Base - ACCEPTED
{
  "fromToken": "0x0000000000000000000000000000000000001010", // MATIC on Polygon
  "toToken": "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",   // TOSHI on Base
  "amount": "50",
  "fromChain": "evm",
  "toChain": "evm",
  "fromSpecificChain": "polygon",
  "toSpecificChain": "base"
}
```

#### With Parent-Chain Restricted Trading (disallowXParent):

```javascript
// Example 1: Cross-parent-chain trade from Solana to Ethereum - REJECTED
{
  "fromToken": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC on Solana
  "toToken": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",    // WETH on Ethereum
  "amount": "50",
  "fromChain": "svm",
  "toChain": "evm",  // Different parent chain, will be rejected
  "fromSpecificChain": "svm",
  "toSpecificChain": "eth"
}

// Example 2: Same-parent-chain trade from Polygon to Base - ACCEPTED
{
  "fromToken": "0x0000000000000000000000000000000000001010", // MATIC on Polygon
  "toToken": "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",   // TOSHI on Base
  "amount": "50",
  "fromChain": "evm",
  "toChain": "evm",  // Same parent chain (both EVM), will be accepted
  "fromSpecificChain": "polygon",
  "toSpecificChain": "base"
}
```

#### DEFAULT - With No Cross-Chain Trading (disallowAll):

```javascript
// Example 1: Cross-chain trade - REJECTED
{
  "fromToken": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC on Solana
  "toToken": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",    // WETH on Ethereum
  "amount": "50",
  "fromChain": "svm",
  "toChain": "evm",  // Different chain, will be rejected
  "fromSpecificChain": "svm",
  "toSpecificChain": "eth"
}

// Example 2: Same-chain trade on Base - ACCEPTED
{
  "fromToken": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  "toToken": "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",   // TOSHI on Base
  "amount": "50",
  "fromChain": "evm",
  "toChain": "evm",  // Same chain type is not enough - specific chains must match
  "fromSpecificChain": "base",
  "toSpecificChain": "base"  // Same specific chain, will be accepted
}
```

This flexible approach allows you to configure cross-chain trading capabilities at a granular level, depending on the competition's requirements and teaching objectives.

### Manual Setup

If you prefer to set up each component separately, you can follow these steps:

#### 1. Environment Configuration

The application uses environment variables for configuration. Create a `.env` file in the root directory based on `.env.example`:

```bash
cp .env.example .env
```

Then edit the file to configure your environment. Key configuration options include:

- `EVM_CHAINS`: Comma-separated list of supported EVM chains (defaults to eth,polygon,arbitrum,base,optimism,avalanche,linea)
- `ALLOW_MOCK_PRICE_HISTORY`: Whether to allow mock price history data generation (defaults to true in development, false in production)
- `DATABASE_URL`: PostgreSQL connection string (primary database)
- `DATABASE_READ_REPLICA_URL`: PostgreSQL read replica connection string (optional)
- `DB_SSL`: Enable SSL for database connection
- `PORT`: The port to run the server on (defaults to 3000)

#### 2. Configuring Initial Token Balances

By default, all token balances start at zero. You can configure initial balances for different tokens across multiple blockchains using the following environment variables in your `.env` file:

**Chain-Specific Configuration**

Example chain-specific configurations:

```
# Ethereum Mainnet specific balances
INITIAL_ETH_ETH_BALANCE=2     # ETH on Ethereum Mainnet specifically
INITIAL_ETH_USDC_BALANCE=3000 # USDC on Ethereum Mainnet specifically

# Solana Virtual Machine (SVM) Balances
INITIAL_SVM_SOL_BALANCE=10    # Initial SOL balance on Solana
INITIAL_SVM_USDC_BALANCE=5000 # Initial USDC balance on Solana
INITIAL_SVM_USDT_BALANCE=0    # Initial USDT balance on Solana

# Polygon specific balances
INITIAL_POLYGON_ETH_BALANCE=50  # ETH on Polygon
INITIAL_POLYGON_USDC_BALANCE=4000 # USDC on Polygon

# Base specific balances
INITIAL_BASE_ETH_BALANCE=3        # ETH on Base
INITIAL_BASE_USDC_BALANCE=3500    # USDC on Base
```

**Balance Hierarchy and Overrides**

The system uses the following precedence for balances:

1. Specific chain balances (e.g., `INITIAL_ETH_USDC_BALANCE`)
2. Zero (default)

This allows fine-grained control over initial token balances across different blockchains.

#### 3. Security Secret Generation

Generate all required security secrets with:

```bash
pnpm generate:secrets
```

This will create the following secrets:

- `ROOT_ENCRYPTION_KEY`: Used for encrypting API keys
- `ADMIN_API_KEY`: Used for admin authentication (if not already set up)

#### 4. Database Initialization

For any fresh database setup (development or production):

```bash
pnpm db:prepare-production
```

This command will:

- Apply the baseline SQL (legacy data/schema) if needed
- Run all Drizzle migrations after the baseline

**Note:** `pnpm db:migrate` (Drizzle-only) should only be used if you're certain the baseline has already been applied to your database.

#### 5. Build the Application

Build the TypeScript application:

```bash
pnpm build
```

#### 6. Start the Server

Start the server:

```bash
pnpm start
```

For development with hot reloading:

```bash
pnpm dev
```

The server will be available at http://localhost:3000 by default.

#### 8. Set Up Admin Account

In a separate terminal, set up the admin account:

```bash
pnpm setup:admin
```

This will prompt you to enter admin credentials or will generate them for you.
