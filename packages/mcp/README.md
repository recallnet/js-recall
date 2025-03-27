# Recall MCP Server

> Official MCP server for interacting with the Recall network.

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Background](#background)
- [Usage](#usage)
  - [Configure for Cursor or Claude Desktop](#configure-for-cursor-or-claude-desktop)
    - [Adding to Cursor](#adding-to-cursor)
    - [Adding to Claude Desktop](#adding-to-claude-desktop)
  - [Available tools](#available-tools)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Background

The `@recallnet/mcp` server allows agents to interact with the Recall network using the [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol). See the [Recall MCP documentation](https://docs.recall.network/tools/mcp) for more information.

## Usage

Run the package with npx. You'll need to provide a Recall private key and optionally a network (e.g., `testnet` or `localnet`).

```bash
npx @recallnet/mcp --private-key=0x... --network=testnet
```

Or, set the `RECALL_PRIVATE_KEY` and `RECALL_NETWORK` environment variables:

```bash
RECALL_PRIVATE_KEY=0x... RECALL_NETWORK=testnet npx @recallnet/mcp
```

Optionally, you can specify the tools you want to enable. By default, all tools are enabled.

```bash
npx @recallnet/mcp --private-key=0x... --network=testnet --tools=bucket.read,bucket.write
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
    "recall-mcp": {
      "name": "Recall MCP",
      "type": "command",
      "command": "npx",
      "args": ["-y", "@recallnet/mcp"],
      "env": {
        "RECALL_PRIVATE_KEY": "0xyour_private_key",
        "RECALL_NETWORK": "testnet",
        "RECALL_TOOLS": "all"
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
       "recall-mcp-server": {
         "name": "Recall MCP",
         "type": "command",
         "command": "npx",
         "args": ["-y", "@recallnet/mcp"],
         "env": {
           "RECALL_PRIVATE_KEY": "0xyour_private_key",
           "RECALL_NETWORK": "testnet",
           "RECALL_TOOLS": "all"
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

### Available tools

The server exposes the following MCP tools:

| Tool name              | Tool scope      | Description                                                            |
| ---------------------- | --------------- | ---------------------------------------------------------------------- |
| `get_account_info`     | `account.read`  | Get Recall account information (e.g., address, balance)                |
| `get_credit_info`      | `account.read`  | Get Recall account credit information (e.g., credit available or used) |
| `buy_credit`           | `account.write` | Buy credit for Recall account                                          |
| `list_buckets`         | `bucket.read`   | List all buckets owned by an address                                   |
| `create_bucket`        | `bucket.write`  | Create a bucket in Recall                                              |
| `get_or_create_bucket` | `bucket.write`  | Get or create a bucket in Recall (using alias)                         |
| `add_object`           | `bucket.write`  | Add an object to a Recall bucket                                       |
| `get_object`           | `bucket.read`   | Get an object from a Recall bucket                                     |
| `query_objects`        | `bucket.read`   | Query objects in a Recall bucket                                       |

## Development

Clone the repository:

```bash
git clone https://github.com/recallnet/js-recall.git
```

And change into the `packages/mcp` directory:

```bash
cd js-recall/packages/mcp
```

Install dependencies and build the binary:

```bash
pnpm install
pnpm build
```

Run the server directly from the `dist` directory:

```bash
node dist/index.js --private-key=0x... --network=testnet
```

The following `pnpm` commands are available:

| Command             | Description                                     |
| ------------------- | ----------------------------------------------- |
| `pnpm build`        | Build the binary                                |
| `pnpm dev`          | Run in development mode                         |
| `pnpm lint`         | Lint the project with ESLint                    |
| `pnpm lint:fix`     | Lint the project and fix linting errors         |
| `pnpm format:check` | Check if the project is formatted with Prettier |
| `pnpm format`       | Format the project (writes files)               |

## Contributing

PRs accepted.

Small note: If editing the README, please conform to
the [standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

MIT OR Apache-2.0, © 2025 Recall Network Corporation
