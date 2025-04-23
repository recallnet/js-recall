# Multi-Chain Trading Simulator

A robust server application for hosting simulated blockchain trading competitions where teams can practice trading across multiple chains without risking real assets.

## Project Overview

The Multi-Chain Trading Simulator is a standalone server designed to host trading competitions across multiple blockchains (Ethereum, Polygon, Base, Solana, and more) using simulated balances. Teams can connect via unique API keys, execute trades, track their portfolio performance, and compete against other teams.

### Key Features

- Multi-chain support for both EVM chains (Ethereum, Polygon, Base, etc.) and SVM chains (Solana)
- Team registration with secure API key authentication
- Self-service team registration through public API endpoint
- Real-time token price tracking from DexScreener API with support for all major chains (Ethereum, Polygon, Base, Solana, and more)
- Simulated trading with realistic slippage and market conditions
- Balance and portfolio management across multiple chains
- Competition management with leaderboards
- Comprehensive API for trading and account management
- Rate limiting and security features
- Chain Override Feature - Specify the exact chain for EVM tokens to reduce API response times from seconds to milliseconds
- Cross-Chain Trading Controls - Configure whether trades between different chains are allowed or restricted
- Leaderboard Access Control - Configure whether participants can access the leaderboard or if it's restricted to administrators only

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
- ✅ Multiple price providers (DexScreener, Noves, Jupiter, Raydium)
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
  - `NovesProvider`: Advanced EVM chain price data (disabled)
  - `RaydiumProvider`: Solana token price data from Raydium (disabled)
  - `JupiterProvider`: Solana token price data from Jupiter API (disabled)
  - `SolanaProvider`: Basic SOL token information (disabled)
  - `BalanceManager`: Team balance tracking across multiple chains
  - `TradeSimulator`: Trade execution and processing with chain-specific logic
  - `CompetitionManager`: Competition lifecycle management
  - `TeamManager`: Team registration and authentication
  - `SchedulerService`: Portfolio snapshot scheduling and background tasks

- **Middleware**: Request processing and security

  - `AuthMiddleware`: API key validation for team endpoints
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
  - `PublicController`: Public endpoints for self-service team registration

- **Repositories**: Data access layer
  - `TeamRepository`: Team data management
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
- PostgreSQL (v13+)
- npm or yarn

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/recallnet/trade-sim
   cd trade-sim
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Set up your environment configuration:

   ```
   cp .env.example .env
   ```

   Open the `.env` file in your editor and configure the following:

   - Database connection details
   - Initial token balances for different chains
   - Cross-chain trading settings (enabled/disabled)
   - EVM chains to support
   - Price tracking and portfolio snapshot intervals

   This step is critical as it determines how your trading simulator will be configured.

4. Run the automated setup:

   ```
   npm run setup:all
   ```

   This command will:

   - Generate secure random values for security secrets (ROOT_ENCRYPTION_KEY)
   - Initialize the database schema with all necessary tables
   - Build the application
   - Start a temporary server
   - Set up the admin account (with interactive prompts)
   - Provide final instructions

   Alternatively, you can run the steps separately if you need more control:

   ```
   npm run generate:secrets  # Generate security secrets
   npm run db:init           # Initialize the database with full schema
   npm run build             # Build the application
   npm run start             # Start the server
   npm run setup:admin       # Set up the admin account (in a separate terminal)
   ```

5. Start the development server:
   ```
   npm run dev
   ```

The server will be available at http://localhost:3000 by default.

## Admin Setup Guide

As the administrator of this application, you'll need to properly configure the system before teams can use it. This guide covers how to set up the system quickly and efficiently.

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
npm run setup:all
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

#### Team Management

When registering a team or creating a competition, the server **does not** need to be running.

- **Register a new team as admin**:

  ```
  npm run register:team
  ```

  This script will:

  - Prompt for team name, email, and contact person
  - Require a wallet address (0x format)
  - Generate a secure API key
  - Register the team in the system
  - Display the credentials (keep this API key secure)

