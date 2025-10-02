"use client";

import { useMemo } from "react";
import { type Address, getAddress } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { StakingAbi } from "@/abi/Staking";
import { RECALL_STAKING_CONTRACT_ADDRESS } from "@/constants";

/**
 * Hook to get the staking contract address for the current chain
 * @returns The contract address for the current chain, or undefined if unsupported
 */
export const useStakingContractAddress = (): Address => {
  const chainId = useChainId();

  return useMemo(() => {
    if (!chainId) {
      throw new Error("Chain ID not found");
    }
    const addressHex = RECALL_STAKING_CONTRACT_ADDRESS[chainId];

    if (!addressHex) {
      throw new Error("Staking contract address not found");
    }

    return getAddress(addressHex);
  }, [chainId]);
};

/**
 * Stake information structure returned by the contract
 */
type StakeInfo = {
  amount: bigint;
  startTime: bigint;
  lockupEndTime: bigint;
  withdrawAllowedTime: bigint;
};

/**
 * Stake information with token ID returned by getUserStakes
 */
type StakeInfoWithId = {
  tokenId: bigint;
  amount: bigint;
  startTime: bigint;
  lockupEndTime: bigint;
  withdrawAllowedTime: bigint;
};

/**
 * Return type for useReadContract calls
 */
type ReadContractResult<T> = {
  data: T | undefined;
  error: Error | null;
  isError: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  refetch: () => void;
};

/**
 * Hook return type for useStakingContract (write operations only)
 */
type UseStakingContractReturn = {
  stake: (amount: bigint, duration: bigint) => Promise<void>;
  withdraw: (tokenId: bigint) => Promise<void>;
  unstake: (tokenId: bigint, amountToUnstake?: bigint) => Promise<void>;
  relock: (
    tokenId: bigint,
    newLockDuration: bigint,
    newLockAmount?: bigint,
  ) => Promise<void>;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  writeError: Error | null;
  transactionHash: `0x${string}` | undefined;
};

export const useStakingContract = (): UseStakingContractReturn => {
  const contractAddress = useStakingContractAddress();
  const {
    writeContract,
    isPending,
    error: writeError,
    data: transactionHash,
  } = useWriteContract();

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: transactionHash,
    });

  const stake = async (amount: bigint, duration: bigint) => {
    return writeContract({
      address: contractAddress,
      abi: StakingAbi,
      functionName: "stake",
      args: [amount, duration],
    });
  };

  const withdraw = async (tokenId: bigint) => {
    return writeContract({
      address: contractAddress,
      abi: StakingAbi,
      functionName: "withdraw",
      args: [tokenId],
    });
  };

  const unstake = async (tokenId: bigint, amountToUnstake?: bigint) => {
    if (amountToUnstake !== undefined) {
      return writeContract({
        address: contractAddress,
        abi: StakingAbi,
        functionName: "unstake",
        args: [tokenId, amountToUnstake],
      });
    } else {
      return writeContract({
        address: contractAddress,
        abi: StakingAbi,
        functionName: "unstake",
        args: [tokenId],
      });
    }
  };

  const relock = async (
    tokenId: bigint,
    newLockDuration: bigint,
    newLockAmount?: bigint,
  ) => {
    if (newLockAmount !== undefined) {
      return writeContract({
        address: contractAddress,
        abi: StakingAbi,
        functionName: "relock",
        args: [tokenId, newLockDuration, newLockAmount],
      });
    } else {
      return writeContract({
        address: contractAddress,
        abi: StakingAbi,
        functionName: "relock",
        args: [tokenId, newLockDuration],
      });
    }
  };

  return {
    stake,
    withdraw,
    unstake,
    relock,
    isPending,
    isConfirming,
    isConfirmed,
    writeError,
    transactionHash,
  };
};

/**
 * Hook to get user stakes data
 * @returns Read contract result with user stakes
 */
export const useUserStakes = (): ReadContractResult<StakeInfoWithId[]> => {
  const { address, isConnected } = useAccount();
  const contractAddress = useStakingContractAddress();

  return useReadContract({
    address: contractAddress,
    abi: StakingAbi,
    functionName: "getUserStakes",
    args: [address!],
    query: { enabled: isConnected && Boolean(contractAddress) },
  });
};

/**
 * Hook to get stake info for a specific token ID
 * @param tokenId - The token ID to get stake info for
 * @returns Read contract result with stake info
 */
export const useStakeInfo = (
  tokenId: bigint,
): ReadContractResult<StakeInfo> => {
  const contractAddress = useStakingContractAddress();

  return useReadContract({
    address: contractAddress,
    abi: StakingAbi,
    functionName: "stakeInfo",
    args: [tokenId],
    query: { enabled: Boolean(contractAddress) },
  });
};
