import {
  AbiStateMutability,
  Address,
  Client,
  ContractFunctionArgs,
  ContractFunctionReturnType,
  getContract,
  GetContractReturnType,
  GetEventArgs,
  zeroAddress,
} from "viem";
import { blobManagerABI } from "../abis.js";
import { HokuClient } from "../client.js";
import { UnhandledBlobError } from "./errors.js";
import { DeepMutable, parseEventFromTransaction, type Result } from "./utils.js";

// TODO: emulates `@wagmi/cli` generated constants
export const blobManagerAddress = {
  2481632: "0x8c2e3e8ba0d6084786d60A6600e832E8df84846C", // TODO: testnet; outdated contract deployment, but keeping here
  248163216: "0xe1Aa25618fA0c7A1CFDab5d6B456af611873b629", // TODO: localnet; we need to make this deterministic
} as const;

// Used for getBlob()
export type BlobInfo = DeepMutable<
  ContractFunctionReturnType<typeof blobManagerABI, AbiStateMutability, "getBlob">
>;

// Used for getPendingBlobsCount()
export type PendingBlobsCount = DeepMutable<
  ContractFunctionReturnType<typeof blobManagerABI, AbiStateMutability, "getPendingBlobsCount">
>;

// Used for getPendingBytesCount()
export type PendingBytesCount = DeepMutable<
  ContractFunctionReturnType<typeof blobManagerABI, AbiStateMutability, "getPendingBytesCount">
>;

// Used for getStorageStats()
export type StorageStats = DeepMutable<
  ContractFunctionReturnType<typeof blobManagerABI, AbiStateMutability, "getStorageStats">
>;

// Used for getBlobStatus()
export type BlobStatus = DeepMutable<
  ContractFunctionReturnType<typeof blobManagerABI, AbiStateMutability, "getBlobStatus">
>;

// Used for getStorageUsage()
export type StorageUsage = DeepMutable<
  ContractFunctionReturnType<typeof blobManagerABI, AbiStateMutability, "getStorageUsage">
>;

// Used for getSubnetStats()
export type SubnetStats = DeepMutable<
  ContractFunctionReturnType<typeof blobManagerABI, AbiStateMutability, "getSubnetStats">
>;

// Used for addBlob()
type AddBlobParams = ContractFunctionArgs<typeof blobManagerABI, AbiStateMutability, "addBlob">;

// Used for getBlob()
type GetBlobParams = ContractFunctionArgs<typeof blobManagerABI, AbiStateMutability, "getBlob">;

// Used for getBlobStatus()
type GetBlobStatusParams = ContractFunctionArgs<
  typeof blobManagerABI,
  AbiStateMutability,
  "getBlobStatus"
>;

// Used for deleteBlob()
type DeleteBlobParams = ContractFunctionArgs<
  typeof blobManagerABI,
  AbiStateMutability,
  "deleteBlob"
>;

// Used for addBlob()
export type AddBlobResult = Required<
  GetEventArgs<typeof blobManagerABI, "BlobAdded", { IndexedOnly: false }>
>;

// Used for deleteBlob()
export type DeleteBlobResult = Required<
  GetEventArgs<typeof blobManagerABI, "BlobDeleted", { IndexedOnly: false }>
>;

export class BlobManager {
  client: HokuClient;
  contract: GetContractReturnType<typeof blobManagerABI, Client, Address>;

  constructor(client: HokuClient, contractAddress?: Address) {
    this.client = client;
    const deployedBlobManagerAddress = (blobManagerAddress as Record<number, Address>)[
      client.publicClient?.chain?.id || 0
    ];
    this.contract = getContract({
      abi: blobManagerABI,
      address: contractAddress || deployedBlobManagerAddress,
      client: {
        public: client.publicClient,
        wallet: client.walletClient!,
      },
    });
  }

  getContract(): GetContractReturnType<typeof blobManagerABI, Client, Address> {
    return this.contract;
  }

