/*
 * Code generated by Speakeasy (https://speakeasy.com). DO NOT EDIT.
 */
import { competitionGetApiCompetitions } from "../../funcs/competitionGetApiCompetitions.js";
import * as operations from "../../models/operations/index.js";
import { ToolDefinition, formatResult } from "../tools.js";

const args = {
  request: operations.GetApiCompetitionsRequest$inboundSchema,
};

export const tool$competitionGetApiCompetitions: ToolDefinition<typeof args> = {
  name: "competition-get-api-competitions",
  description: `Get upcoming competitions

Get all competitions`,
  args,
  tool: async (client, args, ctx) => {
    const [result, apiCall] = await competitionGetApiCompetitions(
      client,
      args.request,
      { fetchOptions: { signal: ctx.signal } },
    ).$inspect();

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
