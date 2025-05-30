/*
 * Code generated by Speakeasy (https://speakeasy.com). DO NOT EDIT.
 */
import { agentGetApiAgentTrades } from "../../funcs/agentGetApiAgentTrades.js";
import { ToolDefinition, formatResult } from "../tools.js";

export const tool$agentGetApiAgentTrades: ToolDefinition = {
  name: "agent-get-api-agent-trades",
  description: `Get agent trade history

Retrieve the trading history for the authenticated agent`,
  tool: async (client, ctx) => {
    const [result, apiCall] = await agentGetApiAgentTrades(client, {
      fetchOptions: { signal: ctx.signal },
    }).$inspect();

    if (!result.ok) {
      return {
        content: [{ type: "text", text: result.error.message }],
        isError: true,
      };
    }

    const value = result.value;

    return formatResult(value, apiCall);
  },
};
