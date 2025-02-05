import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { Address, Hash } from "viem";
import {
  UseWriteContractReturnType,
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
} from "wagmi";

import { creditManagerAbi, creditManagerAddress } from "@recall/contracts";

import { createAccount } from "../actions/credits.js";

export function useCreditAccount(forAddress?: Address) {
  const chainId = useChainId();
  const { address: accountAddress } = useAccount();

  const address = forAddress ?? accountAddress;

  const contractAddress =
    creditManagerAddress[chainId as keyof typeof creditManagerAddress];

  const {
    error: createAccountError,
    isError: isCreateAccountError,
    isPaused: isCreateAccountPaused,
    isPending: isCreateAccountPending,
    isSuccess: isCreateAccountSuccess,
    status: createAccountStatus,
    mutate,
  } = useMutation({ mutationFn: createAccount });

  const {
    error,
    isError,
    isPaused,
    isPending,
    isSuccess,
    status,
    refetch,
    ...rest
  } = useReadContract({
    address: contractAddress,
    abi: creditManagerAbi,
    functionName: "getAccount",
    args: [address!],
    query: {
      enabled: !!address,
    },
  });

  const isActorNotFound = error?.message.includes(
    "actor::resolve_address -- actor not found",
  );

  useEffect(() => {
    if (address && isActorNotFound) {
      mutate(address);
    }
  }, [address, mutate, isActorNotFound]);

  useEffect(() => {
    if (isCreateAccountSuccess) {
      refetch();
    }
  }, [isCreateAccountSuccess, refetch]);

  return {
    error: isActorNotFound ? null : (error ?? createAccountError),
    isError: isError ?? isCreateAccountError,
    isPaused: isPaused ?? isCreateAccountPaused,
    isPending: isPending ?? isCreateAccountPending,
    isSuccess: isSuccess ?? isCreateAccountSuccess,
    status: createAccountStatus === "idle" ? status : createAccountStatus,
    refetch,
    ...rest,
  };
}

