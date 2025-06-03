import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { privateKeyToAccount } from "viem/accounts";

import { ApiSDKCore } from "@recallnet/api-sdk/core.js";
import { authPostApiAuthVerify } from "@recallnet/api-sdk/funcs/authPostApiAuthVerify.js";
import {
  ToolDefinition,
  formatResult,
} from "@recallnet/api-sdk/mcp-server/tools.js";

/**
 * Create verification message and signature for agent wallet verification
 * @param privateKey The private key to sign with
 * @param domain The domain for verification (defaults to API domain from environment)
 * @returns Object with message and signature
 */
async function createAgentVerificationSignature(
  privateKey: string,
  domain?: string,
): Promise<{ message: string; signature: string }> {
  const timestamp = new Date().toISOString();
  const verificationDomain =
    domain || process.env.API_DOMAIN || "api.recall.net";

  const message = `VERIFY_WALLET_OWNERSHIP
Timestamp: ${timestamp}
Domain: ${verificationDomain}
Purpose: WALLET_VERIFICATION`;

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const signature = await account.signMessage({ message });

  return { message, signature };
}

/**
 * Tool for verifying agent wallet ownership via custom message signature
 */
export const tool$authPostApiAuthVerify: ToolDefinition = {
  name: "auth-post-api-auth-verify",
  description: `Verify agent wallet ownership

Automatically constructs and signs a verification message using the configured private key, 
then submits it to verify wallet ownership for the authenticated agent.

Requires WALLET_PRIVATE_KEY environment variable to be set.`,
  tool: async (client: ApiSDKCore, extra: RequestHandlerExtra) => {
    const privateKey = process.env.WALLET_PRIVATE_KEY;

    if (!privateKey) {
      return {
        content: [
          {
            type: "text",
            text: "WALLET_PRIVATE_KEY environment variable is required for wallet verification",
          },
        ],
        isError: true,
      };
    }

    try {
      // Create verification message and signature
      const { message, signature } =
        await createAgentVerificationSignature(privateKey);

      // Call API to verify wallet
      const [result, apiCall] = await authPostApiAuthVerify(
        client,
        { agentApiKey: client._options.bearerAuth as string },
        { message, signature },
        { fetchOptions: { signal: extra.signal } },
      ).$inspect();

      if (!result.ok) {
        return {
          content: [{ type: "text", text: result.error.message }],
          isError: true,
        };
      }

      const value = result.value;
      return formatResult(value, apiCall);
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating verification signature: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
};
