import { track } from "@vercel/analytics/react";
import { z } from "zod";

import {
  ChainName,
  getChain,
  getExplorerUrl,
  getRegistrarUrl,
} from "@recallnet/chains";

const chainName = (process.env.NEXT_PUBLIC_CHAIN_NAME ||
  "testnet") as ChainName;
const chain = getChain(chainName);
const registrarUrl = getRegistrarUrl(chain);
const explorerUrl = getExplorerUrl(chain);

export interface RequestTokensResult {
  txHash: string;
  txUrl: string;
}

export interface RequestTokensState {
  result?: RequestTokensResult;
  error?: string;
}

const requestTokensSchema = z.object({
  address: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid EVM address"),
  ts_response: z.string().min(1, "Turnstile response is required"),
});

export async function requestTokens(
  _: RequestTokensState,
  formData: FormData,
): Promise<RequestTokensState> {
  try {
    const parsedData = requestTokensSchema.safeParse({
      address: formData.get("address"),
      ts_response: formData.get("cf-turnstile-response"),
    });
    if (!parsedData.success) {
      throw new Error(parsedData.error.message);
    }

    const dripUrl = `${registrarUrl}/drip`;
    const explorerTxnUrl = `${explorerUrl}/tx`;

    const headers = new Headers();
    headers.append("Content-Type", "application/json");

    const body = JSON.stringify({ ...parsedData.data, wait: true });

    const resp = await fetch(dripUrl, {
      method: "POST",
      headers,
      body,
    });
    if (resp.ok) {
      const json = (await resp.json()) as { tx_hash: string };
      const result = {
        txHash: json.tx_hash,
        txUrl: `${explorerTxnUrl}/${json.tx_hash}`,
      };
      await track("faucet-sent", { address: parsedData.data.address });
      return { result };
    } else {
      const text = await resp.text();
      await track("faucet-error", {
        status: resp.status,
        error: text,
      });
      if (resp.status === 400) {
        return { error: `Bad request: ${text}` };
      } else if (resp.status === 429) {
        return {
          error:
            "You already received faucet tokens recently. Try again later.",
        };
      } else if (resp.status === 503) {
        return { error: "The faucet is empty. Try again later." };
      } else {
        return { error: `Other error: ${text}` };
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : JSON.stringify(e);
    track("internal-error", { error: message });
    return { error: `Internal error: ${message}` };
  }
}
