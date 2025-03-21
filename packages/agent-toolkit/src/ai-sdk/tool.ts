import type { Tool as CoreTool } from "ai";
import { tool } from "ai";
import { z } from "zod";

import RecallAPI from "../shared/api.js";

/**
 * A tool for the Recall agent.
 * @example
 * ```ts
 * const tool = new RecallTool(recallAPI, "get_account_info", "Get account info", getAccountInfoParameters);
 * ```
 */
export default function RecallTool(
  recallAPI: RecallAPI,
  method: string,
  description: string,
  schema: z.ZodObject<any, any, any, any, { [x: string]: any }>,
): CoreTool {
  return tool({
    description: description,
    parameters: schema,
    execute: (arg: z.output<typeof schema>) => {
      return recallAPI.run(method, arg);
    },
  });
}
