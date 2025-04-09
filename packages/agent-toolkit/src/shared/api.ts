import { Hex } from "viem";

import {
  ChainName,
  checkChainName,
  getChain,
  testnet,
} from "@recallnet/chains";
import {
  RecallClient,
  walletClientFromPrivateKey,
} from "@recallnet/sdk/client";

import type { Context } from "./configuration.js";
import { Tool, tools } from "./tools.js";
import { jsonStringify } from "./util.js";

/**
 * The Recall API provides a simple interface for the Recall network and SDK, designed for
 * agentic use.
 * @example
 * ```ts
 * const privateKey = "0x...";
 * const recall = new RecallAPI(privateKey);
 * const result = await recall.run("get_account_info", {});
 * ```
 */
export default class RecallAPI {
  private _recall: RecallClient;
  private _context: Context;
  private _tools: Tool[];
  private _serialize: (data: unknown) => string;
  /**
   * Create a new RecallAPI instance.
   * @param privateKey - The private key of the account to use.
   * @param context - The context to use, including the network name (e.g., `testnet` or `localnet`).
   * @param serializer - The serializer to use, which formats the return value of the method.
   * Defaults to `jsonStringify` (i.e.,`JSON.stringify` with `bigint`s converted to strings).
   */
  constructor(
    privateKey: string,
    context?: Context,
    serializer: (data: unknown) => string = jsonStringify,
  ) {
    const chain =
      context?.network !== undefined && checkChainName(context.network)
        ? getChain(context.network as ChainName)
        : testnet;
    const walletClient = walletClientFromPrivateKey(privateKey as Hex, chain);
    const recallClient = new RecallClient({ walletClient });

    this._recall = recallClient;
    this._context = context || {};
    this._tools = tools(context);
    this._serialize = serializer;
  }

  /**
   * Run a method on the Recall network.
   * @param method - The method to run.
   * @param arg - The arguments to pass to the method.
   * @returns The result of the method.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async run(method: string, arg: any) {
    const tool = this._tools.find((t) => t.method === method);
    if (tool !== undefined) {
      const output = this._serialize(
        await tool.execute(this._recall, this._context, arg),
      );
      return output;
    } else {
      throw new Error(`Invalid method: ${method}`);
    }
  }
}
