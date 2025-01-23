import { Address } from "viem";
import {
  UseWriteContractReturnType,
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
} from "wagmi";

import { creditManagerAbi, creditManagerAddress } from "@recall/contracts";

export function useCreditAccount(forAddress?: Address) {
  const chainId = useChainId();
  const { address: accountAddress } = useAccount();

  const address = forAddress ?? accountAddress;

  const contractAddress =
    creditManagerAddress[chainId as keyof typeof creditManagerAddress];

  return useReadContract({
    address: contractAddress,
    abi: creditManagerAbi,
    functionName: "getAccount",
    args: [address!],
    query: {
      enabled: !!address,
    },
  });
}

export function useCreditBalance(forAddress?: Address) {
  const chainId = useChainId();
  const { address: accountAddress } = useAccount();

  const address = forAddress ?? accountAddress;

  const contractAddress =
    creditManagerAddress[chainId as keyof typeof creditManagerAddress];

  return useReadContract({
    address: contractAddress,
    abi: creditManagerAbi,
    functionName: "getCreditBalance",
    args: [address!],
    query: {
      enabled: !!address,
    },
  });
}

type UseBuyCreditReturnType = Omit<
  UseWriteContractReturnType,
  "writeContract" | "writeContractAsync"
> & {
  buyCredit: (recallAmount: bigint, recipient?: Address) => void;
  buyCreditAsync: (
    recallAmount: bigint,
    recipient?: Address,
  ) => Promise<Address>;
};

export function useBuyCredit(): UseBuyCreditReturnType {
  const chainId = useChainId();

  const contractAddress =
    creditManagerAddress[chainId as keyof typeof creditManagerAddress];

  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const buyCredit = (recallAmount: bigint, recipient?: Address) =>
    writeContract({
      address: contractAddress,
      abi: creditManagerAbi,
      functionName: "buyCredit",
      args: recipient ? [recipient] : [],
      value: recallAmount,
    });

  const buyCreditAsync = (recallAmount: bigint, recipient?: Address) =>
    writeContractAsync({
      address: contractAddress,
      abi: creditManagerAbi,
      functionName: "buyCredit",
      args: recipient ? [recipient] : [],
      value: recallAmount,
    });

  return { buyCredit, buyCreditAsync, ...rest };
}
