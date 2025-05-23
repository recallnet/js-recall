import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createMCPServer } from "@recallnet/api-sdk/mcp-server/server.js";
import { tool$accountGetApiAccountBalances } from "@recallnet/api-sdk/mcp-server/tools/accountGetApiAccountBalances.js";
import { tool$accountGetApiAccountPortfolio } from "@recallnet/api-sdk/mcp-server/tools/accountGetApiAccountPortfolio.js";
// Import non-admin tools directly
import { tool$accountGetApiAccountProfile } from "@recallnet/api-sdk/mcp-server/tools/accountGetApiAccountProfile.js";
import { tool$accountGetApiAccountTrades } from "@recallnet/api-sdk/mcp-server/tools/accountGetApiAccountTrades.js";
import { tool$accountPostApiAccountResetApiKey } from "@recallnet/api-sdk/mcp-server/tools/accountPostApiAccountResetApiKey.js";
import { tool$accountPutApiAccountProfile } from "@recallnet/api-sdk/mcp-server/tools/accountPutApiAccountProfile.js";
import { tool$competitionGetApiCompetitions } from "@recallnet/api-sdk/mcp-server/tools/competitionGetApiCompetitions.js";
import { tool$competitionGetApiCompetitionsLeaderboard } from "@recallnet/api-sdk/mcp-server/tools/competitionGetApiCompetitionsLeaderboard.js";
import { tool$competitionGetApiCompetitionsRules } from "@recallnet/api-sdk/mcp-server/tools/competitionGetApiCompetitionsRules.js";
import { tool$competitionGetApiCompetitionsStatus } from "@recallnet/api-sdk/mcp-server/tools/competitionGetApiCompetitionsStatus.js";
import { tool$competitionGetApiCompetitionsUpcoming } from "@recallnet/api-sdk/mcp-server/tools/competitionGetApiCompetitionsUpcoming.js";
import { tool$healthGetApiHealth } from "@recallnet/api-sdk/mcp-server/tools/healthGetApiHealth.js";
import { tool$healthGetApiHealthDetailed } from "@recallnet/api-sdk/mcp-server/tools/healthGetApiHealthDetailed.js";
import { tool$priceGetApiPrice } from "@recallnet/api-sdk/mcp-server/tools/priceGetApiPrice.js";
import { tool$priceGetApiPriceTokenInfo } from "@recallnet/api-sdk/mcp-server/tools/priceGetApiPriceTokenInfo.js";
import { tool$tradeGetApiTradeQuote } from "@recallnet/api-sdk/mcp-server/tools/tradeGetApiTradeQuote.js";
import { tool$tradePostApiTradeExecute } from "@recallnet/api-sdk/mcp-server/tools/tradePostApiTradeExecute.js";

import { ServerOptions } from "./types.js";

// Non-admin tool definitions
const USER_TOOLS = [
  // Account tools
  tool$accountGetApiAccountProfile,
  tool$accountPutApiAccountProfile,
  tool$accountPostApiAccountResetApiKey,
  tool$accountGetApiAccountBalances,
  tool$accountGetApiAccountTrades,
  tool$accountGetApiAccountPortfolio,

  // Competition tools
  tool$competitionGetApiCompetitions,
  tool$competitionGetApiCompetitionsLeaderboard,
  tool$competitionGetApiCompetitionsStatus,
  tool$competitionGetApiCompetitionsRules,
  tool$competitionGetApiCompetitionsUpcoming,

  // Health check tools
  tool$healthGetApiHealth,
  tool$healthGetApiHealthDetailed,

  // Price tools
  tool$priceGetApiPrice,
  tool$priceGetApiPriceTokenInfo,

  // Trade tools
  tool$tradePostApiTradeExecute,
  tool$tradeGetApiTradeQuote,
];

/**
 * Start the MCP server with the provided options
 */
export async function startServer(options: ServerOptions): Promise<void> {
  const { bearerAuth, serverURL, serverIdx, logger } = options;

  // Extract tool names from the imported tool definitions
  const allowedTools = USER_TOOLS.map((tool) => tool.name);

  // Create the MCP server
  const mcpServer = createMCPServer({
    logger,
    allowedTools,
    bearerAuth,
    serverURL,
    serverIdx,
  });

  // Create a transport for stdio
  const transport = new StdioServerTransport();

  // Connect the server to the transport
  await mcpServer.connect(transport);

  // Set up signal handlers for graceful shutdown
  const abort = async () => {
    await mcpServer.close();
    process.exit(0);
  };

  process.on("SIGTERM", abort);
  process.on("SIGINT", abort);
}