  // Get blob info
  async getBlob(blobHash: string, blockNumber?: bigint): Promise<Result<BlobInfo>> {
    try {
      const args = [blobHash] satisfies GetBlobParams;
      const result = (await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getBlob",
        args,
        blockNumber,
      })) as BlobInfo;
      return { result };
    } catch (error) {
      throw new UnhandledBlobError(`Failed to get blob info: ${error}`);
    }
  }

  // Get pending blobs count
  async getPendingBlobsCount(blockNumber?: bigint): Promise<Result<PendingBlobsCount>> {
    try {
      const result = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getPendingBlobsCount",
        blockNumber,
      });
      return { result };
    } catch (error) {
      throw new UnhandledBlobError(`Failed to get pending blobs count: ${error}`);
    }
  }

  // Get pending bytes count
  async getPendingBytesCount(blockNumber?: bigint): Promise<Result<PendingBytesCount>> {
    try {
      const result = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getPendingBytesCount",
        blockNumber,
      });
      return { result };
    } catch (error) {
      throw new UnhandledBlobError(`Failed to get pending bytes count: ${error}`);
    }
  }

  // Get storage stats
  async getStorageStats(blockNumber?: bigint): Promise<Result<StorageStats>> {
    try {
      const result = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getStorageStats",
        blockNumber,
      });
      return { result };
    } catch (error) {
      throw new UnhandledBlobError(`Failed to get storage stats: ${error}`);
    }
  }

  // Get blob status
  async getBlobStatus(
    subscriber: Address,
    blobHash: string,
    subscriptionId: string,
    blockNumber?: bigint
  ): Promise<Result<BlobStatus>> {
    try {
      const args = [subscriber, blobHash, subscriptionId] satisfies GetBlobStatusParams;
      const result = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getBlobStatus",
        args,
        blockNumber,
      });
      return { result };
    } catch (error) {
      throw new UnhandledBlobError(`Failed to get blob status: ${error}`);
    }
  }

  // Get storage usage
  async getStorageUsage(address?: Address, blockNumber?: bigint): Promise<Result<StorageUsage>> {
    const addressArg = address || this.client.walletClient?.account?.address;
    if (!addressArg) {
      throw new Error("Address is required for getting storage usage");
    }
    try {
      const result = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getStorageUsage",
        args: [addressArg],
        blockNumber,
      });
      return { result };
    } catch (error) {
      throw new UnhandledBlobError(`Failed to get storage usage: ${error}`);
    }
  }

  // Get subnet stats
  async getSubnetStats(blockNumber?: bigint): Promise<Result<SubnetStats>> {
    try {
      const result = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getSubnetStats",
        blockNumber,
      });
      return { result };
    } catch (error) {
      throw new UnhandledBlobError(`Failed to get subnet stats: ${error}`);
    }
  }

  // Add a blob
  async addBlob(
    source: string,
    blobHash: string,
    metadataHash: string,
    subscriptionId: string,
    size: bigint,
    ttl: bigint = 0n,
    sponsor?: Address
  ): Promise<Result<AddBlobResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for adding blobs");
    }
    try {
      const args = [
        {
          sponsor: sponsor || zeroAddress,
          source,
          blobHash,
          metadataHash,
          subscriptionId,
          size,
          ttl,
        },
      ] satisfies AddBlobParams;
      const { request } = await this.client.publicClient.simulateContract({
        address: this.contract.address,
        abi: this.contract.abi,
        functionName: "addBlob",
        args,
        account: this.client.walletClient.account,
      });
      const hash = await this.client.walletClient.writeContract(request);
      const result = (await parseEventFromTransaction<AddBlobResult>(
        this.client.publicClient,
        this.contract.abi,
        "BlobAdded",
        hash
      )) as AddBlobResult;
      const tx = await this.client.publicClient.waitForTransactionReceipt({ hash });
      return { meta: { tx }, result };
    } catch (error) {
      throw new UnhandledBlobError(`Failed to add blob: ${error}`);
    }
  }

  // Delete blob
  async deleteBlob(
    blobHash: string,
    subscriptionId: string,
    subscriber?: Address
  ): Promise<Result<DeleteBlobResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for deleting blobs");
    }
    try {
      const args = [subscriber || zeroAddress, blobHash, subscriptionId] satisfies DeleteBlobParams;
      const { request } = await this.client.publicClient.simulateContract({
        address: this.contract.address,
        abi: this.contract.abi,
        functionName: "deleteBlob",
        args,
        account: this.client.walletClient.account,
      });
      const hash = await this.client.walletClient.writeContract(request);
      const tx = await this.client.publicClient.waitForTransactionReceipt({ hash });
      const result = (await parseEventFromTransaction<DeleteBlobResult>(
        this.client.publicClient,
        this.contract.abi,
        "BlobDeleted",
        hash
      )) as DeleteBlobResult;
      return { meta: { tx }, result };
    } catch (error) {
      throw new UnhandledBlobError(`Failed to delete blob: ${error}`);
    }
  }
}