- **Self-register a team using the public API**:

  Teams can self-register using the public API endpoint `/api/public/teams/register` without requiring admin involvement. They need to provide:

  ```json
  {
    "teamName": "Team Name",
    "email": "team@example.com",
    "contactPerson": "Contact Person",
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "metadata": {
      "ref": {
        "name": "tradingbot",
        "version": "1.0.0",
        "url": "github.com/example/tradingbot"
      },
      "description": "Trading bot description",
      "social": {
        "name": "Trading Team",
        "email": "contact@tradingteam.com",
        "twitter": "@tradingbot"
      }
    }
  }
  ```

  The endpoint will return an API key that the team can use for authentication.

- **Edit a team**:

  ```
  npm run edit:team
  ```

  This script allows you to update existing team information:

  - Find a team by email
  - Set or update the team's wallet address
  - Add bucket addresses to the team's bucket collection
  - Supports both interactive mode and command-line arguments
  - Validates addresses to ensure proper format (0x followed by 40 hex characters)

- **List all teams**:

  ```
  npm run list:teams
  ```

  This script will display detailed information about all registered teams, including:

  - Team ID
  - Team name
  - Contact information
  - API Key
  - Creation date

- **Delete a team**:

  ```
  npm run delete:team
  ```

  This script will:

  - Display a list of all registered teams
  - Prompt for the team ID to delete
  - Confirm the deletion
  - Remove the team from the system

#### Competition Management

- **Setup a competition**:

  ```
  npm run setup:competition
  ```

  This script provides an interactive way to create and start a new trading competition:

  - Checks if there's already an active competition and offers to end it
  - Prompts for competition name and description
  - Displays all available teams with detailed information
  - Allows selecting teams to participate using simple number selection (e.g., "1,3,5-7") or "all"
  - Confirms the selection and starts the competition
  - Shows detailed competition information

- **Check competition status**:

  ```
  npm run comp:status
  ```

  This script displays comprehensive information about the active competition:

  - Competition details (name, description, duration)
  - List of participating teams
  - Current leaderboard with portfolio values and performance metrics
  - Performance statistics (highest/lowest/average values)
  - If no active competition exists, shows information about past competitions

- **End a competition**:

  ```
  npm run end:competition
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
npm run start
```

For development with hot reloading:

```bash
npm run dev
```

The server will be available at http://localhost:3000 by default.

## Security

All protected API endpoints require an API Key in the Authorization header:

```
Authorization: Bearer your-api-key
```

### API Authentication

For enhanced security, the API implements:

- Bearer token authentication with unique API keys for each team
- API keys in the format `[hexstring]_[hexstring]`
- Admin-specific API keys for administrative operations
- Encrypted storage of API keys using AES-256-CBC encryption

This approach ensures:

1. All API requests are properly authenticated
2. Each team has its own unique API key
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

## API Documentation

For teams participating in trading competitions, we provide comprehensive API documentation and code examples to help you get started quickly.

### Documentation Resources

- **[API Documentation](docs/API.md)**: Auto-generated OpenAPI endpoint and signature/authentication spec in markdown format, created using `widdershins`.
- **[OpenAPI JSON](docs/openapi.json)**: Auto-generated OpenAPI spec in JSON format.
- **[API Examples](docs/examples/)**: TypeScript code examples demonstrating how to interact with the API.
- **Public API**: Teams can self-register through the public API endpoint `/api/public/teams/register` without requiring admin authentication.

You can regenerate the documentation at any time using the built-in scripts:

```bash
# Generate both OpenAPI JSON and Markdown documentation
npm run generate-docs

# Generate only OpenAPI specification
npm run generate-openapi

# Generate only Markdown from existing OpenAPI spec
npm run generate-markdown
```

### Authentication

All API requests require Bearer token authentication with the following header:

- `Authorization`: Bearer your-api-key
- `Content-Type`: `application/json`

For details and examples in TypeScript, see the [API Documentation](docs/API_DOCUMENTATION.md).

### Example Client

We provide a [TypeScript client class](docs/examples/api-client.ts) that handles authentication and requests for you. Usage example:

