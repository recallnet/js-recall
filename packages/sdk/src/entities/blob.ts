import {
  AbiStateMutability,
  Account,
  Address,
  Chain,
  Client,
  ContractFunctionArgs,
  ContractFunctionExecutionError,
  ContractFunctionReturnType,
  GetContractReturnType,
  GetEventArgs,
  getContract,
  zeroAddress,
} from "viem";

import { blobManagerAbi, blobManagerAddress } from "@recallnet/contracts";
import { MIN_TTL } from "@recallnet/network-constants";

import { RecallClient } from "../client.js";
import { getObjectsNodeInfo } from "../provider/object.js";
import {
  ActorNotFound,
  InvalidValue,
  UnhandledBlobError,
  isActorNotFoundError,
} from "./errors.js";
import { type Result, parseEventFromTransaction } from "./utils.js";

// Used for getBlob()
export type BlobInfo = ContractFunctionReturnType<
  typeof blobManagerAbi,
  AbiStateMutability,
  "getBlob"
>;

// Used for getAddedBlobs()
export type AddedBlobs = ContractFunctionReturnType<
  typeof blobManagerAbi,
  AbiStateMutability,
  "getAddedBlobs"
>;

// Used for getPendingBlobs()
export type PendingBlobs = ContractFunctionReturnType<
  typeof blobManagerAbi,
  AbiStateMutability,
  "getPendingBlobs"
>;

// Used for getPendingBlobsCount()
export type PendingBlobsCount = ContractFunctionReturnType<
  typeof blobManagerAbi,
  AbiStateMutability,
  "getPendingBlobsCount"
>;

// Used for getPendingBytesCount()
export type PendingBytesCount = ContractFunctionReturnType<
  typeof blobManagerAbi,
  AbiStateMutability,
  "getPendingBytesCount"
>;

// Used for getStorageStats()
export type StorageStats = ContractFunctionReturnType<
  typeof blobManagerAbi,
  AbiStateMutability,
  "getStorageStats"
>;

// Used for getBlobStatus()
export type BlobStatus = ContractFunctionReturnType<
  typeof blobManagerAbi,
  AbiStateMutability,
  "getBlobStatus"
>;

// Used for getStorageUsage()
export type StorageUsage = ContractFunctionReturnType<
  typeof blobManagerAbi,
  AbiStateMutability,
  "getStorageUsage"
>;

// Used for getSubnetStats()
export type SubnetStats = ContractFunctionReturnType<
  typeof blobManagerAbi,
  AbiStateMutability,
  "getSubnetStats"
>;

// Used for addBlob()
type AddBlobFullParams = ContractFunctionArgs<
  typeof blobManagerAbi,
  AbiStateMutability,
  "addBlob"
>;

// Used for addBlob()
type AddBlobParams = Extract<
  AddBlobFullParams[0],
  {
    sponsor: Address;
    source: string;
    blobHash: string;
    metadataHash: string;
    subscriptionId: string;
    size: bigint;
    ttl: bigint;
  }
>;

export type AddBlobOptions = {
  ttl?: bigint;
  sponsor?: Address;
};

// Used for getBlob()
type GetBlobParams = ContractFunctionArgs<
  typeof blobManagerAbi,
  AbiStateMutability,
  "getBlob"
>;

// Used for getBlobStatus()
type GetBlobStatusParams = ContractFunctionArgs<
  typeof blobManagerAbi,
  AbiStateMutability,
  "getBlobStatus"
>;

// Used for deleteBlob()
type DeleteBlobParams = ContractFunctionArgs<
  typeof blobManagerAbi,
  AbiStateMutability,
  "deleteBlob"
>;

// Used for addBlob()
export type AddBlobResult = Required<
  GetEventArgs<typeof blobManagerAbi, "AddBlob", { IndexedOnly: false }>
>;

// Used for deleteBlob()
export type DeleteBlobResult = Required<
  GetEventArgs<typeof blobManagerAbi, "DeleteBlob", { IndexedOnly: false }>
>;

// Used for overwriteBlob()
export type OverwriteBlobParams = ContractFunctionArgs<
  typeof blobManagerAbi,
  AbiStateMutability,
  "overwriteBlob"
>;

// Used for overwriteBlob()
export type OverwriteBlobResult = Required<
  GetEventArgs<typeof blobManagerAbi, "OverwriteBlob", { IndexedOnly: false }>
>;

export class BlobManager {
  client: RecallClient;
  contract: GetContractReturnType<typeof blobManagerAbi, Client, Address>;

  constructor(client: RecallClient, contractAddress?: Address) {
    this.client = client;
    const chainId = client.publicClient?.chain?.id;
    if (!chainId) {
      throw new Error("Client chain ID not found");
    }
    const deployedBlobManagerAddress = (
      blobManagerAddress as Record<number, Address>
    )[chainId];
    if (!deployedBlobManagerAddress) {
      throw new Error(`No contract address found for chain ID ${chainId}}`);
    }
    this.contract = getContract({
      abi: blobManagerAbi,
      address: contractAddress || deployedBlobManagerAddress,
      client: {
        public: client.publicClient,
        wallet: client.walletClient!,
      },
    });
  }

