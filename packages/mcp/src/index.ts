#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import chalk from "chalk";

import { RecallAgentToolkit } from "@recallnet/agent-toolkit/mcp";

import { buildMcpConfiguration, parseAndValidateConfig } from "./config.js";

/**
 * Handle errors with special color formatting for clarity purposes (since we use console.error
 * for all logging outputs)
 */
function handleError(error: unknown) {
  console.error(chalk.red("\nError initializing Recall MCP server:\n"));
  console.error(
    chalk.yellow(
      ` ${error instanceof Error ? error.message : String(error)}\n`,
    ),
  );
}

/**
 * Main function that parses the command line arguments, creates the `RecallAgentToolkit` instance,
 * and starts the MCP server
 */
export async function main() {
  const config = parseAndValidateConfig();
  const mcpConfig = buildMcpConfiguration(config);

  const server = new RecallAgentToolkit({
    privateKey: config.privateKey,
    configuration: mcpConfig,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // We use console.error instead of console.log since console.log will output to stdio, which
  // will confuse the MCP server
  console.error(chalk.green("Recall MCP Server running on stdio"));
}

try {
  main().catch((error) => {
    handleError(error);
  });
} catch (error) {
  handleError(error);
}