```typescript
import { TradingSimulatorClient, BlockchainType, SpecificChain } from './api-client';

// Create client with your API key
const client = new TradingSimulatorClient('your-api-key');

// Get account balances
const balances = await client.getBalances();
console.log('Balances:', balances);

// Get current price of SOL on Solana
const solPrice = await client.getPrice('So11111111111111111111111111111111111111112');
console.log('SOL Price:', solPrice);

// Get current price of WETH on Ethereum (WITHOUT chain override - slower)
const ethPrice = await client.getPrice('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');
console.log('ETH Price:', ethPrice);

// Get current price of LINK on Ethereum (WITH chain override - faster)
const linkPrice = await client.getPrice(
  '0x514910771af9ca656af840dff83e8264ecf986ca', // LINK token
  BlockchainType.EVM, // Blockchain type
  SpecificChain.ETH, // Specific chain (Ethereum)
);
console.log('LINK Price (with chain override):', linkPrice);
console.log('Response time: ~50-100ms (vs 1-3 seconds without override)');

// Get current price of ARB on Arbitrum (WITH chain override - faster)
const arbPrice = await client.getPrice(
  '0x912CE59144191C1204E64559FE8253a0e49E6548', // ARB token
  BlockchainType.EVM,
  SpecificChain.ARBITRUM, // Specific chain (Arbitrum)
);
console.log('ARB Price (with chain override):', arbPrice);
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
  '0x514910771af9ca656af840dff83e8264ecf986ca', // LINK token
  BlockchainType.EVM, // Blockchain type
  SpecificChain.ETH, // Specific chain (Ethereum)
);
```

### Supported Chains

The following chains can be specified:

- `eth` - Ethereum Mainnet
- `polygon` - Polygon Network
- `bsc` - Binance Smart Chain
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
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 'eth', // WETH on Ethereum
  '0x514910771af9ca656af840dff83e8264ecf986ca': 'eth', // LINK on Ethereum
  '0x912CE59144191C1204E64559FE8253a0e49E6548': 'arbitrum', // ARB on Arbitrum
  '0x532f27101965dd16442E59d40670FaF5eBB142E4': 'base', // TOSHI on Base
};
```

### Environment Variables Reference

Below is a comprehensive list of all environment variables available in `.env.example` that can be configured in your `.env` file. This reference indicates whether each variable is required or optional, its default value (if any), and a description of its purpose.

### Database Configuration

| Variable            | Required           | Default                    | Description                                                                                             |
| ------------------- | ------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `POSTGRES_URL`      | Optional           | None                       | PostgreSQL connection string in the format `postgresql://username:password@host:port/database?ssl=true` |
| `DB_HOST`           | Required if no URL | `localhost`                | Database host when not using `POSTGRES_URL`                                                             |
| `DB_PORT`           | Optional           | `5432`                     | Database port when not using `POSTGRES_URL`                                                             |
| `DB_USERNAME`       | Required if no URL | `postgres`                 | Database username when not using `POSTGRES_URL`                                                         |
| `DB_PASSWORD`       | Required if no URL | `postgres`                 | Database password when not using `POSTGRES_URL`                                                         |
| `DB_NAME`           | Required if no URL | `solana_trading_simulator` | Database name when not using `POSTGRES_URL`                                                             |
| `DB_SSL`            | Optional           | `false`                    | Enable SSL for database connection (`true` or `false`)                                                  |
| `DB_CA_CERT_PATH`   | Optional           | None                       | Path to CA certificate for SSL database connection (e.g., `./certs/ca-certificate.crt`)                 |
| `DB_CA_CERT_BASE64` | Optional           | None                       | Base64-encoded CA certificate for SSL connection (alternative to using certificate file path)           |

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

| Variable                  | Required | Default       | Description                                               |
| ------------------------- | -------- | ------------- | --------------------------------------------------------- |
| `PORT`                    | Optional | `3000`        | Server port number                                        |
| `NODE_ENV`                | Optional | `development` | Environment mode (`development`, `production`, or `test`) |
| `ENABLE_CORS`             | Optional | `true`        | Enable Cross-Origin Resource Sharing                      |
| `MAX_PAYLOAD_SIZE`        | Optional | `1mb`         | Maximum request body size                                 |
| `RATE_LIMIT_WINDOW_MS`    | Optional | `60000`       | Rate limiting window in milliseconds                      |
| `RATE_LIMIT_MAX_REQUESTS` | Optional | `100`         | Maximum requests per rate limit window                    |

### Chain Configuration

