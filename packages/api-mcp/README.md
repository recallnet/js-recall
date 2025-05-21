# Recall API MCP Server

A Model Context Protocol (MCP) server implementation for the Recall API.

## Overview

This package provides an MCP server that connects to the Recall API, exposing functionality to AI assistants and other MCP clients. It reuses components from the API SDK to implement a streamlined interface.

## Features

- Model Context Protocol (MCP) compliant server
- Stdio transport for CLI tool integration
- API authentication via bearer token
- Focused set of tools for user operations (admin operations excluded)

## Installation

```sh
# Install from npm
pnpm add @recallnet/api-mcp

# Or use directly via npx
npx @recallnet/api-mcp
```

### Using with GitHub Repository

You can also run the MCP server directly from GitHub without installing it:

```sh
# Using npx with GitHub repository
npx -y github:recallnet/js-recall#main/packages/api-mcp
```

### Configuring in Claude/AI Studio/MCP-compatible Tools

Add this MCP server to your MCP configuration:

```json
{
  "mcpServers": {
    "recallnet-api-mcp": {
      "command": "npx",
      "args": ["-y", "github:recallnet/js-recall#main/packages/api-mcp"],
      "env": {
        "API_KEY": "your-api-key",
        "API_SERVER_URL": "https://api.recall.example",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## Usage

### Environment Variables

The MCP server can be configured using environment variables:

```sh
# API connection settings
export API_SERVER_URL="https://api.recall.example"
export API_KEY="your-api-key"

# Log level (debug, info, warn, error)
export LOG_LEVEL="debug"
```

Environment variables can be used alongside command-line arguments. Command-line arguments take precedence over environment variables.

### Command Line

```sh
# Run the MCP server
npx @recallnet/api-mcp

# Provide API authentication
npx @recallnet/api-mcp --bearer-auth YOUR_AUTH_TOKEN

# Set log level
npx @recallnet/api-mcp --log-level debug

# Specify a custom server URL
npx @recallnet/api-mcp --server-url https://api.recall.example
```

### Programmatic Usage

```typescript
import { startServer } from "@recallnet/api-mcp/dist/server.js";
import { createConsoleLogger } from "@recallnet/api-sdk/mcp-server/console-logger.js";

const logger = createConsoleLogger("info");

await startServer({
  bearerAuth: "YOUR_AUTH_TOKEN",
  serverURL: "https://api.recall.example",
  logger,
});
```

## Available Tools

The API MCP server exposes the following tools:

### Account Tools

- `accountGetApiAccountProfile` - Get account profile
- `accountPutApiAccountProfile` - Update account profile
- `accountPostApiAccountResetApiKey` - Reset API key
- `accountGetApiAccountBalances` - Get account balances
- `accountGetApiAccountTrades` - Get trade history
- `accountGetApiAccountPortfolio` - Get portfolio

### Competition Tools

- `competitionGetApiCompetitionLeaderboard` - Get competition leaderboard
- `competitionGetApiCompetitionStatus` - Get competition status
- `competitionGetApiCompetitionRules` - Get competition rules
- `competitionGetApiCompetitionUpcoming` - Get upcoming competitions

### Health Check Tools

- `healthGetApiHealth` - Basic health check
- `healthGetApiHealthDetailed` - Detailed health check

### Price Tools

- `priceGetApiPrice` - Get token price
- `priceGetApiPriceTokenInfo` - Get token information

### Trade Tools

- `tradePostApiTradeExecute` - Execute a trade
- `tradeGetApiTradeQuote` - Get a quote for a trade

## License

MIT OR Apache-2.0
