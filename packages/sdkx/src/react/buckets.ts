import { useCallback, useMemo } from "react";
import { AbiStateMutability, Address, ContractFunctionArgs } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
} from "wagmi";

import { bucketManagerAbi, bucketManagerAddress } from "@recall/contracts";

export function useListBuckets(owner?: Address) {
  const chainId = useChainId();
  const { address } = useAccount();
  const contractAddress =
    bucketManagerAddress[chainId as keyof typeof bucketManagerAddress];

  const arg = owner ?? address;

  return useReadContract({
    address: contractAddress,
    abi: bucketManagerAbi,
    functionName: "listBuckets",
    args: [arg!],
    query: {
      enabled: !!arg,
    },
  });
}

export type QueryObjectsArgs = ContractFunctionArgs<
  typeof bucketManagerAbi,
  AbiStateMutability,
  "queryObjects"
>;

export function useQueryObjects(
  bucket: Address,
  options?: {
    prefix?: string;
    delimiter?: string;
    startKey?: string;
    limit?: number;
    enabled?: boolean | (() => boolean);
  },
) {
  const chainId = useChainId();
  const contractAddress =
    bucketManagerAddress[chainId as keyof typeof bucketManagerAddress];

  const args = [
    bucket,
    options?.prefix ?? "",
    options?.delimiter ?? "/",
    options?.startKey ?? "",
    BigInt(options?.limit ?? 100),
  ] satisfies QueryObjectsArgs;

  return useReadContract({
    address: contractAddress,
    abi: bucketManagerAbi,
    functionName: "queryObjects",
    args: args,
    query: {
      enabled: options?.enabled,
    },
  });
}

export function useGetObject(
  bucket: Address,
  key: string,
  options?: { enabled?: boolean | (() => boolean) },
) {
  const chainId = useChainId();
  const contractAddress =
    bucketManagerAddress[chainId as keyof typeof bucketManagerAddress];

  return useReadContract({
    address: contractAddress,
    abi: bucketManagerAbi,
    functionName: "getObject",
    args: [bucket, key],
    query: {
      enabled: options?.enabled,
    },
  });
}

export function useCreateBucket() {
  const chainId = useChainId();
  const contractAddress =
    bucketManagerAddress[chainId as keyof typeof bucketManagerAddress];

  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const baseConfig = {
    address: contractAddress,
    abi: bucketManagerAbi,
    functionName: "createBucket",
  } as const;

  const createBucket = (options?: {
    owner: Address;
    metadata?: Record<string, string>;
  }) =>
    writeContract({
      ...baseConfig,
      args: options
        ? options.metadata
          ? [options.owner, convertMetadataToAbiParams(options.metadata)]
          : [options.owner]
        : [],
    });

  const createBucketAsync = (options?: {
    owner: Address;
    metadata?: Record<string, string>;
  }) =>
    writeContractAsync({
      ...baseConfig,
      args: options
        ? options.metadata
          ? [options.owner, convertMetadataToAbiParams(options.metadata)]
          : [options.owner]
        : [],
    });

  return { createBucket, createBucketAsync, ...rest };
}

export function useAddObject() {
  const chainId = useChainId();
  const contractAddress =
    bucketManagerAddress[chainId as keyof typeof bucketManagerAddress];

  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const baseConfig = useMemo(
    () =>
      ({
        address: contractAddress,
        abi: bucketManagerAbi,
        functionName: "addObject",
      }) as const,
    [contractAddress],
  );

  const addObject = useCallback(
    (
      bucket: Address,
      key: string,
      source: string,
      blobHash: string,
      size: bigint,
      options?: {
        ttl?: bigint;
        metadata?: Record<string, string>;
        overwrite?: boolean;
      },
    ) => {
      const metadata = convertMetadataToAbiParams(options?.metadata ?? {});
      const params = {
        source,
        key,
        blobHash,
        recoveryHash: "",
        size,
        ttl: options?.ttl ?? 0n,
        metadata,
        overwrite: options?.overwrite ?? false,
      };
      return writeContract({
        ...baseConfig,
        args: [bucket, params],
      });
    },
    [writeContract, baseConfig],
  );

  const addObjectAsync = useCallback(
    (
      bucket: Address,
      key: string,
      source: string,
      blobHash: string,
      size: bigint,
      options?: {
        ttl?: bigint;
        metadata?: Record<string, string>;
        overwrite?: boolean;
      },
    ) => {
      const metadata = convertMetadataToAbiParams(options?.metadata ?? {});
      const params = {
        source,
        key,
        blobHash,
        recoveryHash: "",
        size,
        ttl: options?.ttl ?? 0n,
        metadata,
        overwrite: options?.overwrite ?? false,
      };
      return writeContractAsync({
        ...baseConfig,
        args: [bucket, params],
      });
    },
    [writeContractAsync, baseConfig],
  );

  return { addObject, addObjectAsync, ...rest };
}

export function useDeleteObject() {
  const chainId = useChainId();
  const contractAddress =
    bucketManagerAddress[chainId as keyof typeof bucketManagerAddress];

  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const baseConfig = {
    address: contractAddress,
    abi: bucketManagerAbi,
    functionName: "deleteObject",
  } as const;

  const deleteObject = (bucket: Address, key: string) =>
    writeContract({
      ...baseConfig,
      args: [bucket, key],
    });

  const deleteObjectAsync = (bucket: Address, key: string) =>
    writeContractAsync({
      ...baseConfig,
      args: [bucket, key],
    });

  return { deleteObject, deleteObjectAsync, ...rest };
}

function convertMetadataToAbiParams(
  value: Record<string, string>,
): { key: string; value: string }[] {
  return Object.entries(value).map(([key, value]) => ({ key, value }));
}
