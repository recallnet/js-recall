import type { Tool as CoreTool } from "ai";

import RecallAPI from "../shared/api.js";
import { type Configuration, isToolAllowed } from "../shared/configuration.js";
import RecallTool from "./tool.js";

/**
 * A toolkit for the Recall agent.
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
export default class RecallAgentToolkit {
  private _recall: RecallAPI;

  tools: { [key: string]: CoreTool };

  constructor({
    privateKey,
    configuration,
  }: {
    privateKey: string;
    configuration: Configuration;
  }) {
    this._recall = new RecallAPI(privateKey, configuration.context);
    this.tools = {};

    const filteredTools = this._recall
      .getTools()
      .filter((tool) => isToolAllowed(tool, configuration));

    filteredTools.forEach((tool) => {
      this.tools[tool.method] = RecallTool(
        this._recall,
        tool.method,
        tool.description,
        tool.parameters,
      );
    });
  }

  getTools(): { [key: string]: CoreTool } {
    return this.tools;
  }
}
