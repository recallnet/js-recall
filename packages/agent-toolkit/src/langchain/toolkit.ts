import { BaseToolkit } from "@langchain/core/tools";

import RecallAPI from "../shared/api.js";
import { type Configuration, isToolAllowed } from "../shared/configuration.js";
import { tools } from "../shared/tools.js";
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
  private _recall: RecallAPI;

  tools: RecallTool[];

  constructor({
    privateKey,
    configuration,
  }: {
    privateKey: string;
    configuration: Configuration;
  }) {
    this._recall = new RecallAPI(privateKey, configuration.context);

    const filteredTools = tools.filter((tool) =>
      isToolAllowed(tool, configuration),
    );

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
