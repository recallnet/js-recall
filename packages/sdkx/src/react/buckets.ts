import { useMutation } from "@tanstack/react-query";
import { default as axios } from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AbiStateMutability, Address, ContractFunctionArgs } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { getChain, getObjectApiUrl } from "@recallnet/chains";
import { bucketManagerAbi, bucketManagerAddress } from "@recallnet/contracts";

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

  const baseConfig = useMemo(
    () =>
      ({
        address: contractAddress,
        abi: bucketManagerAbi,
        functionName: "createBucket",
      }) as const,
    [contractAddress],
  );

  const createBucket = useCallback(
    (options?: { owner: Address; metadata?: Record<string, string> }) =>
      writeContract({
        ...baseConfig,
        args: options
          ? options.metadata
            ? [options.owner, convertMetadataToAbiParams(options.metadata)]
            : [options.owner]
          : [],
      }),
    [writeContract, baseConfig],
  );

  const createBucketAsync = useCallback(
    (options?: { owner: Address; metadata?: Record<string, string> }) =>
      writeContractAsync({
        ...baseConfig,
        args: options
          ? options.metadata
            ? [options.owner, convertMetadataToAbiParams(options.metadata)]
            : [options.owner]
          : [],
      }),
    [writeContractAsync, baseConfig],
  );

  return { createBucket, createBucketAsync, ...rest };
}

export interface AddFileArgs {
  bucket: Address;
  from: Address;
  key: string;
  file: File;
  options?: {
    ttl?: bigint;
    metadata?: Record<string, string>;
    overwrite?: boolean;
    onUploadProgress?: (progress: number) => void;
  };
}

export function useAddFile() {
  const [args, setArgs] = useState<AddFileArgs | undefined>(undefined);

  const chainId = useChainId();
  const contractAddress =
    bucketManagerAddress[chainId as keyof typeof bucketManagerAddress];

  const chain = getChain(chainId);
  const objectApiUrl = getObjectApiUrl(chain);

  const {
    writeContract,
    isPending: writePending,
    error: writeError,
    data: writeTxnHash,
  } = useWriteContract();

  const {
    data: writeReceipt,
    isLoading: writeReceiptLoading,
    error: writeReceiptError,
  } = useWaitForTransactionReceipt({
    hash: writeTxnHash,
  });

  const {
    mutate: upload,
    isPending: uploadPending,
    data: uploadRes,
    error: uploadError,
  } = useMutation({
    mutationFn: uploadFile,
  });

  useEffect(() => {
    if (uploadRes && args) {
      const metadata = convertMetadataToAbiParams(args.options?.metadata ?? {});
      const params = {
        source: uploadRes.node_id,
        key: args.key,
        blobHash: uploadRes.hash,
        recoveryHash: "",
        size: BigInt(args.file.size),
        ttl: args.options?.ttl ?? 0n,
        metadata,
        overwrite: args.options?.overwrite ?? false,
        from: args.from,
      };
      return writeContract({
        address: contractAddress,
        abi: bucketManagerAbi,
        functionName: "addObject",
        args: [args.bucket, params],
      });
    }
  }, [args, contractAddress, uploadRes, writeContract]);

  const addFile = useCallback(
    (args: AddFileArgs) => {
      setArgs(args);
      upload({
        file: args.file,
        objectApiUrl,
        onProgress: args.options?.onUploadProgress,
      });
    },
    [objectApiUrl, upload],
  );

  const isPending = uploadPending || writePending || writeReceiptLoading;
  const isError = !!uploadError || !!writeError || !!writeReceiptError;
  const error = uploadError || writeError || writeReceiptError;
  const data =
    uploadRes && writeReceipt
      ? {
          upload: uploadRes,
          receipt: writeReceipt,
        }
      : undefined;
  const isSuccess = uploadRes && writeReceipt;

  return { addFile, isPending, isSuccess, isError, error, data };
}

export function useDeleteObject() {
  const chainId = useChainId();
  const contractAddress =
    bucketManagerAddress[chainId as keyof typeof bucketManagerAddress];

  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const baseConfig = useMemo(
    () =>
      ({
        address: contractAddress,
        abi: bucketManagerAbi,
        functionName: "deleteObject",
      }) as const,
    [contractAddress],
  );

  const deleteObject = useCallback(
    (bucket: Address, from: Address, key: string) =>
      writeContract({
        ...baseConfig,
        args: [bucket, key, from],
      }),
    [writeContract, baseConfig],
  );

  const deleteObjectAsync = useCallback(
    (bucket: Address, from: Address, key: string) =>
      writeContractAsync({
        ...baseConfig,
        args: [bucket, key, from],
      }),
    [writeContractAsync, baseConfig],
  );

  return { deleteObject, deleteObjectAsync, ...rest };
}

function convertMetadataToAbiParams(
  value: Record<string, string>,
): { key: string; value: string }[] {
  return Object.entries(value).map(([key, value]) => ({ key, value }));
}

// TODO: Can only be called from portal web app for now because it relays the upload through the portal API.
async function uploadFile(variables: {
  file: File;
  objectApiUrl: string;
  onProgress?: (progress: number) => void;
}) {
  const f = new FormData();
  f.append("size", variables.file.size.toString());
  f.append("data", variables.file);

  const [uploadRes, nodeInfo] = await Promise.all([
    axios.post<{ hash: string; metadata_hash: string }>("/api/objects", f, {
      onUploadProgress: (e) => {
        const progress = e.total ? Math.round((e.loaded * 100) / e.total) : 0;
        variables.onProgress?.(progress);
      },
    }),
    axios.get<{
      node_id: string;
      info: {
        relay_url: string;
        direct_addresses: string[];
      };
    }>(`${variables.objectApiUrl}/v1/node`),
  ]);
  return { ...uploadRes.data, ...nodeInfo.data };
}
