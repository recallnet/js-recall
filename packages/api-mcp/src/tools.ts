import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { privateKeyToAccount } from "viem/accounts";

import { ApiSDKCore } from "@recallnet/api-sdk/core.js";
import { authGetApiAuthAgentNonce } from "@recallnet/api-sdk/funcs/authGetApiAuthAgentNonce.js";
import { authPostApiAuthVerify } from "@recallnet/api-sdk/funcs/authPostApiAuthVerify.js";
import {
  ToolDefinition,
  formatResult,
} from "@recallnet/api-sdk/mcp-server/tools.js";

// Import the proper response type
type AgentNonceResponse = {
  nonce: string;
};

/**
 * Create verification message and signature for agent wallet verification
 * @param privateKey The private key to sign with
 * @param nonce The nonce to include in the verification message
 * @param domain The domain for verification (defaults to API domain from environment)
 * @returns Object with message and signature
 */
async function createAgentVerificationSignature(
  privateKey: string,
  nonce: string,
  domain?: string,
): Promise<{ message: string; signature: string }> {
  const timestamp = new Date().toISOString();
  const verificationDomain =
    domain || process.env.API_DOMAIN || "api.recall.net";

  const message = `VERIFY_WALLET_OWNERSHIP
Timestamp: ${timestamp}
Domain: ${verificationDomain}
Purpose: WALLET_VERIFICATION
Nonce: ${nonce}`;

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const signature = await account.signMessage({ message });

  return { message, signature };
}

/**
 * Tool for getting agent nonce for wallet verification
 */
export const tool$authGetApiAuthAgentNonce: ToolDefinition = {
  name: "auth-get-api-auth-agent-nonce",
  description: `Get agent nonce for wallet verification

Retrieves a unique nonce that must be included in the wallet verification message.
The nonce expires after 10 minutes and can only be used once.

Requires agent authentication via API key.`,
  tool: async (client: ApiSDKCore, extra: RequestHandlerExtra) => {
    try {
      // Get agent nonce
      const [result, apiCall] = await authGetApiAuthAgentNonce(
        client,
        { agentApiKey: client._options.bearerAuth as string },
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
            text: `Error getting agent nonce: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
};

/**
 * Tool for verifying agent wallet ownership via custom message signature
 */
export const tool$authPostApiAuthVerify: ToolDefinition = {
  name: "auth-post-api-auth-verify",
  description: `Verify agent wallet ownership

Automatically constructs and signs a verification message using the configured private key, 
then submits it to verify wallet ownership for the authenticated agent.

This tool will automatically:
1. Get a nonce for verification
2. Create a verification message with the nonce
3. Sign the message with the private key  
4. Submit the verification

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
      // Step 1: Get a nonce for verification
      const [nonceResult] = await authGetApiAuthAgentNonce(
        client,
        { agentApiKey: client._options.bearerAuth as string },
        { fetchOptions: { signal: extra.signal } },
      ).$inspect();

      if (!nonceResult.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting nonce: ${nonceResult.error.message}`,
            },
          ],
          isError: true,
        };
      }

      const nonce = (nonceResult.value as AgentNonceResponse).nonce;
      if (!nonce) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to retrieve nonce from response",
            },
          ],
          isError: true,
        };
      }

      // Step 2: Create verification message and signature with nonce
      const { message, signature } = await createAgentVerificationSignature(
        privateKey,
        nonce,
      );

      // Step 3: Call API to verify wallet
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
            text: `Error during wallet verification: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
};
