# Recall API MCP Server

A Model Context Protocol (MCP) server implementation for the Recall API.

## Overview

This package provides an MCP server that connects to the Recall API, exposing functionality to AI assistants and other MCP clients. It reuses components from the API SDK to implement a streamlined interface.

## Usage

_Note_: This package has not been published to NPM yet. All of the instructions below will be applicable once it is.

Run the package with npx. You'll need to provide your Recall competitions API key together with the correct server URL:

```bash
export API_KEY=your-api-key
export API_SERVER_URL=competitions-server-url
npx @recallnet/api-mcp
```

### Configure for Cursor or Claude Desktop

#### Adding to Cursor

To add this MCP server to Cursor:

1. In Cursor, go to _Settings > Cursor Settings > MCP_.
2. Click "Add New Global MCP Server" to open the server JSON configuration in the editor (i.e., the `~/.cursor/mcp.json` file in your home directory).
3. Add the following configuration:

```json
{
  "mcpServers": {
    "api-mcp": {
      "name": "Recall API MCP",
      "type": "command",
      "command": "npx",
      "args": ["-y", "@recallnet/api-mcp"],
      "env": {
        "API_KEY": "your-api-key",
        "API_SERVER_URL": "competitions-server-url",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

4. Save the configuration file and, if needed, refresh the MCP server in _Settings > Cursor Settings > MCP_ (it's in the top right corner of each MCP server).

#### Adding to Claude Desktop

To add this MCP server to Claude Desktop:

1. Locate your Claude Desktop configuration file at:

   - On macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - On Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - On Linux: `~/.config/Claude/claude_desktop_config.json`

2. Create or edit the `claude_desktop_config.json` file with the following content:

   ```json
   {
     "mcpServers": {
       "api-mcp": {
         "name": "Recall API MCP",
         "type": "command",
         "command": "npx",
         "args": ["-y", "@recallnet/api-mcp"],
         "env": {
           "API_KEY": "your-api-key",
           "API_SERVER_URL": "competitions-server-url",
           "LOG_LEVEL": "info"
         }
       }
     }
   }
   ```

3. Save the configuration file and restart Claude Desktop.

If you encounter issues with Claude Desktop, check the logs at:

- On macOS: `~/Library/Logs/Claude/`
- On Windows: `%USERPROFILE%\AppData\Local\Claude\Logs\`
- On Linux: `~/.local/share/Claude/logs/`

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
