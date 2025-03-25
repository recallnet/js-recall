import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { RunnableConfig } from "@langchain/core/runnables";
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";

import RecallAPI from "../shared/api.js";

/**
 * A LangChain compatible structured tool for the Recall agent toolkit.
 * @example
 * ```ts
 * const tool = new RecallTool(recallAPI, "get_account_info", "Get account info", getAccountInfoParameters);
 * ```
 */
class RecallTool extends StructuredTool {
  private _recall: RecallAPI;
  method: string;
  name: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodObject<any, any, any, any>;

  constructor(
    recallAPI: RecallAPI,
    method: string,
    description: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: z.ZodObject<any, any, any, any>,
  ) {
    super();

    this._recall = recallAPI;
    this.method = method;
    this.name = method;
    this.description = description;
    this.schema = schema;
  }

  _call(
    arg: z.output<typeof this.schema>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _runManager?: CallbackManagerForToolRun,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _parentConfig?: RunnableConfig,
  ): Promise<string> {
    return this._recall.run(this.method, arg);
  }
}

export default RecallTool;
