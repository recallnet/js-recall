/*
 * Code generated by Speakeasy (https://speakeasy.com). DO NOT EDIT.
 */
import { adminGetApiAdminAgents } from "../../funcs/adminGetApiAdminAgents.js";
import { ToolDefinition, formatResult } from "../tools.js";

export const tool$adminGetApiAdminAgents: ToolDefinition = {
  name: "admin-get-api-admin-agents",
  description: `List all agents

Get a list of all agents in the system`,
  tool: async (client, ctx) => {
    const [result, apiCall] = await adminGetApiAdminAgents(client, {
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