| Variable                    | Required | Default                                                  | Description                                                  |
| --------------------------- | -------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| `EVM_CHAINS`                | Optional | `eth,polygon,bsc,arbitrum,base,optimism,avalanche,linea` | Comma-separated list of supported EVM chains                 |
| `ALLOW_CROSS_CHAIN_TRADING` | Optional | `false`                                                  | Enable trading between different chains                      |
| `MAX_TRADE_PERCENTAGE`      | Optional | `25`                                                     | Maximum trade size as percentage of portfolio value          |
| `EVM_CHAIN_PRIORITY`        | Optional | `eth,polygon,base,arbitrum`                              | Chain priority for price lookups (first chain checked first) |
| `ALLOW_MOCK_PRICE_HISTORY`  | Optional | `true` in dev, `false` in prod                           | Allow generation of mock price history data                  |

### Competition Settings

| Variable                                 | Required | Default | Description                                                                                         |
| ---------------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------- |
| `DISABLE_PARTICIPANT_LEADERBOARD_ACCESS` | Optional | `false` | When set to `true`, only admins can view the leaderboard while participants are blocked from access |

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

| Variable                         | Required | Default               | Description                                  |
| -------------------------------- | -------- | --------------------- | -------------------------------------------- |
| `PORTFOLIO_SNAPSHOT_INTERVAL_MS` | Optional | `120000` (2 minutes)  | Interval for taking portfolio snapshots      |
| `PORTFOLIO_PRICE_FRESHNESS_MS`   | Optional | `600000` (10 minutes) | Maximum age of price data before refreshing  |
| `PRICE_CACHE_MS`                 | Optional | `60000` (1 minute)    | Duration to cache price data in memory       |
| `PRICE_BACKFILL_DAYS`            | Optional | `7`                   | Number of days to backfill for price history |
| `PRICE_HISTORY_INTERVAL_MINUTES` | Optional | `30`                  | Interval between price history data points   |

### External API Integration

| Variable                          | Required | Default                 | Description                                             |
| --------------------------------- | -------- | ----------------------- | ------------------------------------------------------- |
| `DEXSCREENER_API_URL`             | Optional | Default DexScreener URL | DexScreener API endpoint                                |
| `NOVES_API_URL`                   | Optional | Default Noves URL       | Noves API endpoint                                      |
| `JUPITER_API_URL`                 | Optional | Default Jupiter URL     | Jupiter API endpoint                                    |
| `EXTERNAL_API_TIMEOUT_MS`         | Optional | `5000` (5 seconds)      | Timeout for external API requests                       |
| `FALLBACK_TO_SECONDARY_PROVIDERS` | Optional | `true`                  | Fall back to secondary price providers if primary fails |

### Performance Tuning

| Variable                     | Required | Default            | Description                              |
| ---------------------------- | -------- | ------------------ | ---------------------------------------- |
| `MAX_CONCURRENT_REQUESTS`    | Optional | `10`               | Maximum concurrent external API requests |
| `ENABLE_QUERY_LOGGING`       | Optional | `false`            | Enable database query logging            |
| `ENABLE_PERFORMANCE_METRICS` | Optional | `true`             | Enable performance metrics collection    |
| `CHAIN_DETECTION_TIMEOUT_MS` | Optional | `3000` (3 seconds) | Timeout for chain detection              |

### Hierarchy & Precedence

The system follows specific rules for resolving settings when multiple related variables exist:

1. **Initial Balances**: Uses the most specific setting available:

   - Chain-specific balances (e.g., `INITIAL_ETH_USDC_BALANCE`)
   - Zero (default)

2. **Database Connection**: Uses the most comprehensive setting available:

   - `POSTGRES_URL` connection string
   - Individual parameters (`DB_HOST`, `DB_PORT`, etc.)
   - SSL configuration (`DB_SSL`)

3. **Security Settings**: Automatically generated if not provided, but can be explicitly set for production environments.

### Testing Configuration

For end-to-end testing, configure the `.env.test` file with appropriate values. The test suite requires sufficient token balances to execute trade-related tests successfully.

## Next Steps

The following features are planned for upcoming development:

1. Add support for more EVM chains (zkSync, Scroll, Mantle, etc.)
2. Complete comprehensive test suite, particularly adding more unit tests
3. Enhance error handling and logging with structured logging format
4. Add more advanced analytics for team performance monitoring
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
- **Provider Unit Tests**: Tests for specific price providers (DexScreener, Noves)
- **Integration Tests**: Testing the interaction between services
- **Configuration Tests**: Validating environment configurations

