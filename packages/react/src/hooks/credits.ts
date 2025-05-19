import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { Address } from "viem";
import {
  useAccount,
  useChainId,
  useConfig,
  useReadContract,
  useWriteContract,
} from "wagmi";

import {
  iBlobsFacadeAbi,
  iCreditFacadeAbi,
  iCreditFacadeAddress,
} from "@recallnet/contracts";

import { createAccount } from "../actions/credits.js";

export function useCreditAccount(forAddress?: Address) {
  const config = useConfig();
  const chainId = useChainId();
  const { address: accountAddress } = useAccount();

  const address = forAddress ?? accountAddress;

  const contractAddress =
    iCreditFacadeAddress[chainId as keyof typeof iCreditFacadeAddress];

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
    abi: iCreditFacadeAbi,
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
      mutate({ address, config });
    }
  }, [address, config, mutate, isActorNotFound]);

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
    iCreditFacadeAddress[chainId as keyof typeof iCreditFacadeAddress];

  return useReadContract({
    address: contractAddress,
    abi: iCreditFacadeAbi,
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
    iCreditFacadeAddress[chainId as keyof typeof iCreditFacadeAddress];

  return useReadContract({
    address: contractAddress,
    abi: iCreditFacadeAbi,
    functionName: "getAccount",
    args: [address!],
    query: {
      enabled: !!address,
    },
  });
}

export function useCreditStats() {
  const chainId = useChainId();

  const contractAddress =
    iCreditFacadeAddress[chainId as keyof typeof iCreditFacadeAddress];

  return useReadContract({
    address: contractAddress,
    abi: iBlobsFacadeAbi,
    functionName: "getStats",
  });
}

export function useApproveCredit() {
  const chainId = useChainId();

  const contractAddress =
    iCreditFacadeAddress[chainId as keyof typeof iCreditFacadeAddress];

  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const baseConfig = useMemo(
    () =>
      ({
        address: contractAddress,
        abi: iCreditFacadeAbi,
        functionName: "approveCredit",
      }) as const,
    [contractAddress],
  );

  const approveCredit = useCallback(
    (
      to: Address,
      options?: {
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
          args: [to],
        });
      } else {
        writeContract({
          ...baseConfig,
          args: [to],
        });
      }
    },
    [baseConfig, writeContract],
  );

  const approveCreditAsync = useCallback(
    (
      to: Address,
      options?: {
        limits: {
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
            to,
            [],
            options.limits.creditLimit,
            options.limits.gasFeeLimit,
            options.limits.ttl,
          ],
        });
      } else {
        return writeContractAsync({
          ...baseConfig,
          args: [to],
        });
      }
    },
    [baseConfig, writeContractAsync],
  );

  return { approveCredit, approveCreditAsync, ...rest };
}

export function useBuyCredit() {
  const chainId = useChainId();

  const contractAddress =
    iCreditFacadeAddress[chainId as keyof typeof iCreditFacadeAddress];

  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const baseConfig = useMemo(
    () =>
      ({
        address: contractAddress,
        abi: iCreditFacadeAbi,
        functionName: "buyCredit",
      }) as const,
    [contractAddress],
  );

  const buyCredit = useCallback(
    (attoRecallAmount: bigint, recipient?: Address) =>
      writeContract({
        ...baseConfig,
        args: recipient ? [recipient] : [],
        value: attoRecallAmount,
      }),
    [baseConfig, writeContract],
  );

  const buyCreditAsync = useCallback(
    (attoRecallAmount: bigint, recipient?: Address) =>
      writeContractAsync({
        ...baseConfig,
        args: recipient ? [recipient] : [],
        value: attoRecallAmount,
      }),
    [baseConfig, writeContractAsync],
  );

  return { buyCredit, buyCreditAsync, ...rest };
}

export function useRevokeCreditApproval() {
  const chainId = useChainId();

  const contractAddress =
    iCreditFacadeAddress[chainId as keyof typeof iCreditFacadeAddress];

  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const baseConfig = useMemo(
    () =>
      ({
        address: contractAddress,
        abi: iCreditFacadeAbi,
        functionName: "revokeCredit",
      }) as const,
    [contractAddress],
  );

  const revokeCredit = useCallback(
    (to: Address, from?: Address) =>
      writeContract({
        ...baseConfig,
        args: from ? [from, to] : [to],
      }),
    [baseConfig, writeContract],
  );

  const revokeCreditAsync = useCallback(
    (to: Address, from?: Address) =>
      writeContractAsync({
        ...baseConfig,
        args: from ? [from, to] : [to],
      }),
    [baseConfig, writeContractAsync],
  );

  return { revokeCredit, revokeCreditAsync, ...rest };
}

export function useSetAccountSponsor() {
  const chainId = useChainId();

  const contractAddress =
    iCreditFacadeAddress[chainId as keyof typeof iCreditFacadeAddress];

  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const baseConfig = useMemo(
    () =>
      ({
        address: contractAddress,
        abi: iCreditFacadeAbi,
        functionName: "setAccountSponsor",
      }) as const,
    [contractAddress],
  );

  const setAccountSponsor = useCallback(
    (sponsor: Address) =>
      writeContract({
        ...baseConfig,
        args: [sponsor],
      }),
    [baseConfig, writeContract],
  );

  const setAccountSponsorAsync = useCallback(
    (sponsor: Address) =>
      writeContractAsync({
        ...baseConfig,
        args: [sponsor],
      }),
    [baseConfig, writeContractAsync],
  );

  return {
    setAccountSponsor,
    setAccountSponsorAsync,
    ...rest,
  };
}

export function useDeleteAccountSponsor() {
  const chainId = useChainId();

  const contractAddress =
    iCreditFacadeAddress[chainId as keyof typeof iCreditFacadeAddress];

  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const baseConfig = useMemo(
    () =>
      ({
        address: contractAddress,
        abi: iCreditFacadeAbi,
        functionName: "setAccountSponsor",
      }) as const,
    [contractAddress],
  );

  const deleteAccountSponsor = useCallback(
    () =>
      writeContract({
        ...baseConfig,
        args: ["0x0000000000000000000000000000000000000000"],
      }),
    [baseConfig, writeContract],
  );

  const deleteAccountSponsorAsync = useCallback(
    () =>
      writeContractAsync({
        ...baseConfig,
        args: ["0x0000000000000000000000000000000000000000"],
      }),
    [baseConfig, writeContractAsync],
  );

  return {
    deleteAccountSponsor,
    deleteAccountSponsorAsync,
    ...rest,
  };
}