export function useCreditApproval(to: Address, from?: Address) {
  const chainId = useChainId();
  const { address: accountAddress } = useAccount();

  const fromAddress = from ?? accountAddress;

  const contractAddress =
    creditManagerAddress[chainId as keyof typeof creditManagerAddress];

  return useReadContract({
    address: contractAddress,
    abi: creditManagerAbi,
    functionName: "getCreditApproval",
    args: [fromAddress!, to],
    query: {
      enabled: !!fromAddress,
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

export function useCreditStats() {
  const chainId = useChainId();

  const contractAddress =
    creditManagerAddress[chainId as keyof typeof creditManagerAddress];

  return useReadContract({
    address: contractAddress,
    abi: creditManagerAbi,
    functionName: "getCreditStats",
  });
}

type UseApproveCreditReturnType = Omit<
  UseWriteContractReturnType,
  "writeContract" | "writeContractAsync"
> & {
  approveCredit: (
    to: Address,
    options?: {
      from: Address;
      limits?: {
        creditLimit: bigint;
        gasFeeLimit: bigint;
        ttl: bigint;
      };
    },
  ) => void;
  approveCreditAsync: (
    to: Address,
    options?: {
      from: Address;
      limits?: {
        creditLimit: bigint;
        gasFeeLimit: bigint;
        ttl: bigint;
      };
    },
  ) => Promise<Hash>;
};

export function useApproveCredit(): UseApproveCreditReturnType {
  const chainId = useChainId();

  const contractAddress =
    creditManagerAddress[chainId as keyof typeof creditManagerAddress];

  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const baseConfig = {
    address: contractAddress,
    abi: creditManagerAbi,
    functionName: "approveCredit",
  } as const;

  const approveCredit = (
    to: Address,
    options?: {
      from: Address;
      limits?: {
        creditLimit: bigint;
        gasFeeLimit: bigint;
        ttl: bigint;
      };
    },
  ) => {
    if (options?.limits) {
      writeContract({
        ...baseConfig,
        args: [
          options.from,
          to,
          [],
          options.limits.creditLimit,
          options.limits.gasFeeLimit,
          options.limits.ttl,
        ],
      });
    } else if (options) {
      writeContract({
        ...baseConfig,
        args: [options.from, to],
      });
    } else {
      writeContract({
        ...baseConfig,
        args: [to],
      });
    }
  };

  const approveCreditAsync = (
    to: Address,
    options?: {
      from: Address;
      limits?: {
        creditLimit: bigint;
        gasFeeLimit: bigint;
        ttl: bigint;
      };
    },
  ) => {
    if (options?.limits) {
      return writeContractAsync({
        ...baseConfig,
        args: [
          options.from,
          to,
          [],
          options.limits.creditLimit,
          options.limits.gasFeeLimit,
          options.limits.ttl,
        ],
      });
    } else if (options) {
      return writeContractAsync({
        ...baseConfig,
        args: [options.from, to],
      });
    } else {
      return writeContractAsync({
        ...baseConfig,
        args: [to],
      });
    }
  };

  return { approveCredit, approveCreditAsync, ...rest };
}

type UseBuyCreditReturnType = Omit<
  UseWriteContractReturnType,
  "writeContract" | "writeContractAsync"
> & {
  buyCredit: (recallAmount: bigint, recipient?: Address) => void;
  buyCreditAsync: (recallAmount: bigint, recipient?: Address) => Promise<Hash>;
};

export function useBuyCredit(): UseBuyCreditReturnType {
  const chainId = useChainId();

  const contractAddress =
    creditManagerAddress[chainId as keyof typeof creditManagerAddress];

  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const baseConfig = {
    address: contractAddress,
    abi: creditManagerAbi,
    functionName: "buyCredit",
  } as const;

  const buyCredit = (recallAmount: bigint, recipient?: Address) =>
    writeContract({
      ...baseConfig,
      args: recipient ? [recipient] : [],
      value: recallAmount,
    });

  const buyCreditAsync = (recallAmount: bigint, recipient?: Address) =>
    writeContractAsync({
      ...baseConfig,
      args: recipient ? [recipient] : [],
      value: recallAmount,
    });

  return { buyCredit, buyCreditAsync, ...rest };
}

export function useRevokeCreditApproval() {
  const chainId = useChainId();

  const contractAddress =
    creditManagerAddress[chainId as keyof typeof creditManagerAddress];

  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const baseConfig = {
    address: contractAddress,
    abi: creditManagerAbi,
    functionName: "revokeCredit",
  } as const;

  const revokeCredit = (to: Address, from?: Address) =>
    writeContract({
      ...baseConfig,
      args: from ? [from, to] : [to],
    });

  const revokeCreditAsync = (to: Address, from?: Address) =>
    writeContractAsync({
      ...baseConfig,
      args: from ? [from, to] : [to],
    });

  return { revokeCredit, revokeCreditAsync, ...rest };
}

export function useSetAccountSponsor() {
  const chainId = useChainId();

  const contractAddress =
    creditManagerAddress[chainId as keyof typeof creditManagerAddress];

  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const baseConfig = {
    address: contractAddress,
    abi: creditManagerAbi,
    functionName: "setAccountSponsor",
  } as const;

  const setAccountSponsor = (from: Address, sponsor: Address) =>
    writeContract({
      ...baseConfig,
      args: [from, sponsor],
    });

  const setAccountSponsorAsync = (from: Address, sponsor: Address) =>
    writeContractAsync({
      ...baseConfig,
      args: [from, sponsor],
    });

  return {
    setAccountSponsor,
    setAccountSponsorAsync,
    ...rest,
  };
}

export function useDeleteAccountSponsor() {
  const chainId = useChainId();

  const contractAddress =
    creditManagerAddress[chainId as keyof typeof creditManagerAddress];

  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const baseConfig = {
    address: contractAddress,
    abi: creditManagerAbi,
    functionName: "setAccountSponsor",
  } as const;

  const deleteAccountSponsor = (from: Address) =>
    writeContract({
      ...baseConfig,
      args: [from, "0x0000000000000000000000000000000000000000"],
    });

  const deleteAccountSponsorAsync = (from: Address) =>
    writeContractAsync({
      ...baseConfig,
      args: [from, "0x0000000000000000000000000000000000000000"],
    });

  return {
    deleteAccountSponsor,
    deleteAccountSponsorAsync,
    ...rest,
  };
}