### End-to-End Test Coverage

Our E2E test suite covers the following major areas:

- ✅ **Portfolio Snapshots**: Taking snapshots, price freshness, portfolio calculations
- ✅ **Multi-Team Competitions**: Team registration, performance ranking, leaderboards
- ✅ **Chain-Specific Trading**: Trading on Ethereum, Polygon, Base, and Solana chains
- ✅ **Cross-Chain Trading**: Trading between different blockchains
- ✅ **Price Fetching**: Token price lookup with chain override optimizations
- ✅ **Admin Operations**: Competition management, team registration
- ✅ **Team Management**: Team creation, API key generation, authentication
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
npm run test:e2e
```

For a more comprehensive test run with database setup:

```bash
npm run test:e2e:runner
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

If you modify these values, you may need to update the test assertions as well. The test suite will automatically adapt to the `ALLOW_CROSS_CHAIN_TRADING` setting, running or skipping cross-chain tests accordingly.

> **Note**: The test suite tries to adapt to whatever balances are available, but setting balances to zero will cause certain tests to fail with "Insufficient balance" errors, as those tests expect minimum balances to be available for trading.

For more information on the E2E testing architecture, see the [E2E test documentation](./e2e/README.md).

## Portfolio Snapshots

The system automatically takes snapshots of team portfolios at regular intervals for performance tracking. The snapshot interval is configurable via environment variables in your `.env` file:

```
# Configure portfolio snapshot interval in milliseconds (default: 2 minutes)
PORTFOLIO_SNAPSHOT_INTERVAL_MS=120000

# Configure price freshness threshold in milliseconds (default: 10 minutes)
PORTFOLIO_PRICE_FRESHNESS_MS=600000

# Configure price cache duration in milliseconds (default: 1 minute)
PRICE_CACHE_MS=60000
```

You can adjust these intervals based on your needs:

- For testing environments, you may want to use shorter intervals (e.g., 10,000ms = 10 seconds for snapshots, 30,000ms = 30 seconds for price freshness)
- For production environments, you might want to use longer intervals to reduce database and API load (e.g., 300,000ms = 5 minutes for snapshots, 1,800,000ms = 30 minutes for price freshness)

The price freshness threshold controls when the system will reuse existing prices from the database instead of fetching new ones, optimizing both performance and accuracy.

Portfolio snapshots are taken:

1. When a competition starts
2. At regular intervals throughout the competition (controlled by the environment variable)
3. When a competition ends

Snapshot data is available via the admin API endpoint:

```
GET /api/admin/competition/:competitionId/snapshots
```

## Leaderboard Access Control

The trading simulator allows administrators to control whether participants can access the competition leaderboard. This feature is configurable in your `.env` file:

### Admin-Only Access Mode

With `DISABLE_PARTICIPANT_LEADERBOARD_ACCESS=true`, the system will:

- Allow only administrators to view the competition leaderboard
- Return a 403 Forbidden error with a clear message to participants who attempt to access the leaderboard
- Prevent participants from seeing other teams' performance until the competition is over

This mode is ideal for:

- Blind competitions where teams shouldn't know their ranking during the event
- Reducing competitive pressure during educational events
- Preventing teams from copying strategies based on leaderboard performance

### Open Access Mode (Default)

With `DISABLE_PARTICIPANT_LEADERBOARD_ACCESS=false` (the default setting), the system will:

- Allow all participants to freely access the leaderboard
- Let teams see their current ranking and portfolio performance in real-time
- Create a more competitive atmosphere with visible rankings

This mode is useful for:

- Traditional competition formats where rankings are public
- Creating a competitive environment that simulates real trading conditions
- Events where teams can learn from seeing others' performance

### Implementation

Configure this option in your `.env` file after copying from `.env.example`:

```
# Set to true to disable participant access to leaderboard (false by default)
DISABLE_PARTICIPANT_LEADERBOARD_ACCESS=false
```

When enabled, participants will receive a 403 Forbidden response with the message "Leaderboard access is currently restricted to administrators only" when attempting to access the leaderboard endpoint.

## Cross-Chain Trading Configuration

The trading simulator supports two modes of operation for cross-chain trading, configurable in your `.env` file:

### Allowed Cross-Chain Trading

With `ALLOW_CROSS_CHAIN_TRADING=true`, users can:

