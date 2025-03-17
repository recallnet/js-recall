import type {
  Tool as CoreTool,
  LanguageModelV1Middleware,
  LanguageModelV1StreamPart,
} from "ai";

import RecallAPI from "../shared/api.js";
import { type Configuration, isToolAllowed } from "../shared/configuration.js";
import { tools } from "../shared/tools.js";
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

    const filteredTools = tools.filter((tool) =>
      isToolAllowed(tool, configuration),
    );

    filteredTools.forEach((tool) => {
      this.tools[tool.method] = RecallTool(
        this._recall,
        tool.method,
        tool.description,
        tool.parameters,
      );
    });
  }

  middleware(): LanguageModelV1Middleware {
    return {
      wrapGenerate: async ({ doGenerate }) => {
        const result = await doGenerate();

        return result;
      },

      wrapStream: async ({ doStream }) => {
        const { stream, ...rest } = await doStream();

        const transformStream = new TransformStream<
          LanguageModelV1StreamPart,
          LanguageModelV1StreamPart
        >({
          async transform(chunk, controller) {
            controller.enqueue(chunk);
          },
        });

        return {
          stream: stream.pipeThrough(transformStream),
          ...rest,
        };
      },
    };
  }

  getTools(): { [key: string]: CoreTool } {
    return this.tools;
  }
}
