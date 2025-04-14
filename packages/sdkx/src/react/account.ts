import { useCallback } from "react";
import { Address } from "viem";
import { toHex } from "viem";
import { useChainId, useWriteContract } from "wagmi";

import {
  gatewayManagerFacetAbi,
  gatewayManagerFacetAddress,
} from "@recallnet/contracts";
import { AddressDelegated } from "@recallnet/fvm/address";

export function useWithdraw() {
  const chainId = useChainId();

  const contractAddress =
    gatewayManagerFacetAddress[
      chainId as keyof typeof gatewayManagerFacetAddress
    ];
  const { writeContract, ...rest } = useWriteContract();

  const withdraw = useCallback(
    (recipient: Address, amount: bigint) => {
      writeContract({
        address: contractAddress,
        abi: gatewayManagerFacetAbi,
        functionName: "release",
        args: [addressToFvmAddressTyped(recipient)],
        value: amount,
      });
    },
    [contractAddress, writeContract],
  );

  return { withdraw, ...rest };
}

// Convert an EVM address to a Solidity-style FVM address struct
function addressToFvmAddressTyped(address: Address) {
  const addr = AddressDelegated.fromEthAddress(address);
  return { addrType: addr.getProtocol(), payload: toHex(addr.getPayload()) };
}
