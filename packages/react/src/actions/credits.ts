import { Address } from "viem";
import { Config } from "wagmi";
import { getChainId, readContract } from "wagmi/actions";

import { getChain, getRegistrarUrl } from "@recallnet/chains";
import { iCreditFacadeAbi, iCreditFacadeAddress } from "@recallnet/contracts";

export async function accountExists(config: Config, address: Address) {
  try {
    const chainId = getChainId(config);
    await readContract(config, {
      abi: iCreditFacadeAbi,
      address:
        iCreditFacadeAddress[chainId as keyof typeof iCreditFacadeAddress],
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

export async function createAccount({
  config,
  address,
}: {
  config: Config;
  address: Address;
}) {
  const chainId = getChainId(config);
  const registrarUrl = getRegistrarUrl(getChain(chainId));

  const response = await fetch(`${registrarUrl}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address: address,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to register account: " + response.statusText);
  }
  const result = await response.json();
  return result;
}
