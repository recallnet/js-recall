import { BaseToolkit } from "@langchain/core/tools";

import RecallAPI from "../shared/api.js";
import { type Configuration, isToolAllowed } from "../shared/configuration.js";
import RecallTool from "./tool.js";

/**
 * A LangChain compatible toolkit for the Recall agent toolkit.
 * @example
 * ```ts
 * const toolkit = new RecallAgentToolkit({
 *   privateKey: "0x...",
 *   configuration: {
 *     actions: {
 *       account: {
 *         read: true,
 *         write: true,
 *       },
 *     },
 *   },
 * });
 * ```
 */
export default class RecallAgentToolkit implements BaseToolkit {
  /**
   * The Recall API instance used to interact with the Recall network.
   * @private
   */
  private _recall: RecallAPI;

  /**
   * The collection of tools available in this toolkit. Each tool is configured as a
   * LangChain `StructuredTool` that can be used in function calling scenarios.
   */
  tools: RecallTool[];

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
    this._recall = new RecallAPI(privateKey, configuration.context);

    const filteredTools = this._recall
      .getTools()
      .filter((tool) => isToolAllowed(tool, configuration));

    this.tools = filteredTools.map(
      (tool) =>
        new RecallTool(
          this._recall,
          tool.method,
          tool.description,
          tool.parameters,
        ),
    );
  }

  getTools(): RecallTool[] {
    return this.tools;
  }
}