- Trade between tokens on different blockchain types (e.g., Solana SOL to Ethereum ETH)
- Execute trades between any supported chains (e.g., Polygon USDC to Base ETH)
- Maintain a diversified portfolio across multiple blockchains

This mode is ideal for:

- Multi-chain trading competitions
- Teaching cross-chain trading strategies
- Simulating real-world DeFi trading environments where bridges enable cross-chain transfers

### Restricted Same-Chain Trading (Default)

With `ALLOW_CROSS_CHAIN_TRADING=false` (the default setting), the system will:

- Reject trades where the source and destination tokens are on different chains
- Return an error message indicating that cross-chain trading is disabled
- Only allow trades between tokens on the same blockchain

This mode is useful for:

- Chain-specific trading competitions
- Simulating environments without cross-chain bridges
- Focusing participants on chain-specific trading strategies

### Implementation

Configure this option in your `.env` file after copying from `.env.example`:

```
# Set to true to enable trades between different chains (disabled by default)
ALLOW_CROSS_CHAIN_TRADING=false
```

When disabled, the trade validation in the `TradeSimulator` service will verify that both tokens are on the same chain before proceeding with the trade execution.

### Using Chain Parameters with Trade Restrictions

When executing trades with explicit chain parameters, the system's behavior will depend on the `ALLOW_CROSS_CHAIN_TRADING` setting:

#### With Cross-Chain Trading Allowed (`ALLOW_CROSS_CHAIN_TRADING=true`):

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

// Example 3: Same-chain trade on Base - ACCEPTED
{
  "fromToken": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  "toToken": "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",   // TOSHI on Base
  "amount": "50",
  "fromChain": "evm",
  "toChain": "evm",  // Same as fromChain, will be accepted
  "fromSpecificChain": "base",
  "toSpecificChain": "base"
}
```

#### DEFAULT - With Cross-Chain Trading Disabled (`ALLOW_CROSS_CHAIN_TRADING=false`):

```javascript
// This cross-chain trade will be REJECTED with an error
{
  "fromToken": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC on Solana
  "toToken": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",    // WETH on Ethereum
  "amount": "50",
  "fromChain": "svm",
  "toChain": "evm",  // Different from fromChain, will be rejected
  "fromSpecificChain": "svm",
  "toSpecificChain": "eth"
}

// This same-chain trade will be ACCEPTED
{
  "fromToken": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  "toToken": "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",   // TOSHI on Base
  "amount": "50",
  "fromChain": "evm",
  "toChain": "evm",  // Same as fromChain, will be accepted
  "fromSpecificChain": "base",
  "toSpecificChain": "base"
}
```

This approach allows you to control whether trades can cross between different blockchains, while still using explicit chain parameters to avoid chain detection overhead.

### Manual Setup

If you prefer to set up each component separately, you can follow these steps:

#### 1. Environment Configuration

The application uses environment variables for configuration. Create a `.env` file in the root directory based on `.env.example`:

```bash
cp .env.example .env
```

Then edit the file to configure your environment. Key configuration options include:

- `EVM_CHAINS`: Comma-separated list of supported EVM chains (defaults to eth,polygon,bsc,arbitrum,base,optimism,avalanche,linea)
- `ALLOW_MOCK_PRICE_HISTORY`: Whether to allow mock price history data generation (defaults to true in development, false in production)
- `ALLOW_CROSS_CHAIN_TRADING`: Whether to allow trades between different chains (defaults to false for security, set to true to enable cross-chain trading)
- `POSTGRES_URL`: PostgreSQL connection string
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
npm run generate:secrets
```

This will create the following secrets:

- `ROOT_ENCRYPTION_KEY`: Used for encrypting API keys
- `ADMIN_API_KEY`: Used for admin authentication (if not already set up)

#### 4. Database Initialization

Initialize the database with:

```bash
npm run db:init
```

#### 5. Build the Application

Build the TypeScript application:

```bash
npm run build
```

#### 6. Start the Server

Start the server:

```bash
npm run start
```

For development with hot reloading:

```bash
npm run dev
```

The server will be available at http://localhost:3000 by default.

#### 8. Set Up Admin Account

In a separate terminal, set up the admin account:

```bash
npm run setup:admin
```

This will prompt you to enter admin credentials or will generate them for you.
