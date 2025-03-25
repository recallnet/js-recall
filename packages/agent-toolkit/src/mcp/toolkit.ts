import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from "zod";

import RecallAPI from "../shared/api.js";
import { Configuration, isToolAllowed } from "../shared/configuration.js";
import { tools } from "../shared/tools.js";

/**
 * Recall agent toolkit for the Model Context Protocol.
 * @example
 * ```ts
 * import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
 * import { RecallAgentToolkit } from "@recallnet/agent-toolkit/mcp";
 * import { Configuration } from "@recallnet/agent-toolkit/shared";
 *
 * const configuration: Configuration = {
 *   actions: {
 *     bucket: {
 *       read: true,
 *       write: true,
 *     },
 *   },
 *   context: {},
 * };
 * const privateKey = "0x...";
 * const server = new RecallAgentToolkit(privateKey, configuration);
 * const transport = new StdioServerTransport();
 * await server.connect(transport);
 * ```
 */
export default class RecallAgentToolkit extends McpServer {
  private _recall: RecallAPI;

  /**
   * Create a new RecallAgentToolkit instance.
   * @param privateKey - The private key of the account to use.
   * @param configuration - The {@link Configuration} to use.
   */
  constructor({
    privateKey,
    configuration,
  }: {
    privateKey: string;
    configuration: Configuration;
  }) {
    super({
      name: "Recall",
      version: "0.0.1",
      description: "Recall storage for memory and context retrieval",
    });

    this._recall = new RecallAPI(privateKey, configuration.context);

    const filteredTools = tools.filter((tool) =>
      isToolAllowed(tool, configuration),
    );

    filteredTools.forEach((tool) => {
      this.tool(
        tool.method,
        tool.description,
        tool.parameters.shape,
        async (
          arg: z.infer<typeof tool.parameters>,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _extra: RequestHandlerExtra,
        ) => {
          const result = await this._recall.run(tool.method, arg);
          return {
            content: [
              {
                type: "text" as const,
                text: String(result),
              },
            ],
          };
        },
      );
    });
  }
}
