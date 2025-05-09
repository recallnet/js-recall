import { useMutation } from "@tanstack/react-query";
import { default as axios } from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AbiStateMutability, Address, ContractFunctionArgs, Hex } from "viem";
import {
  useAccount,
  useChainId,
  useInfiniteReadContracts,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { getChain, getObjectApiUrl } from "@recallnet/chains";
import {
  iBucketFacadeAbi,
  iMachineFacadeAbi,
  iMachineFacadeAddress,
} from "@recallnet/contracts";

export function useListBuckets(owner?: Address) {
  const chainId = useChainId();
  const { address } = useAccount();
  const contractAddress =
    iMachineFacadeAddress[chainId as keyof typeof iMachineFacadeAddress];

  const arg = owner ?? address;

  return useReadContract({
    address: contractAddress,
    abi: iMachineFacadeAbi,
    functionName: "listBuckets",
    args: [arg!],
    query: {
      enabled: !!arg,
    },
  });
}

export type QueryObjectsArgs = ContractFunctionArgs<
  typeof iBucketFacadeAbi,
  AbiStateMutability,
  "queryObjects"
>;

export function useInfiniteQueryObjects(
  bucket: Address,
  options?: {
    prefix?: string;
    delimiter?: string;
    pageSize?: number;
    enabled?: boolean | (() => boolean);
  },
) {
  const prefix = options?.prefix ?? "";
  const delimiter = options?.delimiter ?? "/";

  return useInfiniteReadContracts({
    cacheKey: `queryObjectsResults_${bucket}_${prefix}`,
    contracts(pageParam) {
      const args = [
        prefix,
        delimiter,
        pageParam,
        BigInt(options?.pageSize ?? 100),
      ] satisfies QueryObjectsArgs;
      return [
        {
          address: bucket,
          abi: iBucketFacadeAbi,
          functionName: "queryObjects",
          args: args,
        },
      ];
    },
    query: {
      enabled: options?.enabled,
      initialPageParam: "",
      select: (data) => ({
        ...data,
        pages: data.pages.map((page) => page[0]),
      }),
      getNextPageParam: (lastPage) => {
        return lastPage.length > 0
          ? lastPage[lastPage.length - 1]?.result?.nextKey || undefined
          : null;
      },
    },
  });
}

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
  const args = [
    options?.prefix ?? "",
    options?.delimiter ?? "/",
    options?.startKey ?? "",
    BigInt(options?.limit ?? 100),
  ] satisfies QueryObjectsArgs;

  return useReadContract({
    address: bucket,
    abi: iBucketFacadeAbi,
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
  return useReadContract({
    address: bucket,
    abi: iBucketFacadeAbi,
    functionName: "getObject",
    args: [key],
    query: {
      enabled: options?.enabled,
    },
  });
}

export function useCreateBucket() {
  const chainId = useChainId();
  const contractAddress =
    iMachineFacadeAddress[chainId as keyof typeof iMachineFacadeAddress];

  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const baseConfig = useMemo(
    () =>
      ({
        address: contractAddress,
        abi: iMachineFacadeAbi,
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
      const params = [
        `0x${uploadRes.node_id}`, // The response is a hex value but without the prefix (passed as bytes32)
        args.key,
        uploadRes.hash as Hex, // TODO: convert from base32 to hex (bytes32)
        uploadRes.metadata_hash as Hex, // TODO: convert from base32 to hex (bytes32)
        BigInt(args.file.size),
        args.options?.ttl ?? 0n,
        metadata,
        args.options?.overwrite ?? false,
      ] as const;
      return writeContract({
        address: args.bucket,
        abi: iBucketFacadeAbi,
        functionName: "addObject",
        args: params,
      });
    }
  }, [args, uploadRes, writeContract]);

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
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const deleteObject = useCallback(
    (bucket: Address, key: string) =>
      writeContract({
        address: bucket,
        abi: iBucketFacadeAbi,
        functionName: "deleteObject",
        args: [key],
      }),
    [writeContract],
  );

  const deleteObjectAsync = useCallback(
    (bucket: Address, key: string) =>
      writeContractAsync({
        address: bucket,
        abi: iBucketFacadeAbi,
        functionName: "deleteObject",
        args: [key],
      }),
    [writeContractAsync],
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
    axios.post<{ hash: string; metadata_hash: string }>(
      `${variables.objectApiUrl}/v1/objects`,
      f,
      {
        onUploadProgress: (e) => {
          const progress = e.total ? Math.round((e.loaded * 100) / e.total) : 0;
          variables.onProgress?.(progress);
        },
      },
    ),
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
