import { Address } from "viem";
import { Config } from "wagmi";
import { getChainId, readContract } from "wagmi/actions";

import { creditManagerAbi, creditManagerAddress } from "@recallnet/contracts";

export async function accountExists(config: Config, address: Address) {
  try {
    const chainId = getChainId(config);
    await readContract(config, {
      abi: creditManagerAbi,
      address:
        creditManagerAddress[chainId as keyof typeof creditManagerAddress],
      functionName: "getAccount",
      args: [address],
    });
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("actor not found")) {
      return false;
    } else {
      throw error;
    }
  }
}

export async function createAccount(address: Address) {
  const response = await fetch(
    "https://faucet.node-0.testnet.recall.network/register",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        address: address,
      }),
    },
  );
  if (!response.ok) {
    throw new Error("Failed to register account: " + response.statusText);
  }
  const result = await response.json();
  return result;
}
