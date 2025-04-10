import type {
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from "openai/resources";
import { zodToJsonSchema } from "zod-to-json-schema";

import RecallAPI from "../shared/api.js";
import { type Configuration, isToolAllowed } from "../shared/configuration.js";

/**
 * An OpenAI compatible toolkit for the Recall agent.
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
  /**
   * The Recall API instance used to interact with the Recall network.
   * @private
   */
  private _recall: RecallAPI;

  /**
   * The collection of tools available in this toolkit. Each tool is configured as an OpenAI
   * `ChatCompletionTool` that can be used in function calling scenarios.
   */
  tools: ChatCompletionTool[];

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

    this.tools = filteredTools.map((tool) => ({
      type: "function",
      function: {
        name: tool.method,
        description: tool.description,
        parameters: zodToJsonSchema(tool.parameters),
      },
    }));
  }

  getTools(): ChatCompletionTool[] {
    return this.tools;
  }

  /**
   * Processes a single OpenAI tool call by executing the requested function.
   *
   * @param toolCall - The tool call object from OpenAI containing function name, arguments, and ID
   * @returns A promise that resolves to a tool message object containing the result of the tool
   * execution with the proper format for the OpenAI API
   */
  async handleToolCall(
    toolCall: ChatCompletionMessageToolCall,
  ): Promise<ChatCompletionToolMessageParam> {
    const args = JSON.parse(toolCall.function.arguments);
    const response = await this._recall.run(toolCall.function.name, args);
    return {
      role: "tool",
      tool_call_id: toolCall.id,
      content: response,
    };
  }
}