  getContract(): GetContractReturnType<typeof blobManagerAbi, Client, Address> {
    return this.contract;
  }

  // Add blob inner
  async addBlobInner(addParams: AddBlobParams): Promise<Result<AddBlobResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for adding blobs");
    }
    try {
      const args = [addParams] satisfies AddBlobFullParams;
      const { request } = await this.contract.simulate.addBlob<Chain, Account>(
        args,
        {
          account: this.client.walletClient.account,
        },
      );
      // TODO: calling `this.contract.write.addBlob(...)` doesn't work, for some reason
      const hash = await this.client.walletClient.writeContract(request);
      const result = await parseEventFromTransaction<AddBlobResult>(
        this.client.publicClient,
        this.contract.abi,
        "AddBlob",
        hash,
      );
      const tx = await this.client.publicClient.waitForTransactionReceipt({
        hash,
      });
      return { meta: { tx }, result };
    } catch (error: unknown) {
      if (error instanceof ContractFunctionExecutionError) {
        const { isActorNotFound, address } = isActorNotFoundError(error);
        if (isActorNotFound) {
          throw new ActorNotFound(address as Address);
        }
      }
      throw new UnhandledBlobError(`Failed to add blob: ${error}`);
    }
  }

  // Add blob
  // TODO: this assumes the blob already exists on the network; there's no way to upload raw blobs
  // to the objects API (it requires a bucket and a key)
  async addBlob(
    blobHash: string,
    subscriptionId: string,
    size: bigint,
    options: AddBlobOptions = {},
  ): Promise<Result<AddBlobResult>> {
    const ttl = options?.ttl ?? 0n;
    if (ttl !== 0n && ttl < MIN_TTL) {
      throw new InvalidValue(`TTL must be at least ${MIN_TTL} seconds`);
    }
    const objectApiUrl = this.client.network.objectApiUrl();
    const { nodeId: source } = await getObjectsNodeInfo(objectApiUrl);
    const addParams = {
      sponsor: options.sponsor ?? zeroAddress,
      source,
      blobHash,
      metadataHash: "",
      subscriptionId,
      size,
      ttl,
    };
    return this.addBlobInner(addParams);
  }

  // Delete blob
  async deleteBlob(
    blobHash: string,
    subscriptionId: string,
    subscriber?: Address,
  ): Promise<Result<DeleteBlobResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for deleting blobs");
    }
    try {
      const args = [
        subscriber || zeroAddress,
        blobHash,
        subscriptionId,
      ] satisfies DeleteBlobParams;
      const { request } = await this.contract.simulate.deleteBlob<
        Chain,
        Account
      >(args, {
        account: this.client.walletClient.account,
      });
      // TODO: calling `this.contract.write.deleteBlob(...)` doesn't work, for some reason
      const hash = await this.client.walletClient.writeContract(request);
      const tx = await this.client.publicClient.waitForTransactionReceipt({
        hash,
      });
      const result = await parseEventFromTransaction<DeleteBlobResult>(
        this.client.publicClient,
        this.contract.abi,
        "DeleteBlob",
        hash,
      );
      return { meta: { tx }, result };
    } catch (error: unknown) {
      if (error instanceof ContractFunctionExecutionError) {
        const { isActorNotFound, address } = isActorNotFoundError(error);
        if (isActorNotFound) {
          throw new ActorNotFound(address as Address);
        }
      }
      throw new UnhandledBlobError(`Failed to delete blob: ${error}`);
    }
  }

  // Get blob info
  // TODO: there's no way to download raw blobs from the objects API (it requires a bucket and a key)
  async getBlob(
    blobHash: string,
    blockNumber?: bigint,
  ): Promise<Result<BlobInfo>> {
    try {
      const args = [blobHash] satisfies GetBlobParams;
      const result = await this.contract.read.getBlob(args, { blockNumber });
      return { result };
    } catch (error: unknown) {
      throw new UnhandledBlobError(`Failed to get blob info: ${error}`);
    }
  }

  // Get blob status
  async getBlobStatus(
    subscriber: Address,
    blobHash: string,
    subscriptionId: string,
    blockNumber?: bigint,
  ): Promise<Result<BlobStatus>> {
    try {
      const args = [
        subscriber,
        blobHash,
        subscriptionId,
      ] satisfies GetBlobStatusParams;
      const result = await this.contract.read.getBlobStatus(args, {
        blockNumber,
      });
      return { result };
    } catch (error: unknown) {
      if (error instanceof ContractFunctionExecutionError) {
        const { isActorNotFound, address } = isActorNotFoundError(error);
        if (isActorNotFound) {
          throw new ActorNotFound(address as Address);
        }
      }
      throw new UnhandledBlobError(`Failed to get blob status: ${error}`);
    }
  }

  // Overwrite blob inner
  async overwriteBlobInner(
    oldHash: string,
    addParams: AddBlobParams,
  ): Promise<Result<OverwriteBlobResult>> {
    try {
      if (!this.client.walletClient?.account) {
        throw new Error(
          "Wallet client is not initialized for overwriting blobs",
        );
      }
      const params = [oldHash, addParams] satisfies OverwriteBlobParams;
      const { request } = await this.contract.simulate.overwriteBlob<
        Chain,
        Account
      >(params, {
        account: this.client.walletClient.account,
      });
      // TODO: calling `this.contract.write.overwriteBlob(...)` doesn't work, for some reason
      const hash = await this.client.walletClient.writeContract(request);
      const tx = await this.client.publicClient.waitForTransactionReceipt({
        hash,
      });
      const result = await parseEventFromTransaction<OverwriteBlobResult>(
        this.client.publicClient,
        this.contract.abi,
        "OverwriteBlob",
        hash,
      );
      return { meta: { tx }, result };
    } catch (error: unknown) {
      throw new UnhandledBlobError(`Failed to overwrite blob: ${error}`);
    }
  }

  // Overwrite blob
  async overwriteBlob(
    oldHash: string,
    newHash: string,
    subscriptionId: string,
    size: bigint,
    options: AddBlobOptions = {},
  ): Promise<Result<OverwriteBlobResult>> {
    const objectApiUrl = this.client.network.objectApiUrl();
    const { nodeId: source } = await getObjectsNodeInfo(objectApiUrl);
    const params = {
      sponsor: options.sponsor ?? zeroAddress,
      source,
      blobHash: newHash,
      metadataHash: "",
      subscriptionId,
      size,
      ttl: options.ttl ?? 0n,
    };
    return this.overwriteBlobInner(oldHash, params);
  }

  // Get added blobs
  async getAddedBlobs(
    size: number,
    blockNumber?: bigint,
  ): Promise<Result<AddedBlobs>> {
    try {
      const result = await this.contract.read.getAddedBlobs([size], {
        blockNumber,
      });
      return { result };
    } catch (error: unknown) {
      throw new UnhandledBlobError(`Failed to get added blobs: ${error}`);
    }
  }

  // Get pending blobs
  async getPendingBlobs(
    size: number,
    blockNumber?: bigint,
  ): Promise<Result<PendingBlobs>> {
    try {
      const result = await this.contract.read.getPendingBlobs([size], {
        blockNumber,
      });
      return { result };
    } catch (error: unknown) {
      throw new UnhandledBlobError(
        `Failed to get pending blobs count: ${error}`,
      );
    }
  }

  // Get pending blobs count
  async getPendingBlobsCount(
    blockNumber?: bigint,
  ): Promise<Result<PendingBlobsCount>> {
    try {
      const result = await this.contract.read.getPendingBlobsCount({
        blockNumber,
      });
      return { result };
    } catch (error: unknown) {
      throw new UnhandledBlobError(
        `Failed to get pending blobs count: ${error}`,
      );
    }
  }

  // Get pending bytes count
  async getPendingBytesCount(
    blockNumber?: bigint,
  ): Promise<Result<PendingBytesCount>> {
    try {
      const result = await this.contract.read.getPendingBytesCount({
        blockNumber,
      });
      return { result };
    } catch (error: unknown) {
      throw new UnhandledBlobError(
        `Failed to get pending bytes count: ${error}`,
      );
    }
  }

  // Get storage stats
  async getStorageStats(blockNumber?: bigint): Promise<Result<StorageStats>> {
    try {
      const result = await this.contract.read.getStorageStats({ blockNumber });
      return { result };
    } catch (error: unknown) {
      throw new UnhandledBlobError(`Failed to get storage stats: ${error}`);
    }
  }

  // Get storage usage
  async getStorageUsage(
    address?: Address,
    blockNumber?: bigint,
  ): Promise<Result<StorageUsage>> {
    const addressArg = address || this.client.walletClient?.account?.address;
    if (!addressArg) {
      throw new Error("Address is required for getting storage usage");
    }
    try {
      const result = await this.contract.read.getStorageUsage([addressArg], {
        blockNumber,
      });
      return { result };
    } catch (error: unknown) {
      if (error instanceof ContractFunctionExecutionError) {
        const { isActorNotFound, address } = isActorNotFoundError(error);
        if (isActorNotFound) {
          throw new ActorNotFound(address as Address);
        }
      }
      throw new UnhandledBlobError(`Failed to get storage usage: ${error}`);
    }
  }

  // Get subnet stats
  async getSubnetStats(blockNumber?: bigint): Promise<Result<SubnetStats>> {
    try {
      const result = await this.contract.read.getSubnetStats({ blockNumber });
      return { result };
    } catch (error: unknown) {
      throw new UnhandledBlobError(`Failed to get subnet stats: ${error}`);
    }
  }
}
